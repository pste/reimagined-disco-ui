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
        stream(song_id, title, album, artist) {
            const globalsStore = useGlobalsStore();
            const url = new URL('/stream/song', globalsStore.apiURL);
            this.url = url + '?id=' + song_id; // managed by watch on the player component
            this.title = title;
            this.album = album;
            this.artist = artist;
        },

        clear() {
            this.url = null;
            this.title = '';
            this.album = '';
            this.artist = '';
        },
    }
})

export default usePlayerStore;