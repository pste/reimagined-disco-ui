<script setup>
import { onMounted, watch, useTemplateRef, inject, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import usePlaylistStore from '@/stores/playlist'
import useCoversStore from '@/stores/covers'
import useCacheStore from '@/stores/cache'
import { useStreamedAudio } from '@/composables/useStreamedAudio'
import { useCacheFeeder } from '@/composables/useCacheFeeder'
import logger from '@/plugins/logger'

const API = inject('API');
const router = useRouter();

// store init
const playlistStore = usePlaylistStore();
const coversStore = useCoversStore();
const cacheStore = useCacheStore();

// streamed audio (MSE, chunks pulled via the cache feeder)
const streamer = useStreamedAudio();
// feeder: used here to prefetch the next song in background (warm the IDB cache)
// and to refresh the cache TTL of the song being played (touchSong)
const feeder = useCacheFeeder();

let coverObjectURL = null;

// refs
const audioElement = useTemplateRef('audioElement');
const { songIndex, isPlaying, currentSongDuration: songDuration, currentSong } = storeToRefs(playlistStore);
const volumeValue = ref(100); // volume slider/ 
const muted = ref(false); // mute button
const songCurrentTime = ref(0); // song time from audioelement updates
const sliderTime = ref(0); // time slider
const manualSeek = ref(false); // active while manual seeking on time slider
const showRemaining = ref(false); // toggle elapsed ↔ remaining
const buffering = ref(false); // true while initial load or mid-playback stall

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
  if (songDuration.value > 0) {
    if (showRemaining.value) {
      const remaining = songDuration.value - songCurrentTime.value;
      return `-${secsToTime(remaining)} / ${secsToTime(songDuration.value)}`;
    }
    return `${secsToTime(songCurrentTime.value)} / ${secsToTime(songDuration.value)}`;
  }
  if (songCurrentTime.value > 0) {
    return `${secsToTime(songCurrentTime.value)} / -`;
  }
  return '- / -';
});

// audioelement player utils
const music = {
  play: function() {
    audioElement.value.play().catch(err => {
      logger.log('audioplayer: play() rejected', err);
      isPlaying.value = false;
    });
  },
  pause: function() {
    audioElement.value.pause();
  },
  stop: function() {
    audioElement.value.pause();
    audioElement.value.currentTime = 0;
    streamer.stop();
    audioElement.value.src = "";
    audioElement.value.removeAttribute('src');
  },
}

// init audioelement events
onMounted(() => {
  streamer.sweep();

  audioElement.value.onended = (event) => {
      isPlaying.value = true; // ended != stopped: user intent remains "play" (es: gotoNext)
      playlistStore.gotoNext();
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play',          () => { isPlaying.value = true;  music.play(); });
    navigator.mediaSession.setActionHandler('pause',         () => { isPlaying.value = false; music.pause(); });
    navigator.mediaSession.setActionHandler('nexttrack',     () => playlistStore.gotoNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => playlistStore.gotoPrev());
  }

  // resume only if user intent is "play" (isPlaying): a pause from the Android
  // notification must not be overridden when the app comes back to foreground
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isPlaying.value && audioElement.value.paused) {
      music.play();
    }
  });

  audioElement.value.onerror = (event) => {
      logger.log('audioplayer:  Error: ' + audioElement.value.error.code);
      logger.log('audioplayer:  Error: ' + audioElement.value.error.message);
      logger.log('audioplayer:  Error evt: ' + event.currentTarget.error.code);
      logger.log('audioplayer:  Error evt: ' + event.currentTarget.error.message);
      buffering.value = false;
      isPlaying.value = false;
      music.stop();
  };

  audioElement.value.addEventListener('waiting', () => { buffering.value = true; });
  audioElement.value.addEventListener('playing', () => { buffering.value = false; });

  // sync isPlaying with the real audio element state (handles phone calls, system interruptions)
  // and keep the media session playbackState aligned (Android notification play/pause icon)
  audioElement.value.addEventListener('play',  () => {
    isPlaying.value = true;
    if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'playing'; }
  });
  audioElement.value.addEventListener('pause', () => {
    isPlaying.value = false;
    if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'paused'; }
  });

  audioElement.value.addEventListener('timeupdate', function() {
    const val = audioElement.value.currentTime || 0;
    songCurrentTime.value = val;
    // updates the slider when not dragging
    if (manualSeek.value === false) {
      sliderTime.value = val;
    }
    // progress bar in the Android notification
    if ('mediaSession' in navigator && songDuration.value > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: songDuration.value,
          position: Math.min(val, songDuration.value), // position > duration throws
          playbackRate: audioElement.value.playbackRate,
        });
      }
      catch (_) { /* ignore */ }
    }
  })
})

// media session metadata (Android notification): set text right away, then
// add the artwork when the cover arrives (coversStore.get may hit the network)
async function updateMediaSession(song, val) {
  if (!('mediaSession' in navigator)) { return; }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
  });
  let blob = null;
  try {
    blob = await coversStore.get(song.album_id);
  }
  catch (err) {
    logger.log('audioplayer: cover for media session failed', err);
  }
  // bail if songIndex changed while fetching the cover (user skipped song)
  if (songIndex.value !== val || !blob) { return; }
  coverObjectURL = URL.createObjectURL(blob);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: [{ src: coverObjectURL, type: blob.type }],
  });
}

// watch
watch(songIndex, async (val) => {
    if (coverObjectURL) {
      URL.revokeObjectURL(coverObjectURL);
      coverObjectURL = null;
    }
    // got another song to play
    if (val !== -1) {
      const shouldPlay = isPlaying.value;
      const song = playlistStore.playList[val];
      const song_id = playlistStore.songId;

      logger.log(`audioplayer: ${shouldPlay ? 'running' : 'loading'} ${song_id}`);
      playlistStore.saveLastPlayed();
      buffering.value = true;
      songDuration.value = 0;

      const playerMeta = { title: song.title, artist: song.artist ?? '', album: song.album ?? '' };

      // fire-and-forget: streamer.load below resolves near the END of the song
      // (backpressure keeps ~30s buffered ahead), so the notification must not wait for it
      updateMediaSession(song, val);

      // play = rinnovo della scadenza cache di TUTTO il brano (fire-and-forget):
      // lo streamer legge i chunk progressivamente, da solo non coprirebbe la coda
      // se il brano viene cambiato a metà
      cacheStore.touchSong(song_id).catch(() => {});

      API.post('/stream/song', { song_id });
      // start playing as soon as the browser has enough data buffered (before full load)
      // so trimBuffer can work during the loading phase and prevent MSE quota overflow
      const earlyPlay = () => { buffering.value = false; if (isPlaying.value) { music.play(); } };
      audioElement.value.addEventListener('canplay', earlyPlay, { once: true });

      // warm the cache for the next track as soon as this one can play: waiting for
      // streamer.load() would start the prefetch only near the END of the current song
      // (backpressure), leaving the next track cold for most of the playback
      const prefetchNext = () => {
        const nextSong = playlistStore.playList[val + 1];
        // bail if songIndex changed meanwhile (user skipped song)
        if (songIndex.value !== val || !nextSong?.song_id) { return; }
        const nextMeta = { title: nextSong.title, artist: nextSong.artist ?? '', album: nextSong.album ?? '' };
        feeder.prefetch(nextSong.song_id, nextMeta).catch((err) => {
          logger.log('audioplayer: prefetch next failed', err);
        });
      };
      audioElement.value.addEventListener('canplay', prefetchNext, { once: true });

      await streamer.load(audioElement.value, song_id, playerMeta);

      audioElement.value.removeEventListener('canplay', earlyPlay);
      // bail if songIndex changed while loading (user skipped song)
      if (songIndex.value !== val) { return; }

      if (shouldPlay) {
        music.play();
      }
    }
    else { // no more songs
      buffering.value = false;
      isPlaying.value = false;
      music.stop();
      songDuration.value = 0;
      songCurrentTime.value = 0;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
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
      isPlaying.value = true;
      music.play();
  }
}

function btnPauseClick() {
  isPlaying.value = false;
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

function skipBack() {
  const newTime = sliderTime.value - 15;
  audioElement.value.currentTime = newTime; // update needed by single click on timebar
}

function skipForward() {
  const newTime = sliderTime.value + 15;
  audioElement.value.currentTime = newTime; // update needed by single click on timebar
}
</script>

<template>
  <Toolbar v-show="playlistStore.hasSongs" class="app-footer fixed bottom-0 left-0 w-full shadow-6 z-5 p-0">
    <template #start>
      <div class="player-wrap">
        <!-- song info row -->
        <div v-if="currentSong" class="song-info-row">
          <span class="song-artist">{{ currentSong.artist }}</span>
          <span class="song-sep"> · </span>
          <span class="song-album">{{ currentSong.album }}</span>
          <span class="song-sep"> · </span>
          <span class="song-title">{{ currentSong.title }}</span>
        </div>
      <div class="player-layout">
        <!-- home -->
        <Button class="p-item p-home" icon="pi pi-bullseye" @click="gotoDisc" severity="secondary" rounded text aria-label="return" />
        <!-- play/pause/loading -->
        <Button v-if="buffering" class="p-item p-play" :loading="true" severity="secondary" rounded text aria-label="caricamento" />
        <Button v-else-if="isPlaying" class="p-item p-play" icon="pi pi-pause" @click="btnPauseClick" severity="primary" rounded text aria-label="pause" />
        <Button v-else class="p-item p-play" :disabled="!playlistStore.hasSongs" icon="pi pi-play" @click="btnPlayClick" severity="secondary" rounded text aria-label="play" />
        <!-- time chip -->
        <Chip v-if="currentSong" :label="songTimeText" class="p-item p-time" style="cursor:pointer" @click="showRemaining = !showRemaining" />
        <!-- prev -->
        <Button class="p-item p-prev" :disabled="!playlistStore.hasSongs" icon="pi pi-fast-backward" @click="gotoPrev" severity="secondary" rounded text aria-label="prev" />
        <!-- skip back -->
        <Button class="p-item p-skip-back" :disabled="!playlistStore.hasSongs" icon="pi pi-backward" @click="skipBack" severity="secondary" rounded text aria-label="skip-back" />
        <!-- time slider row break on mobile -->
        <div class="p-row-break"></div>
        <!-- time slider -->
        <div class="p-item p-slider-time">
          <Slider
              v-model="sliderTime"
              :min="0"
              :max="songDuration > 0 ? songDuration : 1"
              :disabled="songDuration === 0"
              @mousedown="slideStart"
              @mouseup="slideEnd"
              @update:modelValue="slideDrag"
              :show-value="false"
          />
        </div>
        <!-- skip forward -->
        <Button class="p-item p-skip-fw" :disabled="!playlistStore.hasSongs" icon="pi pi-forward" @click="skipForward" severity="secondary" rounded text aria-label="next" />
        <!-- next -->
        <Button class="p-item p-next" :disabled="!playlistStore.hasSongs" icon="pi pi-fast-forward" @click="gotoNext" severity="secondary" rounded text aria-label="next" />
        <!-- volume -->
        <div class="p-item p-vol">
          <Slider v-model="volumeValue" :disabled="muted" :min="0" :max="100" :show-value="false" />
        </div>
        <!-- mute -->
        <Button v-if="muted" class="p-item p-mute" @click="muted=false" icon="pi pi-bell" severity="primary" rounded text aria-label="unmute" />
        <Button v-else        class="p-item p-mute" @click="muted=true"  icon="pi pi-bell-slash" severity="secondary" rounded text aria-label="mute" />
      </div>
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

.player-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.song-info-row {
  padding: 0.3rem 0.75rem 0;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.75;
}

.song-sep {
  opacity: 0.5;
}

.song-title {
  font-weight: 600;
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
  .p-skip-back    { order: 8; }
  .p-slider-time  { order: 9; flex: 1; }
  .p-skip-fw      { order: 10; }
  .p-next         { order: 11; }

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