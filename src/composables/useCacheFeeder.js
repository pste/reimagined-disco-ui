import { inject } from 'vue'
import logger from '@/plugins/logger'

const CACHE_TABLE = 'chunks';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gg
const MAX_CHUNKS_GUARD = 100;

// module-level: dedup concurrent fetches across feeder instances
// key = songId*100 + chunkId → Promise<Blob>
const inFlight = new Map();

export function useCacheFeeder() {
    const API = inject('API');
    const idxDB = inject('idxDB');

    // build the key for a song's chunk
    function cacheKey(songId, chunkId) {
        return songId * 100 + chunkId;
    }

    // single entry point for chunk retrieval: cache → in-flight dedup → network
    async function getChunk(songId, chunkId) {
        const key = cacheKey(songId, chunkId);

        const cached = await idxDB.get(CACHE_TABLE, key);
        if (cached?.blob) return cached.blob;

        if (inFlight.has(key)) return inFlight.get(key);

        const promise = (async () => {
            try {
                const blob = await API.getBlob('/chunk/song', {
                    id: songId,
                    chunkIndex: chunkId,
                });
                const size = blob?.size ?? 0;
                logger.log(`cacheFeeder: fetched song=${songId} chunk=${chunkId} size=${size}`);
                if (blob && size > 0) {
                    await idxDB.put(CACHE_TABLE, key, { blob, songId, chunkId, expiresAt: Date.now() + CACHE_TTL_MS, ttlMs: CACHE_TTL_MS });
                }
                return blob;
            }
            finally {
                inFlight.delete(key);
            }
        })();
        inFlight.set(key, promise);
        return promise;
    }

    // background prefetch: warm the cache for a song (fire-and-forget friendly)
    async function prefetch(songId) {
        for (let chunkId = 1; chunkId < MAX_CHUNKS_GUARD; chunkId++) {
            const blob = await getChunk(songId, chunkId);
            if (!blob || blob.size === 0) break;
        }
        logger.log(`cacheFeeder: prefetch done for ${songId}`);
    }

    return { getChunk, prefetch }
}
