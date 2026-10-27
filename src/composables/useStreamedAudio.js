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
  let removeListeners = null; // unhook dei listener 'seeking'/'timeupdate' del load corrente
  // gapless: più brani accodati sullo stesso MediaSource, uno dopo l'altro sulla stessa
  // timeline. songBase = secondo della timeline in cui inizia il brano in riproduzione
  // (0 per il primo): il player lo sottrae a currentTime per mostrare il tempo del brano
  const songBase = ref(0);
  // loop A-B: trimBuffer non rimuove i dati da qui in poi (secondi), così il salto B→A
  // cade nel buffered e lo gestisce il browser (niente seekTo, niente pausa). null = off
  let keepFrom = null;

  function setKeepFrom(seconds) {
    keepFrom = seconds;
  }

  // on stop we clean
  function revokeCurrentURL() {
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL);
      currentObjectURL = null;
    }
  }

  // stop event — aborts any in-flight load and tears down MSE
  function stop() {
    if (removeListeners) {
      removeListeners();
      removeListeners = null;
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
    songBase.value = 0;
    loading.value = false;
  }

  // chain (opzionale) abilita il gapless:
  //   key            identifica il brano per il chiamante (l'indice in playlist)
  //   getNext(key)   chiamata quando il brano `key` è tutto appeso: ritorna
  //                  { key, songId, meta } del brano da accodare, oppure null (fine)
  //   onSongChange(key, songId)  la riproduzione è entrata in un brano accodato
  // load() si risolve quando il PRIMO brano è tutto appeso; la catena prosegue da sola
  async function load(audioEl, songId, playerMeta, chain = {}) {
    // clear before start (again)
    stop();
    keepFrom = null; // un loop A-B vale solo per il brano su cui è stato creato

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
        let safeEnd = audioEl.currentTime - 10;
        if (keepFrom !== null) {
          safeEnd = Math.min(safeEnd, keepFrom - 1); // loop A-B: tieni i dati da A in poi
        }
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
      let generation = 0;
      let loopError = null;
      let loopEnded;
      const loopEndedPromise = new Promise((resolve) => { loopEnded = resolve; });

      // gapless: i brani appesi sul MediaSource, in ordine di timeline. `current` è
      // l'indice di quello in riproduzione; i successivi sono già (in parte) nel buffer
      const segments = [];
      let current = 0;
      function newSegment(key, segSongId, meta, base) {
        // info = songMeta del chunk 1: serve alla mappa tempo→chunk del seek
        return { key, songId: segSongId, meta, base, info: null, maxChunks: MAX_CHUNKS_GUARD };
      }
      segments.push(newSegment(chain.key, songId, playerMeta, 0));
      let appendingSeg = null; // brano che il loop sta appendendo (per onLoopError)

      async function appendLoop(gen, seg, startChunk) {
        while (true) {
          appendingSeg = seg;
          let appended = 0;
          let totalBytes = 0;
          for (let chunkId = startChunk; chunkId <= seg.maxChunks; chunkId++) {
            const { blob, songMeta } = await feeder.getChunk(seg.songId, chunkId, seg.meta);
            signal.throwIfAborted();
            if (gen !== generation) { return; }
            if (!blob || blob.size === 0) {
              logger.log(`streamedAudio: end of stream at chunk=${chunkId} (blob=${blob ? blob.size : 'undefined'})`);
              break;
            }
            // update loop bound immediately (pure JS variable, no MSE interaction needed)
            if (chunkId === 1 && (songMeta?.totalChunks ?? 0) > 0) {
              seg.maxChunks = songMeta.totalChunks;
              seg.info = songMeta;
            }
            const buf = await blob.arrayBuffer();
            signal.throwIfAborted();
            if (gen !== generation) { return; }
            enqueueChunk(buf);
            await waitForDrain();
            signal.throwIfAborted();
            if (gen !== generation) { return; }
            if (chunkId === 1 && (songMeta?.duration ?? 0) > 0) {
              // un brano accodato prende la sua durata solo quando inizia a suonare (onTimeUpdate)
              if (seg === segments[current]) {
                playlistStore.currentSongDuration = songMeta.duration;
              }
              // duration nota anche a MSE: senza, il browser clampa i seek oltre i dati già appesi
              const end = seg.base + songMeta.duration;
              if (!(mediaSource.duration >= end)) { // NaN all'inizio
                try { mediaSource.duration = end; } catch (_) { /* updating: ignore */ }
              }
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
          await waitForDrain();
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          logger.log(`streamedAudio: song=${seg.songId} appended ${appended} chunks, ${totalBytes} bytes`);
          loopEnded(); // il primo brano è tutto appeso: load() si risolve (le chiamate successive non fanno nulla)

          // gapless: si accoda il brano successivo sulla stessa timeline, così l'elemento
          // audio non va mai in 'ended' tra un brano e l'altro. Una pagina muta in background
          // (PWA Android a schermo spento) viene congelata dal sistema: il cambio brano con
          // un nuovo MediaSource poteva restare fermo per minuti
          const next = chain.getNext ? chain.getNext(seg.key) : null;
          if (!next) {
            break;
          }
          await waitForIdle(); // timestampOffset esige updating === false
          signal.throwIfAborted();
          if (gen !== generation) { return; }
          // abort: resetta il parser (l'ultimo chunk può finire con un frame a metà),
          // il brano nuovo riparte pulito dal suo tag ID3
          try { sourceBuffer.abort(); } catch (_) { /* ignore */ }
          const buffered = sourceBuffer.buffered;
          const base = buffered.length > 0 ? buffered.end(buffered.length - 1) : seg.base + (seg.info?.duration ?? 0);
          sourceBuffer.timestampOffset = base;
          seg = newSegment(next.key, next.songId, next.meta, base);
          segments.push(seg);
          startChunk = 1;
        }
        // fine naturale della catena: chiusura dello stream (serve anche ai
        // re-append post-seek: senza endOfStream l'elemento non emette 'ended')
        if (mediaSource.readyState === 'open') {
          try { mediaSource.endOfStream(); } catch (_) { /* ignore */ }
        }
        loading.value = false;
        loopEnded();
      }

      function onLoopError(err, gen) {
        if (gen !== generation) { return; } // loop già superato da un seek: il suo errore non conta
        // errore su un brano accodato (es. rete giù oltre i retry del feeder): il brano in
        // riproduzione non c'entra, finisce normalmente. Si toglie dal buffer la parte già
        // appesa del brano accodato e si chiude lo stream: a fine brano 'ended' → gotoNext,
        // che ricarica il successivo da capo (con il suo eventuale errore)
        const failed = segments.indexOf(appendingSeg);
        if (err?.name !== 'AbortError' && failed > current) {
          logger.error('streamedAudio: queued song failed', err);
          segments.length = failed;
          truncateAt(appendingSeg.base);
          loading.value = false;
          return;
        }
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

      // rimuove dal buffer i dati da `seconds` in poi e chiude lo stream
      async function truncateAt(seconds) {
        try {
          if (sourceBuffer.updating) { sourceBuffer.abort(); }
          await waitForIdle();
          const buffered = sourceBuffer.buffered;
          if (buffered.length > 0 && buffered.end(buffered.length - 1) > seconds) {
            sourceBuffer.remove(seconds, buffered.end(buffered.length - 1));
            await waitForIdle();
          }
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
        }
        catch (err) {
          logger.error('streamedAudio: truncateAt error', err);
        }
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
      // contiene il punto richiesto (secondi dall'inizio del brano in riproduzione).
      // Mappa tempo→chunk con stima CBR dal bitrate (i chunk sono tagli fissi da 1MB
      // lato server; il decoder MP3 si risincronizza sul primo frame header del chunk,
      // come già avviene coi tagli sequenziali). I brani accodati dopo il corrente
      // vengono buttati: la catena li riaccoda quando il corrente è di nuovo tutto appeso
      async function seekTo(seconds) {
        generation += 1;
        const gen = generation;
        const seg = segments[current];
        segments.length = current + 1;
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
        // l'audio inizia dopo il tag ID3v2 (audioOffset, può contenere una cover di
        // centinaia di KB): la mappa tempo→byte parte da lì. I songMeta cachati prima
        // di questo campo non ce l'hanno → 0, come prima
        const audioOffset = seg.info.audioOffset ?? 0;
        const bytesPerSec = seg.info.bitrate / 8;
        const bytePos = audioOffset + seconds * bytesPerSec;
        let startChunk = Math.max(1, Math.min(Math.floor(bytePos / CHUNK_BYTES) + 1, seg.maxChunks));
        // se il chunk contiene ancora byte del tag si riparte dal chunk 1: il parser MSE
        // salta il tag solo se ne vede l'header "ID3", altrimenti leggerebbe i byte della
        // cover come audio (falsi frame sync)
        const firstAudioChunk = Math.floor(audioOffset / CHUNK_BYTES) + 1;
        if (startChunk <= firstAudioChunk) {
          startChunk = 1;
        }
        sourceBuffer.timestampOffset = seg.base + Math.max(0, ((startChunk - 1) * CHUNK_BYTES - audioOffset) / bytesPerSec);
        appendLoop(gen, seg, startChunk).catch((err) => onLoopError(err, gen));
      }

      // i seek dentro al buffered li gestisce il browser da solo; fuori, si riparte
      // dal chunk giusto invece di accodare in sequenza tutti quelli intermedi
      function onSeeking() {
        const seg = segments[current];
        if (!seg.info?.bitrate || !sourceBuffer) { return; } // mappa tempo→chunk non ancora disponibile
        const t = audioEl.currentTime;
        const buffered = sourceBuffer.buffered;
        for (let i = 0; i < buffered.length; i++) {
          if (t >= buffered.start(i) - 0.5 && t <= buffered.end(i)) { return; }
        }
        seekTo(Math.max(0, t - seg.base)).catch((err) => { logger.error('streamedAudio: seekTo error', err); });
      }

      // gapless: la riproduzione ha superato l'inizio di un brano accodato → diventa il
      // brano corrente (timeupdate scatta ~4 volte al secondo anche in background)
      function onTimeUpdate() {
        while (current + 1 < segments.length && audioEl.currentTime >= segments[current + 1].base) {
          current += 1;
          const seg = segments[current];
          songBase.value = seg.base;
          playlistStore.currentSongDuration = seg.info?.duration ?? 0;
          keepFrom = null; // un loop A-B vale solo per il brano su cui è stato creato
          if (chain.onSongChange) {
            chain.onSongChange(seg.key, seg.songId);
          }
        }
      }

      audioEl.addEventListener('seeking', onSeeking);
      audioEl.addEventListener('timeupdate', onTimeUpdate);
      removeListeners = () => {
        audioEl.removeEventListener('seeking', onSeeking);
        audioEl.removeEventListener('timeupdate', onTimeUpdate);
      };

      appendLoop(generation, segments[0], 1).catch((err) => onLoopError(err, 0));
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
    // NB: abortController resta impostato anche dopo il return: con il gapless la catena
    // continua ad appendere i brani successivi, e solo il prossimo stop() la deve fermare
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

  return { load, stop, sweep, setKeepFrom, songBase, loading, error };
}
