import { defineStore } from 'pinia';
import useGlobalsStore from '@/stores/globals'

const useDiscStore = defineStore('disc', {
    state: () => ({
       album_id: null,
       artist: "",
       album: "",
       cover: null,
       title: "",
       songUrl: null,
    }),

    actions: {
        loadAlbum(item) {
            this.album_id = item.album_id;
            this.artist = item.artist;
            this.album = item.album;
            this.cover = item.cover.data;
        },

        stream(song_id, title) {
            const globalsStore = useGlobalsStore();
            const url = new URL('/stream/song', globalsStore.apiURL);
            this.songUrl = url + '?id=' + song_id;
            this.title = title;
        },

        clear() {
            this.album_id = null;
            this.artist = "";
            this.album = "";
            this.cover = null;
            this.title = "";
            this.songUrl = null;
        },
    }
})

export default useDiscStore;