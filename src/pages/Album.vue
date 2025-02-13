<script setup>
import { inject, computed, ref, watch } from 'vue'
import useDiscStore from '@/stores/disc'
import useGlobalsStore from '@/stores/globals'
import usePlayerStore from '@/stores/player'

//
const API = inject('API');
const ImageData = inject('ImageData');
const discStore = useDiscStore();
const globalsStore = useGlobalsStore();
const player = usePlayerStore();

// data
const sortedList = ref([]);
const selectedSong = ref();

// watch
watch(selectedSong, (val) => {
        if (val.song_id) {
            const url = new URL('/song', globalsStore.apiURL);
            player.url =  url + '?id=' + val.song_id;
            player.artist = "";
            player.album = "";
            player.title = "";
        }
})

// computed
const disc = computed(() => {
    return discStore.disc;
})

const songUrl = computed(() => {
    const song_id = selectedSong?.value?.song_id;
    if (song_id) {
        const url = new URL('/song', globalsStore.apiURL);
        return url + '?id=' + song_id;
    }
    return null;
})

const image = computed(() => {
    const buffer = discStore?.disc?.cover?.data;
    if (buffer) {
        return ImageData.toBase64(buffer);
    }
    return null;
})


// methods 
async function loadSongs() {
    if (discStore.disc) {
       const data = await API.get('/search/songs', { albumid: discStore.disc.album_id })
       sortedList.value = data.sort( (a,b) => {
            if (a.disc_nr < b.disc_nr) return -1;
            if (a.disc_nr > b.disc_nr) return 1;
            if (a.track_nr < b.track_nr) return -1;
            if (a.track_nr > b.track_nr) return 1;
            return 0;
        })
    }
    else {
        console.error('Bad Route: no album found');
        //router.push({ name: 'login' });
    }
}

loadSongs();
</script>

<template>
    <Card class="panel">
        <template #header>
            <img style="width:100%" :src="image" />
        </template>
        <template #title>{{ disc.album }}</template>
        <template #subtitle>{{ disc.artist }}</template>
        <template #content>
            <Listbox 
                v-model="selectedSong" 
                :options="sortedList" 
                optionLabel="title" 
                class="w-full md:w-56" 
            />
        </template>
        <template #footer>
            <div class="flex gap-4 mt-1">
                <!--<audio controls >
                    <source :src="songUrl" type="audio/mpeg">
                    Your browser does not support the audio tag.
                </audio>
                <Button label="Play" severity="secondary" outlined class="w-full" />
                <Button label="Stop" class="w-full" />-->
            </div>
        </template>
    </Card>
</template>

<style scoped>
.panel {
  overflow: hidden;
  max-width: 400px;
  margin-top: 10px;
  margin-left: auto;
  margin-right: auto;
}

audio {
    width: 100%;
}
</style>