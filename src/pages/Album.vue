<script setup>
import { inject, ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import useCollectionStore from '@/stores/collection'
import usePlaylistStore from '@/stores/playlist'
import useCoversStore from '@/stores/covers'
import useLoadingStore from '@/stores/loading'
import logger from '@/plugins/logger'
import { useCacheFeeder } from '@/composables/useCacheFeeder'

// init stuff
const route = useRoute();
const collectionStore = useCollectionStore();
const coversStore = useCoversStore();
const playlistStore = usePlaylistStore();
const {songIndex} = storeToRefs(playlistStore);

//
const API = inject('API');
const loadingStore = useLoadingStore();
const feeder = useCacheFeeder();

//
const album = computed(() => collectionStore.getAlbum(route.params.albumid));

// data
const selectedSong = ref(); // id of the song selected
const albumSongs = ref([]); // decouple album songs from playlist songs
const image = ref(null); // can't have async computed, so I'm using a ref
const coverRefreshing = ref(false);

// when the player changes, we update the UI
watch(songIndex, () => {
    logger.log("album: watched playlistStore.songIndex");
    selectedSong.value = playlistStore.songId;
})

// methods
async function refreshCover() {
    coverRefreshing.value = true;
    try {
        const buffer = await coversStore.refresh(route.params.albumid);
        if (buffer) {
            if (image.value) { URL.revokeObjectURL(image.value); }
            image.value = URL.createObjectURL(buffer);
        }
    }
    finally {
        coverRefreshing.value = false;
    }
}

async function loadCover() {
    loadingStore.start();
    try {
        const buffer = await coversStore.get(route.params.albumid); // buffer is a blob
        if (buffer) {
            //logger.log("Album: loadCover", buffer);
            image.value = URL.createObjectURL(buffer);
        }
        else {
            logger.log("Album: cover not found for", route.params.albumid);
            image.value = null;
        }
    }
    finally {
        loadingStore.stop();
    }
}

// load and sort songs
async function loadSongs() {
    const albumid = route.params.albumid;
    if (albumid) {
        loadingStore.start();
        try {
            const songs = await API.get('/search/songs', { albumid });
            const artistName = album.value?.name ?? '';
            const albumTitle = album.value?.title ?? '';
            albumSongs.value = songs.sort( (a,b) => {
                if (a.disc_nr < b.disc_nr) return -1;
                if (a.disc_nr > b.disc_nr) return 1;
                if (a.track_nr < b.track_nr) return -1;
                if (a.track_nr > b.track_nr) return 1;
                return 0;
            }).map(s => ({ ...s, artist: artistName, album: albumTitle }));
        }
        finally {
            loadingStore.stop();
        }
    }
    else {
        logger.error('Bad Route: no album found');
        //router.push({ name: 'login' });
    }
}

// clear queue and restarts playing
async function playFromStart() {
    playlistStore.clear();
    playlistStore.enqueue(albumSongs.value);
    await nextTick(); // let the watcher process songIndex=-1 before setting 0
    playlistStore.isPlaying = true;
    playlistStore.play(0);
    selectedSong.value = playlistStore.songId;
}

// respond to user input over the playlist
async function selectSong(song) {
    selectedSong.value = song.song_id;
    playlistStore.clear();
    playlistStore.enqueue(albumSongs.value);
    await nextTick(); // let the watcher process songIndex=-1 before setting the new index
    playlistStore.isPlaying = true;
    const idx = playlistStore.playList.findIndex(x => x.song_id === song.song_id);
    logger.log("album: selected idx:", idx);
    playlistStore.play(idx);
}

// init
onMounted(async() => {
  await loadSongs();
  await loadCover();
  // update selected song for this view
  if (playlistStore.songId) {
    selectedSong.value = playlistStore.songId;
  }
  // warm the cache for the first track as soon as the album is opened
  const firstSong = albumSongs.value[0];
  if (firstSong) {
    const meta = { title: firstSong.title, artist: firstSong.artist ?? '', album: firstSong.album ?? '' };
    feeder.prefetch(firstSong.song_id, meta).catch(() => {});
  }
})

onUnmounted(() => {
    if (image.value) {
        URL.revokeObjectURL(image.value); // done with the buffer ...
    }
})
</script>

<template>
    <!-- card adattativa responsive -->
    <div class="flex justify-content-center py-6 w-11 md:w-10 lg:w-8 xl:w-7">
        <Card class="album-card w-full">
            <template #content>
                <div class="flex flex-column md:flex-row gap-4">

                    <!-- album cover -->
                    <div class="flex flex-none p-0 align-items-center justify-content-center" style="position: relative">
                        <img style="max-width: 350px" class="w-full h-auto border-round-md shadow-2" :src="image" />
                        <Button
                            icon="pi pi-refresh"
                            severity="secondary"
                            size="small"
                            rounded
                            :loading="coverRefreshing"
                            @click="refreshCover"
                            style="position: absolute; bottom: -1rem; right: -1rem; opacity: 0.85; width: 1.75rem; height: 1.75rem; font-size: 0.75rem"
                            aria-label="Aggiorna cover"
                        />
                    </div>

                    <!-- details and songs -->
                    <div class="flex flex-column flex-grow-1 p-0 justify-content-start">
                        <div class="flex align-items-center gap-2 mb-2">
                            <span class="text-xl font-bold">{{ album?.title }}</span>
                            <Button
                                icon="pi pi-play"
                                rounded
                                text
                                severity="secondary"
                                :disabled="albumSongs.length === 0"
                                @click="playFromStart"
                            />
                        </div>
                        <div class="text-color-secondary mb-3">{{ album?.name }}</div>
                        
                        <div class="flex-grow-1 m-0" >
                            <Listbox
                                v-model="selectedSong"
                                :options="albumSongs"
                                optionValue="song_id"
                                optionLabel="title"
                                class="w-full h-full listbox-espandibile"
                                :listStyle="{ maxHeight: 'unsetx' }"
                            >
                                <template #option="slotProps">
                                    <div class="flex items-center w-full" @click="selectSong(slotProps.option)">
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