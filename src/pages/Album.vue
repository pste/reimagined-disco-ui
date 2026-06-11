<script setup>
import { inject, ref, computed, watch, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import useCollectionStore from '@/stores/collection'
import usePlaylistStore from '@/stores/playlist'
import useCoversStore from '@/stores/covers'
import useLoadingStore from '@/stores/loading'
import logger from '@/plugins/logger'
import { useCacheFeeder } from '@/composables/useCacheFeeder'

// init stuff
const route = useRoute();
const router = useRouter();
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
const songListbox = useTemplateRef('songListbox');

// auto-scroll: keep the playing song at the top of the visible list.
// scrolls the listbox container only (not the page); no-op if the playing
// song is not part of the album shown in this view
async function scrollToSelected() {
    await nextTick(); // wait for the selection to render
    const idx = albumSongs.value.findIndex(s => s.song_id === selectedSong.value);
    if (idx < 0) { return; }
    const root = songListbox.value?.$el;
    const container = root?.querySelector('.p-listbox-list-container');
    const option = container?.querySelectorAll('.p-listbox-option')[idx];
    if (!option) { return; }
    const delta = option.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
}

// when the player changes, we update the UI
watch(songIndex, () => {
    logger.log("album: watched playlistStore.songIndex");
    selectedSong.value = playlistStore.songId;
    scrollToSelected();
})

// methods
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
    scrollToSelected();
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
                    <div class="flex flex-none p-0 align-items-center justify-content-center">
                        <img style="max-width: 350px" class="w-full h-auto border-round-md shadow-2" :src="image" />
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
                            <Button
                                icon="pi pi-pencil"
                                rounded
                                text
                                severity="secondary"
                                :disabled="albumSongs.length === 0"
                                @click="router.push({ name: 'album-edit', params: { albumid: route.params.albumid } })"
                                aria-label="Modifica album"
                            />
                        </div>
                        <div class="text-color-secondary mb-3">{{ album?.name }}</div>
                        
                        <div class="flex-grow-1 m-0" >
                            <Listbox
                                ref="songListbox"
                                v-model="selectedSong"
                                :options="albumSongs"
                                optionValue="song_id"
                                optionLabel="title"
                                class="w-full h-full listbox-songs"
                                :listStyle="{ overflowY: 'auto' }"
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

.listbox-songs :deep(.p-listbox-list-container) {
    max-height: 320px;
    overflow-y: auto;
}

@media (max-width: 767px) {
    .listbox-songs :deep(.p-listbox-list-container) {
        max-height: 13vh;
    }
}
</style>