import { inject } from 'vue'
import logger from '@/plugins/logger'
import useParametersStore from '@/stores/parameters'
import useCacheStore from '@/stores/cache'

//
const CACHE_TABLE = 'chunks';
const MAX_CHUNKS_GUARD = 500;
const AUDIO_MIME = 'audio/mpeg';

// module-level: dedup concurrent fetches across feeder instances
// key = "${songId}_${chunkId}" → Promise<{ blob, songMeta }>
const inFlight = new Map();

function base64ToBlob(b64) {
    const byteChars = atob(b64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
    }
    return new Blob([byteArray], { type: AUDIO_MIME });
}

export function useCacheFeeder() {
    const API = inject('API');
    const cacheStore = useCacheStore();
    const parametersStore = useParametersStore();

    // Returns { blob, songMeta } — songMeta is populated for chunk 1 (from network or IDB)
    async function getChunk(songId, chunkId, playerMeta) {
        const key = cacheStore.cacheKey(songId, chunkId);

        // get from cache if cached ...
        const cached = await cacheStore.get(CACHE_TABLE, key);
        if (cached?.blob) {
            // chunk 1 must carry songMeta; old cache records lack it → fall through to re-fetch
            if (chunkId !== 1 || cached.songMeta) {
                return { blob: cached.blob, songMeta: cached.songMeta ?? null };
            }
        }

        // get from current request as soon is ready
        if (inFlight.has(key)) return inFlight.get(key);

        // build and exec a chunk (inFlight) request
        const promise = (async () => {
            try {
                const json = await API.get('/chunk/song', { id: songId, chunkIndex: chunkId });
                const blob = json?.data ? base64ToBlob(json.data) : null;
                const songMeta = json?.metadata ?? null;
                const size = blob?.size ?? 0;
                logger.log(`cacheFeeder: fetched song=${songId} chunk=${chunkId} size=${size}`);
                if (blob && size > 0) {
                    await parametersStore.load();
                    const ttlMs = parametersStore.cacheTTLDays * 24 * 60 * 60 * 1000;
                    const record = { blob, songId, chunkId, expiresAt: Date.now() + ttlMs, ttlMs };
                    if (playerMeta) { record.meta = playerMeta; }
                    if (songMeta) { record.songMeta = songMeta; }
                    await cacheStore.put(CACHE_TABLE, key, record);
                }
                return { blob, songMeta };
            }
            finally {
                inFlight.delete(key);
            }
        })();
        inFlight.set(key, promise);
        return promise;
    }

    // background prefetch: warm the cache for a song (fire-and-forget friendly)
    async function prefetch(songId, meta) {
        // stop at totalChunks (known from chunk 1): probing past EOF costs a full
        // re-chunk of the file server-side when its cache has expired
        let maxChunks = MAX_CHUNKS_GUARD;
        for (let chunkId = 1; chunkId <= maxChunks; chunkId++) {
            const { blob, songMeta } = await getChunk(songId, chunkId, meta);
            if (!blob || blob.size === 0) { break; }
            if (chunkId === 1 && (songMeta?.totalChunks ?? 0) > 0) {
                maxChunks = songMeta.totalChunks;
            }
        }
        logger.log(`cacheFeeder: prefetch done for ${songId}`);
    }

    return { getChunk, prefetch }
}
