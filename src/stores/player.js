import { defineStore } from 'pinia';
// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
// const request = window.indexedDB.open("MyTestDatabase", 3);
const usePlayerStore = defineStore('player', {
    state: () => ({
        //artist: '',
        //album: '',
        //title: '',
        //url: null,

        playList: [],
        songIndex: -1,
        idle: true,
    }),

    getters: {
        hasSongs(state) {
            return (state.playList.length > 0);
        },

        songId(state) {
            if (state.playList.length > 0 && state.songIndex >= 0) {
                return state.playList[state.songIndex].song_id;
            }
            else {
                return 0;
            }
        },
    },

    actions: {
       /* stream(song_id, title, album, artist) {
            const globalsStore = useGlobalsStore();
            const url = new URL('/stream/song', globalsStore.apiURL);
            this.url = url + '?id=' + song_id; // managed by watch on the player component
            this.title = title;
            this.album = album;
            this.artist = artist;
        },*/

        clear() {
            /*this.url = null;
            this.title = '';
            this.album = '';
            this.artist = '';*/
            this.playList = [];
            this.songIndex = -1;
        },

        enqueue( song ) { // song: {song_id, title, album, artist}
            if (song.song_id) {
                this.playList.push(song);
            }
            else {
                this.playList = this.playList.concat(song);
            }
            //
            if (this.songIndex === -1) {
                this.songIndex = 0;
            }
        },

        play(idx) {
            idx = idx || 0;
            if (this.playList.length >= 0 && idx < this.playList.length) {
                this.songIndex = idx;
            }
        },

        stop() {
            this.songIndex = -1;
        },

        pause() {}, // TODO

        gotoNext() {
            if (this.songIndex < this.playList.length) {
                this.songIndex++;
            }
            else {
                this.songIndex = -1;
            }
        },
    }
})

export default usePlayerStore;