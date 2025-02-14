import { defineStore } from 'pinia';

const useDiscStore = defineStore('disc', {
    state: () => ({
       album_id: null,
       artist: "",
       album: "",
       cover: null,
       songUrl: null,
    }),

    actions: {
        store(item) {
            this.album_id = item.album_id;
            this.artist = item.artist;
            this.album = item.album;
            this.cover = item.cover.data;
        },

        clear() {
            this.album_id = null;
            this.artist = "";
            this.album = "";
            this.cover = null,
            this.songUrl = null;
        },
    }
})

export default useDiscStore;