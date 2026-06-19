import { defineStore } from 'pinia'
import { inject, shallowRef, computed } from 'vue'
import logger from '@/plugins/logger'

const CACHE_TABLE_CHUNKS = 'chunks';
const MAX_CHUNKS_GUARD = 500;

// this maps (and extends !) the idxDB database. On the DB we have typical CRUD commands, here we offer reactivity
// and other functionalities
const useCacheStore = defineStore('cache', () => {
    const idxDB = inject('idxDB');

    // songId → { chunks: Set di chunkId, total } — il Set rende idempotenti i re-put
    // (un upsert dello stesso chunk non deve gonfiare il conteggio)
    const cachedSongMap = shallowRef(new Map()); // ref "leggero"

    // init fire-and-forget (la setup Pinia deve restare sincrona): alla fine FONDE
    // con la Map corrente invece di sovrascriverla, così i put arrivati durante
    // l'init non vanno persi e i metodi non devono aspettare nessuna promise
    initCachedSongMap().then(initial => {
        for (const [songId, entry] of cachedSongMap.value) {
            const target = initial.get(songId);
            if (!target) { initial.set(songId, entry); }
            else {
                entry.chunks.forEach(c => target.chunks.add(c));
                if (!target.total) { target.total = entry.total; }
            }
        }
        cachedSongMap.value = initial;
    });

    // brani COMPLETI in cache (tutti i chunk presenti; il totale è noto dal songMeta del chunk 1)
    const cachedSongIds = computed(() => {
        return [...cachedSongMap.value] // to array of arrays: [ [k,v], [k,v], ... ]
            .filter(([k, v]) => v.total && v.chunks.size >= v.total) // filter only full songs
            .map(([k, v]) => k) // return only array of keys
            ;
    })

    // brani in SCARICAMENTO: totale noto (dal chunk 1) ma non ancora tutti i chunk in cache.
    // Complemento di cachedSongIds: mentre un brano suona (o è in prefetch) la sua cache si
    // riempie e qui compare finché non diventa completo. I record vecchi senza total restano
    // fuori da entrambi (come prima), si risanano al riascolto quando il chunk 1 riporta il songMeta
    const downloadingSongIds = computed(() => {
        return [...cachedSongMap.value]
            .filter(([k, v]) => v.total && v.chunks.size < v.total) // partial songs
            .map(([k, v]) => k)
            ;
    })

    // stato cache iniziale letto dal DB.
    // Lettura readonly (getAll): nessun touch del TTL, nessun download
    async function initCachedSongMap() {
        const cached = new Map();
        const records = await idxDB.getAll(CACHE_TABLE_CHUNKS);
        for (const record of records) {
            addChunk(cached, record.data);
        }
        return cached;
    }

    // registra un chunk nella Map (usata da init e put); `total` arriva solo
    // col songMeta del chunk 1, quindi va backfillato appena disponibile
    function addChunk(map, data) {
        const songId = data?.songId;
        if (songId == null) { return; } // skip malformed records
        if (!map.has(songId)) {
            map.set(songId, { chunks: new Set(), total: 0 });
        }
        const entry = map.get(songId); // this works, is by-ref
        entry.chunks.add(data.chunkId);
        if (!entry.total && data.songMeta?.totalChunks) {
            entry.total = data.songMeta.totalChunks;
        }
    }

    // refresh the shallowRef building a new Map
    function notifyMapChanged() {
        cachedSongMap.value = new Map(cachedSongMap.value);
    }

    // rinnova la scadenza di TUTTI i chunk in cache del brano (idxDB.get fa touch del TTL
    // a ogni lettura): chiamato all'avvio del play, copre anche i chunk di coda che lo
    // streamer non leggerebbe se il brano viene cambiato a metà. Non scarica nulla.
    async function touchSong(songId) {
        for (let chunkId = 1; chunkId <= MAX_CHUNKS_GUARD; chunkId++) {
            const cached = await idxDB.get(CACHE_TABLE_CHUNKS, cacheKey(songId, chunkId));
            if (!cached) { break; }
        }
    }

    // build the key for a song's chunk
    function cacheKey(songId, chunkId) {
        return `${songId}_${chunkId}`;
    }

    // upsert on db, then update the reactive Map
    async function put(tableName, key, record) {
        const rtn = await idxDB.put(tableName, key, record);
        if (tableName === CACHE_TABLE_CHUNKS) {
            addChunk(cachedSongMap.value, record);
            logger.log(`cache: added song=${record.songId} chunk=${record.chunkId}`);
            notifyMapChanged();
        }
        return rtn; // keeping the idxdb operations chain
    }

    // delete all the cached chunks of a song, then update the reactive Map
    async function removeSong(songId) {
        const records = await idxDB.getAll(CACHE_TABLE_CHUNKS);
        for (const record of records) {
            if (record.data?.songId === songId) {
                await idxDB.remove(CACHE_TABLE_CHUNKS, record.id);
            }
        }
        cachedSongMap.value.delete(songId);
        notifyMapChanged();
    }

    // empty the whole chunks cache, then reset the reactive Map
    async function removeAll() {
        const records = await idxDB.getAll(CACHE_TABLE_CHUNKS);
        for (const record of records) {
            await idxDB.remove(CACHE_TABLE_CHUNKS, record.id);
        }
        cachedSongMap.value = new Map();
    }

    // sweep expired chunks, then rebuild the reactive Map from the DB
    async function sweep() {
        const removed = await idxDB.sweep(CACHE_TABLE_CHUNKS);
        if (removed > 0) {
            cachedSongMap.value = await initCachedSongMap();
        }
        return removed;
    }

    return {
        get: idxDB.get,
        getAll: idxDB.getAll,
        put,
        removeSong,
        removeAll,
        sweep,
        cacheKey,
        touchSong,
        //
        cachedSongIds,
        downloadingSongIds,
    }
});

export default useCacheStore;
