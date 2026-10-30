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

    // ordinamento per pagina: la Collection parte dagli ultimi ascoltati, la pagina Artisti
    // in ordine alfabetico. Il menu sort della toolbar cambia quello della pagina corrente
    const SORT_KEYS = ['name', 'year', 'added', 'played'];
    const DEFAULT_SORT = {
        collection: { by: 'played', dir: 'desc' },
        artists: { by: 'name', dir: 'asc' },
    };
    const sort = ref({
        collection: { ...DEFAULT_SORT.collection },
        artists: { ...DEFAULT_SORT.artists },
    });

    // copia ordinata di list secondo { by, dir }; stringhe senza distinzione maiuscole/minuscole
    function sortList(list, { by, dir }) {
        const inverted = (dir === 'asc') ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[by] ?? '';
            const bv = b[by] ?? '';
            if (typeof av === 'string' && typeof bv === 'string') {
                return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * inverted;
            }
            if (av < bv) {
                return -1 * inverted;
            }
            if (av > bv) {
                return 1 * inverted;
            }
            return 0;
        });
    }

    // re-sort on sort change
    function sortCollection() {
        logger.log("collection: sortBy", sort.value.collection.by, sort.value.collection.dir);
        items.value = sortList(items.value, sort.value.collection);
    }
    watch(() => sort.value.collection, () => {
        sortCollection();
    }, { deep: true });

    // stesso campo: inverte la direzione; campo nuovo: parte dalla sua direzione di default
    function setSort(view, by, defaultDir) {
        if (!SORT_KEYS.includes(by)) {
            logger.error("collection: error sortBy", by);
            return;
        }
        const current = sort.value[view];
        if (current.by === by) {
            current.dir = (current.dir === 'asc') ? 'desc' : 'asc';
        }
        else {
            sort.value[view] = { by, dir: defaultDir };
        }
    }

    // ordinamento di partenza della pagina (aprendola dal menu / dal pulsante home)
    function resetSort(view) {
        if (sort.value[view].by !== DEFAULT_SORT[view].by || sort.value[view].dir !== DEFAULT_SORT[view].dir) {
            sort.value[view] = { ...DEFAULT_SORT[view] };
        }
    }

    // il valore più grande tra a e b, ignorando i null (ultimo ascolto, aggiunta, anno)
    function maxOf(a, b) {
        if (b === null || b === undefined) {
            return a;
        }
        if (a === null || a === undefined || b > a) {
            return b;
        }
        return a;
    }

    return {
        // all the albums, sorted by sort.collection
        items,
        // per-page sort ({ collection, artists }) and its actions (toolbar sort menu)
        sort,
        setSort,
        resetSort,
        // the filter (can be empty to see everyting)
        filter,
        // getter: the filtered collection
        filteredData,
        // getter: the artists page (one entry per artist, with album count), sorted by
        // sort.artists. Anno, aggiunta e ascolto sono i più recenti tra gli album dell'artista
        artists: computed(() => {
            //
            const map = new Map();
            for (const item of filteredData.value) {
                const id = item.artist_id;
                if (map.has(id)) {
                    const artist = map.get(id);
                    artist.albumCount++;
                    artist.year = maxOf(artist.year, item.year);
                    artist.added = maxOf(artist.added, item.added);
                    artist.played = maxOf(artist.played, item.played);
                }
                else {
                    map.set(id, {
                        artist_id: id,
                        name: item.name,
                        albumCount: 1,
                        year: item.year,
                        added: item.added,
                        played: item.played,
                    });
                }
            }
            return sortList(Array.from(map.values()), sort.value.artists);
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
        // un brano dell'album è partito: aggiorna "ultimo ascolto" in locale (played arriva
        // dal server, stesso formato del resto della lista) e riordina se la vista è per
        // "played". Senza, la lista restava ferma finché non si ricaricava dal server
        markPlayed: function(album_id, played) {
            const item = items.value.find(el => el.album_id == album_id);
            if (!item) {
                return;
            }
            item.played = played;
            if (sort.value.collection.by === 'played') {
                sortCollection();
            }
            saveCache();
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