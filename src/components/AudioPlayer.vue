<script setup>
import { ref, onMounted, watch, useTemplateRef } from 'vue'
import usePlayerStore from '@/stores/player'
import useGlobalsStore from '@/stores/globals'

//
const globalsStore = useGlobalsStore();

//
const nowPlaying = ref();
const audioElement = useTemplateRef('audioElement');
const playerStore = usePlayerStore();

//
onMounted(() => {
    audioElement.value.onended = (event) => { 
        console.log("neeext!")
        playerStore.gotoNext();
    }

    audioElement.value.onerror = (event) => {
        console.log('Player Error: ' + audioElement.value.error.code);
        console.log('Player Error: ' + audioElement.value.error.message);
        console.log('Player Error evt: ' + event.currentTarget.error.code);
        console.log('Player Error evt: ' + event.currentTarget.error.message);
    };
})

// watch
watch(playerStore, () => {
    if (playerStore.hasSongs) {
        console.log("watched player", playerStore.songId)
        if (playerStore.songId !== nowPlaying.value) {
            nowPlaying.value = playerStore.songId;
        }
    }
    else {
        console.log("nope!")
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
        audioElement.value.src = undefined;
        playerStore.idle = true;
    } 
})

watch(nowPlaying, () => {
    console.log("trigger playyying!", nowPlaying.value)
    playerStore.idle = false;
    audioElement.value.src = new URL('/stream/song?id=' + nowPlaying.value, globalsStore.apiURL);
    audioElement.value.play();
})
</script>

<template>
    <audio v-show="playerStore.hasSongs" ref="audioElement" controls>
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