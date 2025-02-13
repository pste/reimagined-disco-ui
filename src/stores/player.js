import { defineStore } from 'pinia';

const usePlayerStore = defineStore('player', {
    state: () => ({
        artist: '',
        album: '',
        title: '',
        url: null,
    }),

    getters: {
        hasSong(state) {
            return state.url !== null;
        },
    },

    actions: {
        load(fileurl) {
            this.file = fileurl;
        },
    }
})

export default usePlayerStore;