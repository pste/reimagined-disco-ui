<script setup>
import { inject, computed, ref, watch } from 'vue'
import AudioPlayer from '@/components/AudioPlayer.vue'
import useDiscStore from '@/stores/disc'
import useGlobalsStore from '@/stores/globals'

//
const API = inject('API');
const ImageData = inject('ImageData');
const globalsStore = useGlobalsStore();
const discStore = useDiscStore();

// data
const sortedList = ref([]);
const selectedSong = ref();

// watch
watch(selectedSong, (val) => {
        if (val.song_id) {
            const url = new URL('/song', globalsStore.apiURL);
            discStore.songUrl = url + '?id=' + val.song_id;
        }
})

// computed
const image = computed(() => {
    const buffer = discStore.cover;
    if (buffer) {
        return ImageData.toBase64(buffer);
    }
    return null;
})

// methods 
async function loadSongs() {
    if (discStore.album_id) {
       const data = await API.get('/search/songs', { albumid: discStore.album_id })
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
        <template #title>{{ discStore.album }}</template>
        <template #subtitle>{{ discStore.artist }}</template>
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
                <AudioPlayer />
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
</style>