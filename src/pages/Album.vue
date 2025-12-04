<script setup>
import { inject, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import useCollectionStore from '@/stores/collection'
import usePlayerStore from '@/stores/player'
import useCoversStore from '@/stores/covers'

// init stuff
const router = useRouter();
const route = useRoute();
const collectionStore = useCollectionStore();
const coversStore = useCoversStore();
const playerStore = usePlayerStore();
const {songIndex} = storeToRefs(playerStore);

// 
const API = inject('API');

//
const album = collectionStore.getAlbum(route.params.albumid);

// data
const selectedSong = ref(); // id of the song selected
const image = ref(null); // can't have async computed, so I'm using a ref

// when the player changes, we update the UI
watch(songIndex, () => {
    console.log("album: watched playerstore.songIndex");
    selectedSong.value = playerStore.songId;
})

// methods 
async function loadCover() {
    const buffer = await coversStore.get(route.params.albumid); // buffer is a blob
    if (buffer) {
        //console.log("Album: loadCover", buffer);
        image.value = URL.createObjectURL(buffer);
    }
    else {
        console.log("Album: cover not found for", route.params.albumid);
        image.value = null;
    }
}

async function loadSongs() {
    const albumid = route.params.albumid;
    if (albumid) {
        const songs = await API.get('/search/songs', { albumid });
        const sortedSongs = songs.sort( (a,b) => {
            if (a.disc_nr < b.disc_nr) return -1;
            if (a.disc_nr > b.disc_nr) return 1;
            if (a.track_nr < b.track_nr) return -1;
            if (a.track_nr > b.track_nr) return 1;
            return 0;
        });
        //
        playerStore.clear();
        playerStore.enqueue(sortedSongs);
        //playerStore.play();
        /*if (sortedSongs.length > 0) {
            selectedSong.value = sortedSongs[0].song_id; // select the 1st, starts the player
        }*/
    }
    else {
        console.error('Bad Route: no album found');
        //router.push({ name: 'login' });
    }
}

// respond to user input over the playlist
function updatedSelection() {
    const idx = playerStore.playList.findIndex(x => x.song_id === selectedSong.value);
    console.log("album: selected idx:", idx)
    playerStore.play(idx);
}

// init
onMounted(async() => {
  await loadSongs();
  await loadCover();
})

onUnmounted(() => {
    if (image.value) {
        URL.revokeObjectURL(image.value); // done with the buffer ...
    }
})
</script>

<template>
    <!-- card adattativa responsive -->
    <div class="flex justify-content-center py-6 md:w-10 lg:w-8 xl:w-7">
        <Card class="album-card w-full">
            <template #content>
                <div class="flex flex-column md:flex-row gap-4">

                    <!-- album cover -->
                    <div class="flex flex-none p-0 align-items-center justify-content-center">
                        <img class="w-full h-auto border-round-md shadow-2" :src="image" />
                    </div>

                    <!-- details and songs -->
                    <div class="flex flex-column flex-grow-1 p-0 justify-content-start">
                        <div class="text-xl font-bold mb-2">{{ album.title }}</div>
                        <div class="text-color-secondary mb-3">{{ album.name }}</div>
                        
                        <div class="flex-grow-1 m-0" >
                            <Listbox 
                                v-model="selectedSong" 
                                :options="playerStore.playList"
                                @update:model-value="updatedSelection"
                                optionValue="song_id"
                                optionLabel="title" 
                                class="w-full h-full listbox-espandibile" 
                                :listStyle="{ maxHeight: 'unsetx' }"
                            >
                                <template #option="slotProps">
                                    <div class="flex items-center">
                                        <div>{{ slotProps.option.track_nr }}. {{ slotProps.option.title }}</div>
                                    </div>
                                </template>
                            </Listbox>
                        </div>
                    </div>
                </div>
            </template>
        </Card>
    </div>
</template>

<style scoped>
.album-card {
    max-width: 900px;
}
.max-h-80 {
    max-height: 80vh;
}
/**/
.listbox-espandibile-xx :deep(.p-listbox-list-container) {
  max-height: unset !important;
  overflow-y: auto; /*hidden !important;*/
}
.listbox-espandibile-xx :deep(.p-listbox-list) {
  height: 100%;
}
</style>