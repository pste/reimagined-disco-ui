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
        filter,
        // getter
        filteredData,
        artists: computed(() => {
            // needs artist_id, name
            const map = new Map();
            for (const item of filteredData.value) {
                const id = item.artist_id;
                if (map.has(id)) {
                    const item2 = map.get(id);
                    if (item.year > item2.year) {
                        map.set(id, item);
                    }
                }
                else {
                    map.set(id, item);
                }
            }
            return Array.from(map.values())

            /*return filteredData.value.map( item => ( // remove unneded fields
                {
                    artist_id: item.artist_id,
                    name: item.name,
                }
            ))
            .filter((currentValue, index, arr) => { // remove dupes (TODO sort to keep the most recent album?)
                return arr.findIndex( el => el.artist_id === currentValue.artist_id ) === index
            });*/
        }),
        // actions
        load: async function() {
            items.value = await API.get('/collection');
        }
    }
})

export default useCollectionStore;