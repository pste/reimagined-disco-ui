import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
// const request = window.indexedDB.open("MyTestDatabase", 3);
const usePlaylistStore = defineStore('playlist', () => {
    const playList = ref([]);
    const songIndex = ref(-1); // the index into the playList

    // computed
    const hasSongs = computed(() => {
        return (playList.value.length > 0);
    })

    const songId = computed(() => {
        if (playList.value.length > 0 && songIndex.value >= 0) {
            return playList.value[songIndex.value].song_id;
        }
        else {
            return 0;
        }
    });

    const albumId = computed(() => {
        if (playList.value.length > 0 && songIndex.value >= 0) {
            return playList.value[songIndex.value].album_id;
        }
        else {
            return 0;
        }
    })

    const isIdle = computed(() => {
        return songIndex.value === -1;
    })

    // inner
    function clear() {
            playList.value = [];
            songIndex.value = -1;
    }

    function enqueue( song ) { // song: {song_id, title, album, artist}
        if (song.song_id) { // single song
            playList.value.push(song);
        }
        else { // album
            playList.value = playList.value.concat(song);
        }
    }

    function inRange(idx) {
        return (idx>=0 && idx<playList.value.length);
    }

    function play(idx) {
        idx = idx || 0;
        if (hasSongs.value && inRange(idx)) {
            songIndex.value = idx;
        }
    }

    function stop() {
        songIndex.value = -1;
    }

    function gotoNext() {
        if (inRange(songIndex.value + 1)) {
            songIndex.value++;
        }
        else {
            stop();
        }
    }

    function gotoPrev() {
        if (inRange(songIndex.value - 1)) {
            songIndex.value--;
        }
    }

    // done
    return {
        playList,
        songIndex,

        // getters
        hasSongs,
        songId,
        albumId,
        isIdle,

        // methods
        clear,
        enqueue,
        // player
        play,
        stop,
        gotoNext,
        gotoPrev,
    }
})

export default usePlaylistStore;