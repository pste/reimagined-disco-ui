<script setup>
import { inject, computed, ref, watch } from 'vue'
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
const ImageData = inject('ImageData');

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
async function initcomponent() {
  await loadSongs();
  await loadCover();
}
initcomponent();
</script>

<template>
    <div class="flex flex-col md:flex-row" v-if="false">
        <div class="w-full md:w-5/12 flex flex-col items-centerx justify-centerx gap-3s py-5s">
            <img style="width:100%" :src="image" />
        <!--
            <div class="flex flex-col gap-2">
                <label for="username">Username</label>
                <InputText id="username" type="text" />
            </div>
            <div class="flex flex-col gap-2">
                <label for="password">Password</label>
                <InputText id="password" type="password" />
            </div>
            <div class="flex">
                <Button label="Login" icon="pi pi-user" class="w-full max-w-[17.35rem] mx-auto"></Button>
            </div>
        -->
        </div>

        <div class="w-full md:w-2/12">
            <Divider layout="vertical" class="!hidden md:!flex"></Divider>
            <Divider layout="horizontal" class="!flex md:!hidden" align="center"></Divider>
        </div>

        <div class="w-full md:w-5/12 flex items-center justify-center py-5">
            <!--<Button label="Sign Up" icon="pi pi-user-plus" severity="success" class="w-full max-w-[17.35rem] mx-auto"></Button>-->
            <div class="panel">
                <h1>{{ album.title }}</h1>
                <h2>{{ album.name }}</h2>
                <Listbox 
                        v-model="selectedSong" 
                        :options="playerStore.playList"
                        @update:model-value="updatedSelection"
                        optionValue="song_id"
                        optionLabel="title" 
                        class="w-full md:w-56" 
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



    <Card class="panel" v-show="true">
        <template #header>
            <img style="width:100%" :src="image" />
        </template>
        <template #title>{{ album.title }}</template>
        <template #subtitle>{{ album.name }}</template>
        <template #content>
            <Listbox 
                v-model="selectedSong" 
                :options="playerStore.playList"
                @update:model-value="updatedSelection"
                optionValue="song_id"
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