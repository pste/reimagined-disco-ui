<script setup>
import { onMounted, watch, useTemplateRef, inject, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import usePlayerStore from '@/stores/player'
import useGlobalsStore from '@/stores/globals'

const API = inject('API');

// store init
const globalsStore = useGlobalsStore();
const playerStore = usePlayerStore();

// refs
const audioElement = useTemplateRef('audioElement');
const { songIndex } = storeToRefs(playerStore);
const playing = ref(false);
const volumeValue = ref(100); // volume slider/ 
const muted = ref(false); // mute button
const songCurrentTime = ref(0); // song time from audioelement updates
const songDuration = ref(0); // song duration from audioelement updates
const sliderTime = ref(0); // time slider
const manualSeek = ref(false); // active while manual seeking on time slider

// computed 
const songTimeText = computed(() => {
  return `${secsToTime(songCurrentTime.value)} / ${secsToTime(songDuration.value)}`
});

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
      playerStore.gotoNext();
  }

  audioElement.value.onerror = (event) => {
      console.log('audioplayer:  Error: ' + audioElement.value.error.code);
      console.log('audioplayer:  Error: ' + audioElement.value.error.message);
      console.log('audioplayer:  Error evt: ' + event.currentTarget.error.code);
      console.log('audioplayer:  Error evt: ' + event.currentTarget.error.message);
      music.stop();
  };

  audioElement.value.addEventListener('playing', (event) => {
    console.log("audioElement.playing", event);
    playing.value = true;
  })

  audioElement.value.addEventListener('pause', (event) => {
    console.log("audioElement.pause", event);
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
      const song_id = playerStore.songId;
      console.log(`audioplayer: running ${song_id}!`);
      API.post('/stream/song', { song_id });
      audioElement.value.src = API.buildURL(globalsStore.apiURL, `/stream/song?id=${song_id}`); // new URL(`/stream/song?id=${song_id}`, globalsStore.apiURL);
      music.play();
    }
    else { // no more songs
      music.stop();
      songDuration.value = 0;
      songCurrentTime.value = 0;
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
  audioElement.value.currentTime = evt.value;
  manualSeek.value = false;
}

function btnPlayClick() {
  if (playerStore.hasSongs) {
      music.play();
  }
}

function btnPauseClick() {
  music.pause();
}
</script>

<template>
  <Toolbar v-show="playerStore.hasSongs" class="app-footer fixed bottom-0 left-0 w-full shadow-6 z-5 p-0">
    <template #start>
      <div class="flex align-items-center gap-2">
        <Button
            v-if="playing"
            icon="pi pi-pause-circle"
            @click="btnPauseClick"
            severity="primary"
            rounded
            text
            aria-label="pause"
        />
        <Button 
            v-else
            :disabled="!playerStore.hasSongs"
            icon="pi pi-play-circle"
            @click="btnPlayClick"
            severity="secondary"
            rounded
            text
            aria-label="play"
        />
        <Chip :label="songTimeText" v-if="songDuration > 0" />
      </div>
    </template>

    <template class="flex-grow-1"  #center>
      <div class="flex-grow-1" >
        <Slider 
            v-model="sliderTime"
            :min="0"
            :max="songDuration"
            @update:modelValue="slideStart"
            @slideend="slideEnd"
            :show-value="false"
            class="slider-bar" 
        />
      </div>
    </template>

    <template #end>
      <div class="flex align-items-center gap-2">
        <Slider 
            v-model="volumeValue" 
            :disabled="muted"
            :min="0" 
            :max="100"
            :show-value="false" 
            style="height: 6px; width: 100px" 
        />
        <Button v-if="muted" @click="muted=false" icon="pi pi-bell"  severity="primary" rounded text aria-label="unmute" />
        <Button v-else       @click="muted=true"  icon="pi pi-bell-slash" severity="secondary" rounded text aria-label="mute" />
      </div>
    </template>
  </Toolbar>

  <audio v-show="false" ref="audioElement" controls></audio>
</template>

<style scoped>
:deep(.p-toolbar-center) {
    flex-grow: 1 !important;
}
</style>