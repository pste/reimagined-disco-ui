import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
// const request = window.indexedDB.open("MyTestDatabase", 3);

const LAST_PLAYED_KEY = 'lastPlayed';
const SHUFFLE_KEY = 'shuffle';

// Fisher-Yates: copia mescolata dell'array
function shuffled(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return out;
}

function readShuffle() {
    try {
        return localStorage.getItem(SHUFFLE_KEY) === '1';
    }
    catch (_) {
        return false;
    }
}

const usePlaylistStore = defineStore('playlist', () => {
    const playList = ref([]);
    const songIndex = ref(-1); // the index into the playList
    const isPlaying = ref(false); // user playback intent: true = user wants music playing
    const currentSongDuration = ref(0); // seconds — set by streamer from chunk 1 metadata
    // shuffle: la playlist resta nell'ordine dell'album (songIndex = indice reale), l'ordine
    // di riproduzione è `order` (permutazione degli indici). Così attivare/disattivare lo
    // shuffle non cambia songIndex e non ricarica il brano in corso
    const shuffle = ref(readShuffle());
    const order = ref([]);

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
        order.value = [];
        songIndex.value = -1;
        currentSongDuration.value = 0;
    }

    // ricostruisce l'ordine di riproduzione a partire dal brano `idx`:
    // shuffle → idx in testa e tutti gli altri mescolati dopo; altrimenti ordine dell'album
    function buildOrder(idx) {
        const all = playList.value.map((_, i) => i);
        if (!shuffle.value || idx < 0) {
            order.value = all;
            return;
        }
        const others = all.filter((i) => i !== idx);
        order.value = [idx, ...shuffled(others)];
    }

    // indice (in playList) del brano che segue/precede `idx` nell'ordine di riproduzione, -1 se nessuno
    function nextIndex(idx) {
        const pos = order.value.indexOf(idx);
        if (pos < 0) {
            return -1;
        }
        return order.value[pos + 1] ?? -1;
    }

    function prevIndex(idx) {
        const pos = order.value.indexOf(idx);
        if (pos <= 0) {
            return -1;
        }
        return order.value[pos - 1];
    }

    function toggleShuffle() {
        shuffle.value = !shuffle.value;
        try {
            localStorage.setItem(SHUFFLE_KEY, shuffle.value ? '1' : '0');
        }
        catch (_) {}
        buildOrder(songIndex.value);
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
            buildOrder(0);
        }
        catch (_) {}
    }

    function enqueue(songs) {
        const list = Array.isArray(songs) ? songs : [songs];
        const first = playList.value.length;
        playList.value.push(...list);
        // i nuovi brani vanno in coda all'ordine di riproduzione (mescolati se shuffle)
        const added = list.map((_, i) => first + i);
        order.value.push(...(shuffle.value ? shuffled(added) : added));
    }

    function inRange(idx) {
        return (idx>=0 && idx<playList.value.length);
    }

    function play(idx) {
        idx = idx || 0;
        if (hasSongs.value && inRange(idx)) {
            songIndex.value = idx;
            buildOrder(idx); // brano scelto dall'utente: con shuffle gli altri, mescolati, vengono dopo
        }
    }

    function stop() {
        songIndex.value = -1;
    }

    function gotoNext() {
        const idx = nextIndex(songIndex.value);
        if (inRange(idx)) {
            songIndex.value = idx;
        }
        else {
            stop();
        }
    }

    function gotoPrev() {
        const idx = prevIndex(songIndex.value);
        if (inRange(idx)) {
            songIndex.value = idx;
        }
    }

    // done
    return {
        playList,
        songIndex,
        isPlaying,
        currentSongDuration,
        shuffle,

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
        nextIndex,
        toggleShuffle,
        // player
        play,
        stop,
        gotoNext,
        gotoPrev,
    }
})

export default usePlaylistStore;