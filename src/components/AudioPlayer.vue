<script setup>
import { onMounted, watch, useTemplateRef, inject } from 'vue'
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
//
onMounted(() => {
    audioElement.value.onended = (event) => { 
        console.log("audioplayer: neeext!")
        playerStore.gotoNext();
    }

    audioElement.value.onerror = (event) => {
        console.log('audioplayer:  Error: ' + audioElement.value.error.code);
        console.log('audioplayer:  Error: ' + audioElement.value.error.message);
        console.log('audioplayer:  Error evt: ' + event.currentTarget.error.code);
        console.log('audioplayer:  Error evt: ' + event.currentTarget.error.message);
    };
})

// watch
watch(songIndex, (val) => {
    if (val !== -1) {
        const song_id = playerStore.songId;
        console.log(`audioplayer: running ${song_id}!`);
        API.post('/stream/song', { song_id });
        audioElement.value.src = new URL(`/stream/song?id=${song_id}`, globalsStore.apiURL);
        audioElement.value.play();
    }
    else {
        console.log("audioplayer: stopped!")
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
        audioElement.value.src = "";
        audioElement.value.removeAttribute('src');
    }
})
</script>

<template>
    <audio v-show="playerStore.hasSongs" ref="audioElement" class="w-full" controls>
        Your browser does not support the audio tag.
    </audio>
</template>

<style scoped>
audio {
    width: 90%;
}

audio::-webkit-media-controls-panel {
    border: 1px solid var(--p-menubar-border-color);
    border-radius: var(--p-menubar-border-radius);
    background: var(--p-menubar-background);
    color: var(--p-menubar-color);
}
</style>