<script setup>
import { inject, computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import useDiscStore from '@/stores/disc'

const route = useRoute();

//
const API = inject('API');
const ImageData = inject('ImageData');
const discStore = useDiscStore();

// data
const sortedSongs = ref([]);
const selectedSong = ref();

// watch
watch(selectedSong, (val) => {
        if (val.song_id) {
            discStore.stream(val.song_id, val.title);
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
    const albumid = route.params.albumid;
    if (albumid) {
        const album = await API.get('/search/albums', { albumid });
        discStore.loadAlbum(album[0]); // TODO better way
        //
        const songs = await API.get('/search/songs', { albumid });
        sortedSongs.value = songs.sort( (a,b) => {
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
                :options="sortedSongs" 
                optionLabel="title" 
                class="w-full md:w-56" 
            >
                <template #option="slotProps">
                    <div class="flex items-center">
                        <div>{{ slotProps.option.track_nr }}. {{ slotProps.option.title }}</div>
                    </div>
                </template>
            </Listbox>
        </template>
        <!--<template #footer>
            <div class="flex gap-4 mt-1">
                <AudioPlayer />
            </div>
        </template>-->
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