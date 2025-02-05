import { defineStore } from 'pinia';
import { inject, ref, computed } from 'vue';

// using a "setup store" to handle circular reference between API and store
const useAlbumsStore = defineStore('albums', () => {
    const API = inject('API');
    const discs = ref([]);
    const filter = ref('');

    return {
        discs,
        filter,
        // getter
        filteredAlbums: computed(() => {
            const flt = filter.value.toLowerCase();
            return discs.value.filter( cd => 
                    cd.album.toLowerCase().indexOf(flt) >= 0 ||
                    cd.artist.toLowerCase().indexOf(flt) >= 0
            )
        }),
        // actions
        loadAlbums: async function() {
            discs.value = await API.get('/search/albums');
        }
    }
})

/*{
    state: () => ({
        discs: [],
        filter: '',
    }),

    getters: {
        filteredAlbums(state) {
            const flt = state.filter.toLowerCase();
            return state.discs.filter( cd => 
                    cd.album.toLowerCase().indexOf(flt) >= 0 ||
                    cd.artist.toLowerCase().indexOf(flt) >= 0
            )
        },
    },
    
    actions: {
        loadAlbums(val) {
            this.discs = val;
        }
    }
})*/

export default useAlbumsStore;

