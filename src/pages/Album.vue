<script setup>
import { inject, computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import useCollectionStore from '@/stores/collection'
import usePlayerStore from '@/stores/player'
import useCoversStore from '@/stores/covers'

// init stuff
const router = useRouter();
const route = useRoute();
const collectionStore = useCollectionStore();
const playerStore = usePlayerStore();
const coversStore = useCoversStore();

// 
const API = inject('API');
const ImageData = inject('ImageData');

//
const album = collectionStore.getAlbum(route.params.albumid);

// data
const sortedSongs = ref([]);
const selectedSong = ref();
const image = ref(null); // can't have async computed, so I'm using a ref

// watch
watch(selectedSong, (song) => {
    if (song && song?.song_id) {
        playerStore.stream(song.song_id, song.title, song.album, song.artist);
    }
})

// methods 
async function loadCover() {
    const buffer = await coversStore.get(route.params.albumid);
    if (buffer) {
        image.value = ImageData.toBase64(buffer);
    }
    else {
        image.value = null;
    }
}

async function loadSongs() {
    const albumid = route.params.albumid;
    if (albumid) {
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

// init
loadSongs();
loadCover();
</script>

<template>
    <Card class="panel">
        <template #header>
            <img style="width:100%" :src="image" />
        </template>
        <template #title>{{ album.title }}</template>
        <template #subtitle>{{ album.name }}</template>
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