<script setup>
import { onMounted, watch, useTemplateRef, inject, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import usePlaylistStore from '@/stores/playlist'
import useGlobalsStore from '@/stores/globals'
import logger from '@/plugins/logger'

const API = inject('API');
const router = useRouter();

// store init
const globalsStore = useGlobalsStore();
const playlistStore = usePlaylistStore();

// refs
const audioElement = useTemplateRef('audioElement');
const { songIndex } = storeToRefs(playlistStore);
const playing = ref(false);
const volumeValue = ref(100); // volume slider/ 
const muted = ref(false); // mute button
const songCurrentTime = ref(0); // song time from audioelement updates
const songDuration = ref(0); // song duration from audioelement updates
const sliderTime = ref(0); // time slider
const manualSeek = ref(false); // active while manual seeking on time slider

// formatting utils 
function padTime(time) {
  return (time<10) ? `0${time}`:`${time}`
}
function secsToTime(secs) {
  if (!secs) return '00:00';
  // parse hh mm ss
  const hh = Math.floor(secs/3600);
  const mmss = secs%3600;
  const mm = Math.floor(mmss / 60);
  const ss = Math.floor(mmss % 60);
  if (hh>0) {
    return `${padTime(hh)}:${padTime(mm)}:${padTime(ss)}`;
  }
  else {
    return `${padTime(mm)}:${padTime(ss)}`;
  }
};

// computed 
const songTimeText = computed(() => {
  return `${secsToTime(songCurrentTime.value)} / ${secsToTime(songDuration.value)}`
});

// audioelement player utils
const music = {
  play: function() {
    audioElement.value.play();
  },
  pause: function() {
    audioElement.value.pause();
  },
  stop: function() {
    audioElement.value.pause();
    audioElement.value.currentTime = 0;
    audioElement.value.src = "";
    audioElement.value.removeAttribute('src');
  },
}

// init audioelement events
onMounted(() => {
  audioElement.value.onended = (event) => {
      playlistStore.gotoNext();
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play',          () => music.play());
    navigator.mediaSession.setActionHandler('pause',         () => music.pause());
    navigator.mediaSession.setActionHandler('nexttrack',     () => playlistStore.gotoNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => playlistStore.gotoPrev());
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !playlistStore.isIdle && audioElement.value.paused) {
      music.play();
    }
  });

  audioElement.value.onerror = (event) => {
      logger.log('audioplayer:  Error: ' + audioElement.value.error.code);
      logger.log('audioplayer:  Error: ' + audioElement.value.error.message);
      logger.log('audioplayer:  Error evt: ' + event.currentTarget.error.code);
      logger.log('audioplayer:  Error evt: ' + event.currentTarget.error.message);
      music.stop();
  };

  audioElement.value.addEventListener('playing', (event) => {
    logger.log("audioElement.playing", event);
    playing.value = true;
  })

  audioElement.value.addEventListener('pause', (event) => {
    logger.log("audioElement.pause", event);
    playing.value = false;
  })

  audioElement.value.addEventListener('loadedmetadata', function() {
    songDuration.value = audioElement.value.duration || 0;
  })

  audioElement.value.addEventListener('timeupdate', function() {
    const val = audioElement.value.currentTime || 0;
    songCurrentTime.value = val;
    // updates the slider when not dragging
    if (manualSeek.value === false) {
      sliderTime.value = val;
    }
  })
})

// watch
watch(songIndex, (val) => {
    if (val !== -1) { // changed song index, update audio and play
      const song_id = playlistStore.songId;
      logger.log(`audioplayer: running ${song_id}!`);
      API.post('/stream/song', { song_id });
      audioElement.value.src = API.buildURL(globalsStore.apiURL, `/stream/song?id=${song_id}`); // new URL(`/stream/song?id=${song_id}`, globalsStore.apiURL);
      music.play();
      if ('mediaSession' in navigator) {
        const song = playlistStore.playList[val];
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: song.album,
        });
      }
    }
    else { // no more songs
      music.stop();
      songDuration.value = 0;
      songCurrentTime.value = 0;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    }
})

watch(muted, (val) => {
  audioElement.value.muted = val;
})

watch(volumeValue, (val) => {
  audioElement.value.volume = val / 100;
})

// events
function slideStart() {
  manualSeek.value = true;
}

function slideEnd(evt) {
  const newTime = sliderTime.value; // evt.value
  audioElement.value.currentTime = newTime; // update needed by drag and drop
  manualSeek.value = false;
}

function slideDrag() {
  if (manualSeek.value === false) { // ended drag, needed to update value once more
    const newTime = sliderTime.value;
    audioElement.value.currentTime = newTime; // update needed by single click on timebar
  }
}

function btnPlayClick() {
  if (playlistStore.hasSongs) {
      music.play();
  }
}

function btnPauseClick() {
  music.pause();
}

function gotoDisc() {
  router.push({ name: 'album', params: { albumid: playlistStore.albumId }});
}

function gotoNext() {
  playlistStore.gotoNext();
}

function gotoPrev() {
  playlistStore.gotoPrev();
}
</script>

<template>
  <Toolbar v-show="playlistStore.hasSongs" class="app-footer fixed bottom-0 left-0 w-full shadow-6 z-5 p-0">
    <template #start>
      <div class="player-layout">
        <!-- home -->
        <Button class="p-item p-home" icon="pi pi-bullseye" @click="gotoDisc" severity="secondary" rounded text aria-label="return" />
        <!-- play/pause -->
        <Button v-if="playing" class="p-item p-play" icon="pi pi-pause" @click="btnPauseClick" severity="primary" rounded text aria-label="pause" />
        <Button v-else class="p-item p-play" :disabled="!playlistStore.hasSongs" icon="pi pi-play" @click="btnPlayClick" severity="secondary" rounded text aria-label="play" />
        <!-- time chip -->
        <Chip v-if="songDuration > 0" :label="songTimeText" class="p-item p-time" />
        <!-- prev -->
        <Button class="p-item p-prev" :disabled="!playlistStore.hasSongs" icon="pi pi-backward" @click="gotoPrev" severity="secondary" rounded text aria-label="prev" />
        <!-- time slider row break on mobile -->
        <div class="p-row-break"></div>
        <!-- time slider -->
        <div class="p-item p-slider-time">
          <Slider
              v-model="sliderTime"
              :min="0"
              :max="songDuration"
              @mousedown="slideStart"
              @mouseup="slideEnd"
              @update:modelValue="slideDrag"
              :show-value="false"
          />
        </div>
        <!-- next -->
        <Button class="p-item p-next" :disabled="!playlistStore.hasSongs" icon="pi pi-forward" @click="gotoNext" severity="secondary" rounded text aria-label="next" />
        <!-- volume -->
        <div class="p-item p-vol">
          <Slider v-model="volumeValue" :disabled="muted" :min="0" :max="100" :show-value="false" />
        </div>
        <!-- mute -->
        <Button v-if="muted" class="p-item p-mute" @click="muted=false" icon="pi pi-bell" severity="primary" rounded text aria-label="unmute" />
        <Button v-else        class="p-item p-mute" @click="muted=true"  icon="pi pi-bell-slash" severity="secondary" rounded text aria-label="mute" />
      </div>
    </template>
  </Toolbar>

  <audio v-show="false" ref="audioElement" controls></audio>
</template>

<style scoped>
:deep(.p-toolbar-start) {
  flex: 1;
  min-width: 0;
}

.player-layout {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0 0.5rem;
}

.p-slider-time {
  flex: 1;
  min-width: 0;
}

.p-vol {
  width: 80px;
}

.p-row-break {
  display: none;
}

/* Mobile: two rows */
@media (max-width: 767px) {
  .player-layout {
    flex-wrap: wrap;
    padding: 0.25rem 0.5rem;
    gap: 0.25rem;
  }

  /* Row 1 order */
  .p-home       { order: 1; }
  .p-play       { order: 2; }
  .p-time       { order: 3; }
  .p-vol        { order: 4; width: 60px; margin-left: auto; }
  .p-mute       { order: 5; }

  /* Row break */
  .p-row-break  { order: 6; display: block; width: 100%; flex-basis: 100%; height: 0; }

  /* Row 2 order */
  .p-prev         { order: 7; }
  .p-slider-time  { order: 8; flex: 1; }
  .p-next         { order: 9; }

  /* Larger buttons on mobile */
  :deep(.p-button) {
    width: 3.5rem;
    height: 3.5rem;
  }
  :deep(.p-button .p-button-icon) {
    font-size: 1.25rem;
  }
}
</style>