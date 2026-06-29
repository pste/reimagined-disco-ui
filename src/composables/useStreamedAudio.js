import { ref, inject } from 'vue'
import logger from '@/plugins/logger'
import { useCacheFeeder } from '@/composables/useCacheFeeder'
import useErrorsStore from '@/stores/errors'
import usePlaylistStore from '@/stores/playlist'

const MIME_TYPE = 'audio/mpeg';
const CACHE_TABLE = 'chunks';
const MAX_CHUNKS_GUARD = 500;
const CHUNK_BYTES = 1e6; // dimensione fissa dei chunk lato server (streamer.chunkFile)

// feeder.prefetch(nextSongId) fire-and-forget dopo streamer.load.

function streamErrorMessage(err) {
  if (!err) { return 'Errore sconosciuto durante la riproduzione.'; }
  if (err.name === 'QuotaExceededError') { return 'Buffer audio pieno: impossibile continuare la riproduzione.'; }
  if (err.name === 'NotSupportedError')  { return 'Formato audio non supportato dal browser.'; }
  if (err.name === 'InvalidStateError')  { return 'Errore nello stato del player audio.'; }
  return `Errore riproduzione: ${err.message ?? err}`;
}

export function useStreamedAudio() {
  const idxDB = inject('idxDB');
  const feeder = useCacheFeeder();
  const errorsStore = useErrorsStore();
  const playlistStore = usePlaylistStore();

  const loading = ref(false);
  const error = ref(null);

  let mediaSource = null;
  let sourceBuffer = null;
  let currentObjectURL = null; // the audioElement refers to this always changing URL
  let abortController = null;
  let removeSeekListener = null; // unhook del listener 'seeking' del load corrente

  // on stop we clean
  function revokeCurrentURL() {
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL);
      currentObjectURL = null;
    }
  }

  // stop event — aborts any in-flight load and tears down MSE
  function stop() {
    if (removeSeekListener) {
      removeSeekListener();
      removeSeekListener = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (mediaSource && mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream(); } catch (_) { /* ignore */ }
    }
    mediaSource = null;
    sourceBuffer = null;
    revokeCurrentURL();
    loading.value = false;
  }

  //
  async function load(audioEl, songId, playerMeta) {
    // clear before start (again)
    stop();

    // init
    const ac = new AbortController(); // every load creates an AbortController
    const signal = ac.signal;
    abortController = ac;
    loading.value = true;
    error.value = null;

    try {
      if (!('MediaSource' in window) || !MediaSource.isTypeSupported(MIME_TYPE)) {
        throw new Error('MediaSource / audio/mpeg not supported in this browser');
      }

      mediaSource = new MediaSource();
      currentObjectURL = URL.createObjectURL(mediaSource);
      audioEl.src = currentObjectURL;

      // build MediaSource events
      await new Promise((resolve, reject) => {
        const onOpen = () => { mediaSource.removeEventListener('sourceopen', onOpen); resolve(); };
        const onErr = (e) => { mediaSource.removeEventListener('error', onErr); reject(e); };
        mediaSource.addEventListener('sourceopen', onOpen);
        mediaSource.addEventListener('error', onErr);
      });
      signal.throwIfAborted();

      sourceBuffer = mediaSource.addSourceBuffer(MIME_TYPE);

      // producer/consumer queue
      const queue = [];
      let drainResolve = null; // promise to resolve draining
      let drainReject = null; // promise to reject draining
      let pendingPumpError = null; // appendBuffer can throw synchronously before drainReject is set

      // unblock waitForDrain on abort so the load can exit cleanly
      signal.addEventListener('abort', () => {
        if (drainReject) {
          drainReject(new DOMException('Aborted', 'AbortError'));
          drainResolve = null;
          drainReject = null;
        }
      });

      // pumps a chunk out from the queue to the buffer
      function pumpQueue() {
        if (!sourceBuffer || sourceBuffer.updating || queue.length === 0) {
          return;
        }
        try {
          sourceBuffer.appendBuffer(queue.shift()); // read from queue and feed the buffer
        }
        catch (err) {
          if (drainReject) {
            drainReject(err);
            drainResolve = null;
            drainReject = null;
          } else {
            // drainReject not yet set (synchronous throw before waitForDrain was called):
            // save the error so waitForDrain picks it up on the next call
            pendingPumpError = err;
          }
        }
      }

      sourceBuffer.addEventListener('updateend', () => {
        if (signal.aborted) {
          return;
        }
        pumpQueue();
        // drain is complete only when nothing is queued AND no append is in flight.
        // pumpQueue may have just started appending the last chunk, so checking
        // queue.length alone would fire drain while updating is still true.
        if (queue.length === 0 && !sourceBuffer.updating && drainResolve) {
          drainResolve();
          drainResolve = null;
          drainReject = null;
        }
      });

      function enqueueChunk(chunk) {
        queue.push(chunk);
        pumpQueue();
      }

      function waitForDrain() {
        return new Promise((resolve, reject) => {
          if (pendingPumpError) {
            const err = pendingPumpError;
            pendingPumpError = null;
            reject(err);
            return;
          }
          if (queue.length === 0 && !sourceBuffer.updating) {
            resolve();
            return;
          }
          drainResolve = resolve;
          drainReject = reject;
        });
      }

      // remove already-played data from SourceBuffer to avoid QuotaExceededError.
      // keeps 10s behind playhead so short seeks still work.
      async function trimBuffer() {
        if (!sourceBuffer || sourceBuffer.updating || sourceBuffer.buffered.length === 0) {
          return;
        }
        const start = sourceBuffer.buffered.start(0);
        const safeEnd = audioEl.currentTime - 10;
        if (safeEnd <= start + 1) {
          return;
        }
        await new Promise((resolve) => {
          const sb = sourceBuffer; // capture ref: stop() may null the module-level var mid-await
          const onEnd = () => { sb.removeEventListener('updateend', onEnd); resolve(); };
          sb.addEventListener('updateend', onEnd);
          try {
            sb.remove(start, safeEnd);
          }
          catch (_) {
            sb.removeEventListener('updateend', onEnd);
            resolve();
          }
        });
      }

      // backpressure: if more than BUFFER_AHEAD_SECS of audio is already buffered ahead
      // of the playhead, park the loop until playback consumes the buffer before appending
      // the next chunk. Attivo SEMPRE, anche a player fermo (currentTime 0 → ahead = durata
      // bufferizzata): così il buffer resta limitato anche su un brano solo caricato e non
      // avviato, evitando il QuotaExceededError. timeupdate non scatta da fermo, quindi si
      // attende anche 'playing' (ripresa) e 'abort': a player in pausa il loop si parcheggia
      // qui finché l'utente non preme play — stato desiderato, nessun deadlock.
      const BUFFER_AHEAD_SECS = 30;
      async function throttleIfBufferFull() {
        if (!sourceBuffer || sourceBuffer.buffered.length === 0) { return; }
        while (true) {
          const ahead = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1) - audioEl.currentTime;
          if (ahead <= BUFFER_AHEAD_SECS) { return; }
          await new Promise((resolve) => {
            const done = () => {
              audioEl.removeEventListener('timeupdate', done);
              audioEl.removeEventListener('playing', done);
              signal.removeEventListener('abort', done);
              resolve();
            };
            audioEl.addEventListener('timeupdate', done);
            audioEl.addEventListener('playing', done);
            signal.addEventListener('abort', done);
          });
          signal.throwIfAborted();
        }
      }

      // pull chunks from the feeder in order and append to MSE.
      // the streamer never touches the network: the feeder does.
      // drain after each chunk, trim played data, then throttle if buffer is full.
      // un seek (seekTo) incrementa `generation`: il loop superato esce in silenzio
      // al primo check dopo ogni await, quello nuovo riparte dal chunk del seek
      let appended = 0;
      let totalBytes = 0;
      let maxChunks = MAX_CHUNKS_GUARD;
      let songInfo = null; // songMeta del chunk 1: serve alla mappa tempo→chunk del seek
      let generation = 0;
      let loopError = null;
      let loopEnded;
      const loopEndedPromise = new Promise((resolve) => { loopEnded = resolve; });

      async function appendLoop(gen, startChunk) {
        for (let chunkId = startChunk; chunkId <= maxChunks; chunkId++) {
          const { blob, songMeta } = await feeder.getChunk(songId, chunkId, playerMeta);
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          if (!blob || blob.size === 0) {
            logger.log(`streamedAudio: end of stream at chunk=${chunkId} (blob=${blob ? blob.size : 'undefined'})`);
            break;
          }
          // update loop bound immediately (pure JS variable, no MSE interaction needed)
          if (chunkId === 1 && (songMeta?.totalChunks ?? 0) > 0) {
            maxChunks = songMeta.totalChunks;
            songInfo = songMeta;
          }
          const buf = await blob.arrayBuffer();
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          enqueueChunk(buf);
          await waitForDrain();
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          // propagate duration to store after first chunk is appended
          if (chunkId === 1 && (songMeta?.duration ?? 0) > 0) {
            playlistStore.currentSongDuration = songMeta.duration;
            // duration nota anche a MSE: senza, il browser clampa i seek oltre i dati già appesi
            try { mediaSource.duration = songMeta.duration; } catch (_) { /* updating: ignore */ }
          }
          await trimBuffer();
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          await throttleIfBufferFull();
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          appended += 1;
          totalBytes += buf.byteLength;
        }
        // fine naturale del brano: drain e chiusura dello stream (serve anche ai
        // re-append post-seek: senza endOfStream l'elemento non emette 'ended')
        await waitForDrain();
        signal.throwIfAborted();
        if (gen !== generation) { return; }
        logger.log(`streamedAudio: song=${songId} appended ${appended} chunks, ${totalBytes} bytes`);
        if (mediaSource.readyState === 'open') {
          try { mediaSource.endOfStream(); } catch (_) { /* ignore */ }
        }
        loading.value = false;
        loopEnded();
      }

      function onLoopError(err) {
        if (err?.name !== 'AbortError') {
          logger.error('streamedAudio error:', err);
          error.value = err;
          errorsStore.showError(streamErrorMessage(err));
          if (mediaSource && mediaSource.readyState === 'open') {
            try { mediaSource.endOfStream('network'); } catch (_) { /* ignore */ }
          }
        }
        loopError = err;
        loading.value = false;
        loopEnded(); // sblocca comunque load()
      }

      // attende che il SourceBuffer sia fermo (nessun append/remove in volo).
      // NB: dopo un abort() il browser accoda comunque un updateend "stantio",
      // quindi non basta il primo evento: si risolve solo con updating === false
      function waitForIdle() {
        return new Promise((resolve) => {
          const sb = sourceBuffer;
          if (!sb || !sb.updating) { resolve(); return; }
          const onEnd = () => {
            if (sb.updating) { return; }
            sb.removeEventListener('updateend', onEnd);
            resolve();
          };
          sb.addEventListener('updateend', onEnd);
        });
      }

      // svuota tutto il buffered (preparazione al re-append dal punto di seek)
      function removeAllBuffered() {
        return new Promise((resolve) => {
          const sb = sourceBuffer;
          if (!sb || sb.buffered.length === 0) { resolve(); return; }
          const end = sb.buffered.end(sb.buffered.length - 1);
          const onEnd = () => {
            if (sb.updating) { return; } // updateend stantio (es. dell'abort): la remove è ancora in corso
            sb.removeEventListener('updateend', onEnd);
            resolve();
          };
          sb.addEventListener('updateend', onEnd);
          try { sb.remove(0, end + 1); }
          catch (_) { sb.removeEventListener('updateend', onEnd); resolve(); }
        });
      }

      // seek fuori dal buffered: scarta la pipeline corrente e riparte dal chunk che
      // contiene il punto richiesto. Mappa tempo→chunk con stima CBR dal bitrate (i
      // chunk sono tagli fissi da 1MB lato server; il decoder MP3 si risincronizza
      // sul primo frame header del chunk, come già avviene coi tagli sequenziali)
      async function seekTo(seconds) {
        generation += 1;
        const gen = generation;
        queue.length = 0;
        pendingPumpError = null;
        if (drainResolve) { drainResolve(); drainResolve = null; drainReject = null; } // release the superseded loop
        try { if (sourceBuffer.updating) { sourceBuffer.abort(); } } catch (_) { /* ignore */ }
        await removeAllBuffered(); // riapre anche il MediaSource se era 'ended'
        await waitForIdle(); // timestampOffset esige updating === false
        if (gen !== generation || signal.aborted) { return; }
        // abort incondizionato a buffer fermo: resetta il parser dei segmenti.
        // I tagli da 1MB spezzano i frame MP3, quindi dopo un append il parser resta
        // in PARSING_MEDIA_SEGMENT e timestampOffset sarebbe vietato in quello stato
        try { sourceBuffer.abort(); } catch (_) { /* ignore */ }
        const bytesPerSec = songInfo.bitrate / 8;
        const startChunk = Math.max(1, Math.min(Math.floor((seconds * bytesPerSec) / CHUNK_BYTES) + 1, maxChunks));
        sourceBuffer.timestampOffset = ((startChunk - 1) * CHUNK_BYTES) / bytesPerSec;
        appendLoop(gen, startChunk).catch(onLoopError);
      }

      // i seek dentro al buffered li gestisce il browser da solo; fuori, si riparte
      // dal chunk giusto invece di accodare in sequenza tutti quelli intermedi
      function onSeeking() {
        if (!songInfo?.bitrate || !sourceBuffer) { return; } // mappa tempo→chunk non ancora disponibile
        const t = audioEl.currentTime;
        const buffered = sourceBuffer.buffered;
        for (let i = 0; i < buffered.length; i++) {
          if (t >= buffered.start(i) - 0.5 && t <= buffered.end(i)) { return; }
        }
        seekTo(t).catch((err) => { logger.error('streamedAudio: seekTo error', err); });
      }
      audioEl.addEventListener('seeking', onSeeking);
      removeSeekListener = () => { audioEl.removeEventListener('seeking', onSeeking); };

      appendLoop(generation, 1).catch(onLoopError);
      await loopEndedPromise;
      if (loopError) { return; } // errore già gestito da onLoopError (incluso AbortError)
      signal.throwIfAborted();
    }
    catch (err) {
      if (err?.name === 'AbortError') {
        return; // superseded or stopped — stop() already cleaned up
      }
      logger.error('streamedAudio error:', err);
      error.value = err;
      loading.value = false;
      const msg = streamErrorMessage(err);
      errorsStore.showError(msg);
      if (mediaSource && mediaSource.readyState === 'open') {
        try { mediaSource.endOfStream('network'); } catch (_) { /* ignore */ }
      }
    }
    finally {
      if (abortController === ac) {
        abortController = null;
      }
    }
  }

  // db cleanup
  async function sweep() {
    try {
      await idxDB.sweep(CACHE_TABLE);
    }
    catch (err) {
      logger.error('streamedAudio sweep error:', err, 'Going on ...');
    }
  }

  return { load, stop, sweep, loading, error };
}
