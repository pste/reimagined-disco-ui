import { defineStore } from 'pinia';
import { inject } from 'vue';
import useLoadingStore from '@/stores/loading'
import logger from '@/plugins/logger'

// download contemporanei: le cover richieste da chi le mostra (tile visibili, player,
// pagina album) hanno la precedenza; lo scaricamento in background dell'intera collezione
// usa pochi slot e parte solo quando non c'è niente di visibile in attesa
const MAX_PARALLEL = 4;
const MAX_PARALLEL_BACKGROUND = 2;

// using a "setup store" to handle circular reference between API and store
const useCoversStore = defineStore('covers', () => {
    const API = inject('API');
    const idxDB = inject('idxDB');
    const loadingStore = useLoadingStore();
    // album_id → Blob, oppure null = "l'album non ha cover" (evita di richiederla ogni volta)
    const memCache = new Map();

    // coda a due priorità. pending: album_id → { promise, resolve, high } per unire le
    // richieste doppie dello stesso album (e promuovere a "high" una richiesta in background)
    const highQueue = [];
    const lowQueue = [];
    const pending = new Map();
    let running = 0;
    let backgroundStarted = false;

    // blob vuoto = nessuna cover (l'API risponde 200 senza corpo): lo si salva comunque in
    // IndexedDB come segnaposto, ma verso l'esterno diventa null
    function coverOrNull(blob) {
        return (blob && blob.size > 0) ? blob : null;
    }

    // keepInMemory: solo le cover richieste da chi le mostra; quelle del background vanno
    // solo in IndexedDB (tenerle tutte in memoria vorrebbe dire ~84 MB di Blob)
    async function download(album_id, keepInMemory) {
        const blob = await API.getBlob('/search/cover', { album_id });
        if (blob === undefined) {
            return null; // errore (già mostrato dal client API): niente cache, si riproverà
        }
        await idxDB.put("covers", album_id, blob);
        if (keepInMemory) {
            memCache.set(album_id, coverOrNull(blob));
        }
        return coverOrNull(blob);
    }

    // la prossima dalla coda: prima le visibili; il background solo se non c'è altro
    // e con meno slot. Salta gli album già partiti (una richiesta può stare in entrambe le code)
    function nextFromQueue() {
        while (highQueue.length > 0) {
            const album_id = highQueue.shift();
            if (pending.get(album_id)?.queued) {
                return album_id;
            }
        }
        if (running >= MAX_PARALLEL_BACKGROUND) {
            return null;
        }
        while (lowQueue.length > 0) {
            const album_id = lowQueue.shift();
            if (pending.get(album_id)?.queued) {
                return album_id;
            }
        }
        return null;
    }

    function pump() {
        while (running < MAX_PARALLEL) {
            const album_id = nextFromQueue();
            if (album_id == null) {
                return;
            }
            const job = pending.get(album_id);
            job.queued = false;
            running++;
            // la barra di caricamento solo per le cover che qualcuno sta aspettando
            if (job.high) { loadingStore.start(); }
            download(album_id, job.high)
                .then(job.resolve, (err) => {
                    logger.error('covers: download failed', album_id, err);
                    job.resolve(null);
                })
                .finally(() => {
                    if (job.high) { loadingStore.stop(); }
                    pending.delete(album_id);
                    running--;
                    pump();
                });
        }
    }

    function enqueue(album_id, high) {
        const existing = pending.get(album_id);
        if (existing) {
            // già in background: se ora serve a qualcuno, passa avanti
            if (high && !existing.high && existing.queued) {
                existing.high = true;
                highQueue.push(album_id);
                pump();
            }
            return existing.promise;
        }
        let resolve;
        const promise = new Promise((res) => { resolve = res; });
        pending.set(album_id, { promise, resolve, high, queued: true });
        (high ? highQueue : lowQueue).push(album_id);
        pump();
        return promise;
    }

    return {
        // la cover di un album (Blob) o null. Ordine: memoria → IndexedDB → rete (prioritaria)
        get: async function(album_id) {
            // chiave normalizzata: Collection usa Number, AlbumEdit la route param (string) → stessa entry
            album_id = Number(album_id);
            // 1. in-memory cache
            if (memCache.has(album_id)) {
                return memCache.get(album_id);
            }
            // 2. IndexedDB (undefined = mai scaricata, o record rotto di vecchie versioni)
            const dbCover = await idxDB.get("covers", album_id);
            if (dbCover !== undefined) {
                memCache.set(album_id, coverOrNull(dbCover));
                return coverOrNull(dbCover);
            }
            // 3. network (queued, high priority)
            return enqueue(album_id, true);
        },

        // scarica in background (bassa priorità) le cover non ancora in IndexedDB, così
        // scorrendo la collezione sono già pronte. Una volta per sessione; saltato se il
        // browser segnala il risparmio dati. È un costo una tantum: poi restano in cache
        prefetchAll: async function(album_ids) {
            if (backgroundStarted || navigator.connection?.saveData) {
                return;
            }
            backgroundStarted = true;
            const cached = new Set(await idxDB.getAllKeys("covers"));
            const missing = album_ids.map(Number).filter((id) => !cached.has(id) && !memCache.has(id));
            logger.log(`covers: background prefetch of ${missing.length} covers`);
            for (const album_id of missing) {
                enqueue(album_id, false);
            }
        },

        // aggiorna subito la cache con una cover scelta a mano (Blob), senza passare dal server
        setLocal: async function(album_id, blob) {
            album_id = Number(album_id);
            memCache.set(album_id, blob);
            await idxDB.put("covers", album_id, blob);
        }
    }
})

export default useCoversStore;
