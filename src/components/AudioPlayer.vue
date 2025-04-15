<script setup>
import { watch, useTemplateRef } from 'vue'
import usePlayerStore from '@/stores/player'

//
const audioElement = useTemplateRef('audioElement');
const playerStore = usePlayerStore();

// watch
watch(playerStore, () => {
    if (playerStore.url) {
        audioElement.value.src = playerStore.url;
    }
    else {
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
        audioElement.value.src = "";
    }
})
</script>

<template>
    <audio v-show="playerStore.hasSong" ref="audioElement" controls>
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