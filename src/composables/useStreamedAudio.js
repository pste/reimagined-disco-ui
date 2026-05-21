import { ref, inject } from 'vue'
import logger from '@/plugins/logger'
import { useCacheFeeder } from '@/composables/useCacheFeeder'
import useErrorsStore from '@/stores/errors'

const MIME_TYPE = 'audio/mpeg';
const CACHE_TABLE = 'chunks';
const MAX_CHUNKS_GUARD = 500;

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

  const loading = ref(false);
  const error = ref(null);

  let mediaSource = null;
  let sourceBuffer = null;
  let currentObjectURL = null;
  let abortController = null;

  // on stop we clean
  function revokeCurrentURL() {
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL);
      currentObjectURL = null;
    }
  }

  // stop event — aborts any in-flight load and tears down MSE
  function stop() {
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
  async function load(audioEl, songId, meta) {
    // clear before start (again)
    stop();
    //
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

      //
      function waitForDrain() {
        return new Promise((resolve, reject) => {
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
          const onEnd = () => { sourceBuffer.removeEventListener('updateend', onEnd); resolve(); };
          sourceBuffer.addEventListener('updateend', onEnd);
          try {
            sourceBuffer.remove(start, safeEnd);
          }
          catch (_) {
            sourceBuffer.removeEventListener('updateend', onEnd);
            resolve();
          }
        });
      }

      // pull chunks from the feeder in order and append to MSE.
      // the streamer never touches the network: the feeder does.
      // drain after each chunk and trim played data to stay under the MSE quota (~10-12MB).
      let appended = 0;
      let totalBytes = 0;
      for (let chunkId = 1; chunkId <= MAX_CHUNKS_GUARD; chunkId++) {
        const blob = await feeder.getChunk(songId, chunkId, meta);
        signal.throwIfAborted();
        if (!blob || blob.size === 0) {
          logger.log(`streamedAudio: end of stream at chunk=${chunkId} (blob=${blob ? blob.size : 'undefined'})`);
          break;
        }
        const buf = await blob.arrayBuffer();
        signal.throwIfAborted();
        enqueueChunk(buf);
        await waitForDrain();
        signal.throwIfAborted();
        await trimBuffer();
        signal.throwIfAborted();
        appended += 1;
        totalBytes += buf.byteLength;
      }
      logger.log(`streamedAudio: song=${songId} appended ${appended} chunks, ${totalBytes} bytes`);

      await waitForDrain();
      signal.throwIfAborted();

      if (mediaSource.readyState === 'open') {
        try { mediaSource.endOfStream(); } catch (_) { /* ignore */ }
      }

      loading.value = false;
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
