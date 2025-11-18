import { defineStore } from 'pinia';
import { inject, ref, computed, watch } from 'vue';

import useSessionStore from '@/stores/session'

// using a "setup store" to handle circular reference between API and store
const useCollectionStore = defineStore('collection', () => {
    const session = useSessionStore();
    const sortCollectionBy = computed(() => session.user.preferences.sortCollectionBy);
    const sortCollectionDirection = computed(() => session.user.preferences.sortCollectionDirection);
    //
    const API = inject('API');
    const items = ref([]);
    const filter = ref({
        global: '', // global search (from toolbar)
        name: '',
        title: ''
    });
    const filteredData = computed(() => {
        const flt = filter.value.global.toLowerCase();
        return items.value.filter( el => 
            el.name.toLowerCase().indexOf(flt) >= 0 || 
            el.title.toLowerCase().indexOf(flt) >= 0 );
    });

    // re-sort on sortBy param change
    function sortCollection() {
        const srt = session.user.preferences.sortCollectionBy;
        const dir = session.user.preferences.sortCollectionDirection;
        // sort by these properties
        if (['name','year','added','played'].includes(srt)) {
            const inverted = (dir === 'asc')? 1: -1;
            items.value = items.value.sort( (a,b) => {
                if (a[srt] < b[srt]) return -1 * inverted;
                if (a[srt] > b[srt]) return 1 * inverted;
                return 0;
            });
        }
        else {
            console.error("collection: error sortBy", srt, dir);
        }
    }
    watch(sortCollectionBy, () => {
        sortCollection();
    })
    watch(sortCollectionDirection, () => {
        sortCollection();
    })

    return {
        // the filter (can be empty to see everyting)
        filter,
        // getter: the filtered collection
        filteredData,
        // getter: the collection page (all of the artists)
        artists: computed(() => {
            //
            const map = new Map();
            for (const item of filteredData.value) {
                const id = item.artist_id;
                if (map.has(id)) {
                    const item2 = map.get(id);
                    // keeping only the most recent album info as artist cover
                    if (item.year > item2.year) {
                        map.set(id, item);
                    }
                }
                else {
                    map.set(id, item);
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
        // actions: the artist discography
        /*getDiscography: function(artist_id) {
            return items.value.filter( el => el.artist_id == artist_id )
        },*/
        // actions: the artist discography
        getAlbum: function(album_id) {
            const found = items.value.filter( el => el.album_id == album_id );
            if (found.length === 1) {
                return found[0];
            }
            else {
                console.error(`collection: album ${album_id} not found!`)
                return null;
            }
        },
        // actions: load and caches the whole collection
        load: async function() {
            items.value = await API.get('/collection');
        },
    }
})

export default useCollectionStore;