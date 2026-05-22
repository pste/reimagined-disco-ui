# Audio Streaming Architecture

This document describes how audio streaming works in reimagined-disco-ui, from the cache layer down to the browser's audio element.

## Overview

The app uses the **Media Source Extensions (MSE)** API to stream audio in chunks rather than downloading a complete file. Chunks are served by the backend, cached in IndexedDB, and fed into the browser's audio pipeline one at a time.

Two composables handle the work:

| File | Role |
|------|------|
| `useCacheFeeder.js` | Retrieves chunks — IndexedDB first, network fallback |
| `useStreamedAudio.js` | Feeds chunks into MSE and manages the SourceBuffer lifecycle |

---

## The Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│  Backend  /chunk/song?id=X&chunkIndex=N                              │
│  chunk 1  →  { metadata: { duration, totalChunks }, data: <b64> }   │
│  chunk N  →  { data: <b64> }                                         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ JSON
┌───────────────────────────▼──────────────────────────────────────────┐
│  useCacheFeeder.js                                                   │
│  getChunk()  →  IDB.get()  ──hit──→  { blob, songMeta }             │
│    (chunk 1 without songMeta → re-fetch from network, self-healing)  │
│                    └──miss──→  API.get()  →  base64ToBlob()          │
│                               songMeta = json.metadata               │
│                               IDB.put({ blob, songMeta, ... })       │
│                               return  { blob, songMeta }             │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ { blob, songMeta }
┌───────────────────────────▼──────────────────────────────────────────┐
│  useStreamedAudio.js — for loop  (bound = songMeta.totalChunks)      │
│  getChunk() → blob.arrayBuffer() → enqueueChunk(buf)                │
│  await waitForDrain()   ←───────────────────────────┐               │
│  chunk 1: playlistStore.currentSongDuration = duration               │
│  await trimBuffer()                                  │               │
│  await throttleIfBufferFull() ←── timeupdate ────────────────────┐  │
└───────────────────────────┬──────────────────────────┼────────────┼──┘
                            │ queue.push()             │ resolve()  │
┌───────────────────────────▼──────────────────────────┴────────────┼──┐
│  queue[]  (internal array)                                         │  │
│  enqueueChunk() → push + pumpQueue()                               │  │
│  pumpQueue()    → shift + appendBuffer()                           │  │
│                   (if updating=true: waits for updateend)          │  │
└───────────────────────────┬────────────────────────────────────────┼──┘
                            │ appendBuffer(ArrayBuffer)              │
┌───────────────────────────▼────────────────────────────────────────┼──┐
│  SourceBuffer  (browser MSE)                                       │  │
│  appendBuffer()  →  updating=true                                  │  │
│  [processes data]→  updating=false  →  fires: updateend ───────────┤  │
│  remove(start,end) ← trimBuffer()                                  │  │
│  endOfStream()     ← end of loop                                   │  │
└───────────────────────────┬────────────────────────────────────────┘  │
                            │ decoded audio stream                       │
┌───────────────────────────▼────────────────────────────────────────────┐
│  <audio> element  (browser)                                            │
│  fires: canplay    → earlyPlay() → music.play()   [AudioPlayer.vue]    │
│  fires: timeupdate → update slider / time ─────────────────────────────┘
│                    → throttleIfBufferFull() unblocks [AudioPlayer.vue]  │
│  fires: ended      → playlistStore.gotoNext()     [AudioPlayer.vue]    │
│  fires: error      → music.stop() + showError()   [AudioPlayer.vue]    │
└────────────────────────────────────────────────────────────────────────┘
                            │ currentSongDuration (seconds)
┌───────────────────────────▼────────────────────────────────────────────┐
│  playlistStore.currentSongDuration                                     │
│  written by useStreamedAudio after chunk 1 drain                       │
│  read by AudioPlayer.vue via storeToRefs → drives chip + slider        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### MediaSource and SourceBuffer

MSE works by creating a `MediaSource` object and attaching it to the `<audio>` element via an Object URL. Once the browser fires `sourceopen`, a `SourceBuffer` is created for the `audio/mpeg` MIME type. From that point on, raw audio data can be pushed into the buffer incrementally.

The `SourceBuffer` is **stateful**: it can only process one operation at a time. While `updating === true` (an `appendBuffer` or `remove` is in progress), any further call will throw `InvalidStateError`. This is why a queue is necessary.

### The Internal Queue

`enqueueChunk(buf)` pushes an `ArrayBuffer` into `queue[]` and immediately calls `pumpQueue()`. `pumpQueue` shifts one item off the queue and calls `appendBuffer` — but only if `updating === false`. If the buffer is busy, it returns without doing anything; the next call to `pumpQueue` will come from the `updateend` event handler when the current operation finishes.

This producer/consumer pattern decouples the JavaScript fetch loop from the browser's append timing.

### waitForDrain

After each `enqueueChunk`, the for loop calls `await waitForDrain()`. This suspends the loop until:

- the queue is empty, **and**
- `updating === false` (no append in flight)

The `updateend` event is the only signal that unblocks it. Without this wait, the loop would enqueue all chunks instantly — the queue would grow unbounded and `appendBuffer` calls would pile up on top of each other.

### trimBuffer

`trimBuffer` is called after each chunk is drained. It removes data that has already been played, keeping a 10-second window behind the current playhead:

```
remove(buffered.start, currentTime - 10)
```

This frees MSE buffer space continuously during playback. It is a no-op when `currentTime < 11s`, so it does not help during the initial loading phase before play has started.

### throttleIfBufferFull

Even with `trimBuffer`, loading from cache can be much faster than playback. Without backpressure, the loop would fill the entire MSE buffer before the audio has played a single second, causing `QuotaExceededError`.

`throttleIfBufferFull` adds that backpressure: after each chunk, it checks how many seconds are buffered **ahead** of the current playhead. If the amount exceeds `BUFFER_AHEAD_SECS` (30 seconds), it suspends the loop and waits for the next `timeupdate` event — meaning it resumes only once the audio has actually consumed some data.

```
buffered ahead = sourceBuffer.buffered.end() - audioEl.currentTime
if ahead > 30s  →  wait for timeupdate  →  retry
```

At 320 kbps, 30 seconds of audio is about 1.2 MB — well within the MSE quota. The loop is also unblocked immediately by the abort signal, so song changes remain instant.

This throttle is only active when `currentTime > 0`. Before playback has started there is nothing to throttle against, so for very large songs loaded while paused the loop still relies on `pendingPumpError` (see below) to surface any quota error cleanly.

### Early Play via `canplay`

`AudioPlayer.vue` registers a `canplay` listener on the `<audio>` element before calling `await streamer.load()`. The browser fires `canplay` as soon as it has buffered enough data to begin playback — typically after the first one or two chunks. At that point `music.play()` is called, `currentTime` starts advancing, and both `trimBuffer` and `throttleIfBufferFull` become effective for the remainder of the load.

Without this, `music.play()` would only be called after `load()` returns (i.e., after all chunks have been processed), meaning `currentTime = 0` throughout the entire loading phase.

### Chunk Format and Metadata

The backend returns JSON for every chunk:

```json
{ "data": "<base64-encoded audio>" }
```

Chunk 1 also includes a `metadata` field:

```json
{ "metadata": { "duration": 214.3, "totalChunks": 7 }, "data": "..." }
```

`useCacheFeeder` decodes `data` via `atob` + `Uint8Array` → `Blob` (`audio/mpeg`). The `metadata` object is saved alongside the blob in IDB so subsequent cache hits also carry it.

If a cached chunk 1 record is missing `songMeta` (old cache format), the feeder falls through to a network re-fetch automatically — the record is updated in IDB after the fetch.

### totalChunks and Duration

After chunk 1 is fetched and drained into the `SourceBuffer`, `useStreamedAudio` applies both values from `songMeta`:

- `totalChunks` → replaces `MAX_CHUNKS_GUARD` as the loop upper bound, so the loop exits exactly at the last chunk instead of waiting for an empty blob sentinel.
- `duration` (seconds, calculated from bitrate + file size) → written to `playlistStore.currentSongDuration`, which `AudioPlayer.vue` reads reactively via `storeToRefs` to drive the time chip and seek slider.

The duration is applied **after** `waitForDrain()` on chunk 1, not before, because the audio element ignores `mediaSource.duration` hints until actual data has been appended to the `SourceBuffer`.

### endOfStream

When the for loop has processed all `totalChunks` chunks, after a final `waitForDrain`, it calls `mediaSource.endOfStream()`. This signals the browser that the stream is complete: the audio element finalises the duration and playback can reach the natural end of the song.

### Abort and Cleanup

Every `load()` call creates its own `AbortController`. Calling `stop()` (triggered by song changes or explicit stop) aborts the controller, which:

1. Unblocks any pending `waitForDrain` via `drainReject`
2. Unblocks any pending `throttleIfBufferFull` via the abort event listener
3. Causes `signal.throwIfAborted()` checkpoints in the loop to throw `AbortError`
4. Closes the `MediaSource` and revokes the Object URL

The `AbortError` is caught and swallowed silently — it is not an error, just a clean exit.

---

## Error Handling

| Error | Where caught | Behaviour |
|-------|-------------|-----------|
| `QuotaExceededError` | `pumpQueue` → `pendingPumpError` → `waitForDrain` | Shows "Buffer audio pieno" |
| `NotSupportedError` | outer `catch` in `load()` | Shows format error |
| `InvalidStateError` | outer `catch` in `load()` | Shows player state error |
| Network / fetch error | `API.get` catch | Shows error toast; `undefined` return → `blob` null → breaks the chunk loop |
| `AbortError` | outer `catch` in `load()` | Silent exit (not an error) |

### pendingPumpError

`QuotaExceededError` deserves special attention: `appendBuffer` can throw it **synchronously**, before `waitForDrain` has had a chance to register its `drainReject` callback. Without a workaround, the error would be caught by `pumpQueue` but have nowhere to go — the chunk would be silently dropped and the audio would truncate without any message.

`pendingPumpError` bridges this gap:

```
pumpQueue()
  appendBuffer()  ← throws QuotaExceededError synchronously
  drainReject is null → save error in pendingPumpError

waitForDrain()  ← called next
  pendingPumpError is set → reject immediately with the saved error

outer catch → streamErrorMessage → "Buffer audio pieno"
```