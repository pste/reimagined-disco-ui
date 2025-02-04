import { defineStore } from 'pinia';

const useAlbumsStore = defineStore('albums', {
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
})

export default useAlbumsStore;

