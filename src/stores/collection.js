import { defineStore } from 'pinia';
import { inject, ref, computed, watch } from 'vue';
import logger from '@/plugins/logger'
import useSessionStore from '@/stores/session'
import useLoadingStore from '@/stores/loading'
import useCacheStore from '@/stores/cache'
import useParametersStore from '@/stores/parameters'

// using a "setup store" to handle circular reference between API and store
const useCollectionStore = defineStore('collection', () => {
    const session = useSessionStore();
    const loadingStore = useLoadingStore();
    const sortCollectionBy = computed(() => session.user.preferences.sortCollectionBy);
    const sortCollectionDirection = computed(() => session.user.preferences.sortCollectionDirection);
    //
    const API = inject('API');
    const cacheStore = useCacheStore();
    const parametersStore = useParametersStore();
    const items = ref([]);
    const favoritesOnly = ref(false); // toggle "mostra solo i preferiti" (toolbar)
    const filter = ref({
        global: '', // global search (from toolbar)
        name: '',
        title: ''
    });
    // lista album salvata in localStorage (per utente: preferiti e ascolti sono personali):
    // all'apertura si mostra subito questa, intanto load() la aggiorna dal server
    // (stale-while-revalidate). ~1900 album ≈ 0,5 MB: sta nel limite di localStorage;
    // se non ci sta (o lo storage è bloccato) si va avanti senza cache
    function cacheKey() {
        return `collection:${session.user.name}`;
    }
    function saveCache() {
        try {
            localStorage.setItem(cacheKey(), JSON.stringify(items.value));
        }
        catch (err) {
            logger.log('collection: cache not saved', err);
        }
    }
    function restoreCache() {
        try {
            const raw = localStorage.getItem(cacheKey());
            const cached = raw ? JSON.parse(raw) : null;
            if (Array.isArray(cached) && cached.length > 0) {
                items.value = cached;
                sortCollection();
            }
        }
        catch (err) {
            logger.log('collection: cache not restored', err);
        }
    }

    const filteredData = computed(() => {
        const flt = filter.value.global.toLowerCase();
        return items.value.filter( el =>
            (!favoritesOnly.value || el.favorite) &&
            (el.name.toLowerCase().indexOf(flt) >= 0 ||
             el.title.toLowerCase().indexOf(flt) >= 0) );
    });

    // re-sort on sortBy param change
    function sortCollection() {
        const srt = session.user.preferences.sortCollectionBy;
        const dir = session.user.preferences.sortCollectionDirection;
        logger.log("collection: sortBy", srt, dir);
        // sort by these properties
        if (['name','year','added','played'].includes(srt)) {
            const inverted = (dir === 'asc')? 1: -1;
            items.value = [...items.value].sort( (a,b) => {
                const av = a[srt] ?? '';
                const bv = b[srt] ?? '';
                if (av < bv) return -1 * inverted;
                if (av > bv) return 1 * inverted;
                return 0;
            });
        }
        else {
            logger.error("collection: error sortBy", srt, dir);
        }
    }
    watch(sortCollectionBy, () => {
        sortCollection();
    })
    watch(sortCollectionDirection, () => {
        sortCollection();
    })

    // album che passano il filtro: la griglia della Collection li usa per NASCONDERE le
    // tile escluse (v-show) invece di distruggerle, così togliere il filtro non ricrea niente
    const filteredIds = computed(() => new Set(filteredData.value.map((el) => el.album_id)));

    return {
        // all the albums, sorted (the Collection grid renders these and hides the filtered out)
        items,
        filteredIds,
        // the filter (can be empty to see everyting)
        filter,
        // getter: the filtered collection
        filteredData,
        // getter: the artists page (one entry per artist, with album count)
        artists: computed(() => {
            //
            const map = new Map();
            for (const item of filteredData.value) {
                const id = item.artist_id;
                if (map.has(id)) {
                    const item2 = map.get(id);
                    item2.albumCount++;
                    // keeping only the most recent album info as artist cover
                    // (item has no albumCount, so assign() preserves it)
                    if (item.year > item2.year) {
                        Object.assign(item2, item);
                    }
                }
                else {
                    map.set(id, { ...item, albumCount: 1 });
                }
            }
            return Array.from(map.values())
        }),
        //
        resetFilter: function() {
            filter.value = {
                global: '',
                name: '',
                title: ''
            }
        },
        // actions: the artist discography, in chronological order
        getDiscography: function(artist_id) {
            return items.value
                .filter( el => el.artist_id == artist_id )
                .sort( (a,b) => {
                    const av = a.year ?? '';
                    const bv = b.year ?? '';
                    if (av < bv) return -1;
                    if (av > bv) return 1;
                    return 0;
                });
        },
        // actions: a single album info
        getAlbum: function(album_id) {
            const found = items.value.filter( el => el.album_id == album_id );
            if (found.length === 1) {
                return found[0];
            }
            else {
                logger.error(`collection: album ${album_id} not found!`)
                return null;
            }
        },
        updateAlbum: function(album_id, patch) {
            const item = items.value.find(el => el.album_id == album_id);
            if (item) {
                Object.assign(item, patch);
                saveCache();
            }
        },
        // the toolbar toggle "show only favorites"
        favoritesOnly,
        // actions: toggle preferito su un album (per utente). Update ottimistico + persistenza;
        // al toggle-ON rinnova subito il TTL dei chunk già in cache dell'album col TTL preferiti
        toggleFavorite: async function(album_id) {
            const item = items.value.find(el => el.album_id == album_id);
            if (!item) {
                logger.error(`collection: toggleFavorite album ${album_id} not found!`);
                return;
            }
            const next = !item.favorite;
            item.favorite = next; // ottimistico
            try {
                // su errore l'API client non lancia (toast + undefined): rollback esplicito
                const res = await API.post('/favorite', { album_id: item.album_id, favorite: next });
                if (!res?.ok) {
                    item.favorite = !next;
                    return;
                }
                saveCache();
                if (next) {
                    await parametersStore.load();
                    const ttlMs = parametersStore.favCacheTTLDays * 24 * 60 * 60 * 1000;
                    await cacheStore.retagAlbumTTL(Number(album_id), ttlMs);
                }
            }
            catch (err) {
                item.favorite = !next; // rollback
                logger.error('collection: toggleFavorite failed', err);
            }
        },
        // actions: load and caches the whole collection
        load: async function() {
            // prima apertura della sessione: subito la lista salvata, poi quella del server
            if (items.value.length === 0) {
                restoreCache();
            }
            loadingStore.start();
            try {
                // su errore l'API client mostra il toast e restituisce undefined:
                // si tengono i dati precedenti (filteredData va in crash su undefined)
                const data = await API.get('/collection');
                if (data) {
                    items.value = data;
                    sortCollection();
                    saveCache();
                }
            }
            finally {
                loadingStore.stop();
            }
        },
    }
})

export default useCollectionStore;