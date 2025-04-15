import { defineStore } from 'pinia';
import { inject, ref, computed } from 'vue';

// using a "setup store" to handle circular reference between API and store
const useCollectionStore = defineStore('collection', () => {
    const API = inject('API');
    const items = ref([]);
    const filter = ref('');
    const filteredData = computed(() => {
        const flt = filter.value.toLowerCase();
        return items.value.filter( el => el.name.toLowerCase().indexOf(flt) >= 0 );
    });

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
        // actions: the artist discography
        getDiscography: function(artist_id) {
            return items.value.filter( el => el.artist_id == artist_id )
        },
        // actions: the artist discography
        getAlbum: function(album_id) {
            return items.value.filter( el => el.album_id == album_id )
        },
        // actions: load and caches the collection
        load: async function() {
            items.value = await API.get('/collection');
        }
    }
})

export default useCollectionStore;