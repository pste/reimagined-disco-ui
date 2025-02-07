import { defineStore } from 'pinia';
import { inject, ref, computed } from 'vue';

// using a "setup store" to handle circular reference between API and store
const useCollectionStore = defineStore('collection', () => {
    const API = inject('API');
    const items = ref([]);
    const filter = ref('');

    return {
        filter,
        // getter
        filteredData: computed(() => {
            const flt = filter.value.toLowerCase();
            return items.value.filter( el => el.name.toLowerCase().indexOf(flt) >= 0 );
        }),
        // actions
        load: async function() {
            items.value = await API.get('/collection');
        }
    }
})

export default useCollectionStore;

