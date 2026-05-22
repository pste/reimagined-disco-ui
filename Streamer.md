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
┌─────────────────────────────────────────────────────────────────────┐
│  useCacheFeeder.js                                                  │
│  getChunk()  →  IDB.get()  ──hit──→  Blob                          │
│                     └──miss──→  API.getBlob()  →  network  →  Blob │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Blob
┌───────────────────────────▼─────────────────────────────────────────┐
│  useStreamedAudio.js — for loop                                     │
│  getChunk() → blob.arrayBuffer() → enqueueChunk(buf)               │
│  await waitForDrain()   ←──────────────────────────┐               │
│  await trimBuffer()                                 │               │
└───────────────────────────┬─────────────────────────┼───────────────┘
                            │ queue.push()            │ resolve()
┌───────────────────────────▼─────────────────────────┴───────────────┐
│  queue[]  (internal array)                                          │
│  enqueueChunk() → push + pumpQueue()                                │
│  pumpQueue()    → shift + appendBuffer()                            │
│                   (if updating=true: waits for updateend)           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ appendBuffer(ArrayBuffer)
┌───────────────────────────▼─────────────────────────────────────────┐
│  SourceBuffer  (browser MSE)                                        │
│  appendBuffer()  →  updating=true                                   │
│  [processes data]→  updating=false  →  fires: updateend ───────────┤
│  remove(start,end) ← trimBuffer()                                   │◄─ AudioPlayer
│  endOfStream()     ← end of loop                                    │   currentTime
└───────────────────────────┬─────────────────────────────────────────┘
                            │ decoded audio stream
┌───────────────────────────▼─────────────────────────────────────────┐
│  <audio> element  (browser)                                         │
│  fires: canplay    → earlyPlay() → music.play()   [AudioPlayer.vue] │
│  fires: timeupdate → update slider / time display [AudioPlayer.vue] │
│  fires: ended      → playlistStore.gotoNext()     [AudioPlayer.vue] │
│  fires: error      → music.stop() + showError()   [AudioPlayer.vue] │
└─────────────────────────────────────────────────────────────────────┘
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

The MSE buffer has a size limit (historically ~10 MB in Chrome). To stay within quota, `trimBuffer` is called after each chunk is drained. It removes data that has already been played, keeping a 10-second window behind the current playhead:

```
remove(buffered.start, currentTime - 10)
```

`trimBuffer` is only effective once playback has started and `currentTime` has advanced past ~11 seconds. This is why `AudioPlayer.vue` registers a `canplay` listener — playback starts as soon as the browser has buffered enough data (typically after the first chunk or two), rather than waiting for the entire song to load. Once `currentTime` is moving, `trimBuffer` can continuously free space throughout the load.

### endOfStream

When the for loop receives an empty or null blob from the feeder, it knows the song has no more chunks. After a final `waitForDrain`, it calls `mediaSource.endOfStream()`. This signals the browser that the stream is complete: the audio element finalises the duration and playback can reach the natural end of the song.

### Abort and Cleanup

Every `load()` call creates its own `AbortController`. Calling `stop()` (triggered by song changes or explicit stop) aborts the controller, which:

1. Unblocks any pending `waitForDrain` via `drainReject`
2. Causes `signal.throwIfAborted()` checkpoints in the loop to throw `AbortError`
3. Closes the `MediaSource` and revokes the Object URL

The `AbortError` is caught and swallowed silently — it is not an error, just a clean exit.

---

## Error Handling

| Error | Where caught | Behaviour |
|-------|-------------|-----------|
| `QuotaExceededError` | `pumpQueue` → `pendingPumpError` → `waitForDrain` | Shows "Buffer audio pieno" |
| `NotSupportedError` | outer `catch` in `load()` | Shows format error |
| `InvalidStateError` | outer `catch` in `load()` | Shows player state error |
| Network / fetch error | `API.getBlob` catch | Shows error toast; returns `undefined` which breaks the chunk loop |
| `AbortError` | outer `catch` in `load()` | Silent exit (not an error) |

`QuotaExceededError` deserves special attention: `appendBuffer` can throw it **synchronously**, before `waitForDrain` has had a chance to register its `drainReject` callback. `pendingPumpError` bridges this gap — the error is saved on the synchronous throw and re-thrown on the next `waitForDrain` call.
