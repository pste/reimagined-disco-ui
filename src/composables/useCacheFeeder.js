import { inject } from 'vue'
import logger from '@/plugins/logger'
import useParametersStore from '@/stores/parameters'
import useCacheStore from '@/stores/cache'
import useCollectionStore from '@/stores/collection'

//
const CACHE_TABLE = 'chunks';
const MAX_CHUNKS_GUARD = 500;
const AUDIO_MIME = 'audio/mpeg';

// module-level: dedup concurrent fetches across feeder instances
// key = "${songId}_${chunkId}" → Promise<{ blob, songMeta }>
const inFlight = new Map();

// retry dei chunk su errore di rete: backoff 1+2+4+8 = 15s totali, sotto i ~30s
// bufferizzati in avanti dallo streamer → un blip di rete non si sente
const FETCH_RETRY_DELAYS = [1000, 2000, 4000, 8000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const collectionStore = useCollectionStore();

    // Il client API intercetta gli errori e restituisce undefined: una risposta
    // valida è SEMPRE un oggetto ({data} o {data:null} a fine file), quindi undefined
    // = errore. Senza questa distinzione un errore di rete veniva preso per fine brano
    // (blob null → endOfStream → brano successivo). Riprova in silenzio (quiet: niente
    // toast per un blip che poi si risolve), poi lancia l'errore: il toast lo mostra
    // chi chiama (onLoopError dello streamer).
    async function fetchChunkJson(songId, chunkId) {
        for (let attempt = 0; ; attempt++) {
            const json = await API.get('/chunk/song', { id: songId, chunkIndex: chunkId }, { quiet: true });
            if (json) {
                return json;
            }
            if (attempt >= FETCH_RETRY_DELAYS.length) {
                throw new Error(`Impossibile scaricare il brano (chunk ${chunkId})`);
            }
            logger.log(`cacheFeeder: song=${songId} chunk=${chunkId} failed, retry in ${FETCH_RETRY_DELAYS[attempt]}ms`);
            await sleep(FETCH_RETRY_DELAYS[attempt]);
        }
    }

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
                const json = await fetchChunkJson(songId, chunkId);
                const blob = json.data ? base64ToBlob(json.data) : null;
                const songMeta = json.metadata ?? null;
                const size = blob?.size ?? 0;
                logger.log(`cacheFeeder: fetched song=${songId} chunk=${chunkId} size=${size}`);
                if (blob && size > 0) {
                    await parametersStore.load();
                    // i brani di un album preferito hanno un TTL cache più ampio
                    const album_id = playerMeta?.album_id;
                    const favorite = album_id != null && collectionStore.getAlbum(album_id)?.favorite;
                    const days = favorite ? parametersStore.favCacheTTLDays : parametersStore.cacheTTLDays;
                    const ttlMs = days * 24 * 60 * 60 * 1000;
                    const record = { blob, songId, chunkId, expiresAt: Date.now() + ttlMs, ttlMs };
                    if (playerMeta) { record.meta = playerMeta; }
                    if (playerMeta?.album_id != null) { record.album_id = playerMeta.album_id; }
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
