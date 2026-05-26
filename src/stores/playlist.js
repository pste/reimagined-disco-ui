import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
// const request = window.indexedDB.open("MyTestDatabase", 3);

const LAST_PLAYED_KEY = 'lastPlayed';

const usePlaylistStore = defineStore('playlist', () => {
    const playList = ref([]);
    const songIndex = ref(-1); // the index into the playList
    const isPlaying = ref(false); // user playback intent: true = user wants music playing
    const currentSongDuration = ref(0); // seconds — set by streamer from chunk 1 metadata

    // computed
    const hasSongs = computed(() => {
        return (playList.value.length > 0);
    })

    const currentSong = computed(() =>
        songIndex.value >= 0 ? (playList.value[songIndex.value] ?? null) : null
    );

    const songId = computed(() => currentSong.value?.song_id ?? 0);

    const albumId = computed(() => currentSong.value?.album_id ?? 0);

    const isIdle = computed(() => {
        return songIndex.value === -1;
    })

    // inner
    function clear() {
        playList.value = [];
        songIndex.value = -1;
        currentSongDuration.value = 0;
    }

    function saveLastPlayed() {
        localStorage.setItem(LAST_PLAYED_KEY, JSON.stringify(playList.value));
    }

    function restoreLastPlayed() {
        const raw = localStorage.getItem(LAST_PLAYED_KEY);
        if (!raw) return;
        try {
            const songs = JSON.parse(raw);
            if (!Array.isArray(songs) || songs.length === 0) return;
            playList.value = songs;
            songIndex.value = 0;
        }
        catch (_) {}
    }

    function enqueue(songs) {
        const list = Array.isArray(songs) ? songs : [songs];
        playList.value.push(...list);
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
        isPlaying,
        currentSongDuration,

        // getters
        hasSongs,
        currentSong,
        songId,
        albumId,
        isIdle,

        // methods
        clear,
        enqueue,
        saveLastPlayed,
        restoreLastPlayed,
        // player
        play,
        stop,
        gotoNext,
        gotoPrev,
    }
})

export default usePlaylistStore;