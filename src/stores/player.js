import { defineStore } from 'pinia';
import useGlobalsStore from '@/stores/globals'

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
        stream(song_id, title) {
            const globalsStore = useGlobalsStore();
            const url = new URL('/stream/song', globalsStore.apiURL);
            this.songUrl = url + '?id=' + song_id;
            this.title = title;
        },
    }
})

export default usePlayerStore;