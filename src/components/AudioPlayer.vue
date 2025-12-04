<script setup>
import { onMounted, watch, useTemplateRef, inject, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import usePlayerStore from '@/stores/player'
import useGlobalsStore from '@/stores/globals'

const API = inject('API');

//
const globalsStore = useGlobalsStore();

//
const audioElement = useTemplateRef('audioElement');
const playerStore = usePlayerStore();
const { songIndex } = storeToRefs(playerStore);

// formatting utils 
function padTime(time) {
  return (time<10) ? `0${time}`:`${time}`
}
function secsToTime(secs) {
  if (!secs) return '-';
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
  };

  audioElement.value.addEventListener('loadedmetadata', function() {
    songDuration.value = audioElement.value.duration || 0;
  })

  audioElement.value.addEventListener('timeupdate', function() {
    songCurrentTime.value = audioElement.value.currentTime || 0;
  })
})

// refs
const volumeValue = ref(100);
const playing = ref(false);
const muted = ref(false);
const songCurrentTime = ref(0);
const songDuration = ref(0);
const changingTime = ref(false);

// computed 
const songTime = computed(() => {
  return `${secsToTime(songCurrentTime.value)} / ${secsToTime(songDuration.value)}`
});
const sliderTime = computed(() => {
  if (changingTime.value) {
    return sliderTime.value; // returns itself - to not update
  }
  else {
    return songCurrentTime.value;
  }
})

// watch
watch(songIndex, (val) => {
    if (val !== -1) { // changed song index, updaet audio and play
      const song_id = playerStore.songId;
      console.log(`audioplayer: running ${song_id}!`);
      API.post('/stream/song', { song_id });
      audioElement.value.src = new URL(`/stream/song?id=${song_id}`, globalsStore.apiURL);
      music.play();
      //
      playing.value = true;
    }
    else { // no more songs
      music.stop();
      playing.value = false;
      songDuration.value = 0;
      songCurrentTime.value = 0;
    }
})

watch(playing, (val) =>{
  if (val === true) {
    if (playerStore.hasSongs) {
      music.play();
    }
    else { // autostop if no song selected
      playing.value = false;
    }
  }
  else {
    music.pause();
  }
})

// events
function slideStart() {
  changingTime.value = true;
}
function slideEnd(evt) {
  changingTime.value = false;
  audioElement.value.currentTime = evt.value;
}
</script>

<template>
  <Toolbar v-show="playerStore.hasSongs" class="app-footer fixed bottom-0 left-0 w-full shadow-6 z-5 p-0">
    <template #start>
      <div class="flex align-items-center gap-2">
        <Button v-if="playing" icon="pi pi-pause-circle" @click="playing=false" severity="secondary" rounded text aria-label="pause" />
        <Button v-else         icon="pi pi-play-circle"  @click="playing=true"  severity="secondary" rounded text aria-label="play" />
        <Chip :label="songTime" v-if="songDuration > 0" />
      </div>
    </template>

    <template class="flex-grow-1"  #center>
      <div class="flex-grow-1" >
        <Slider :default-value="sliderTime"
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
        <Slider v-model="volumeValue" 
            :min="0" 
            :max="100"
            :show-value="false" 
            style="height: 6px; width: 100px" 
        />
        <Button v-if="muted" @click="muted=false" icon="pi pi-bell"  severity="secondary" rounded text aria-label="unmute" />
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