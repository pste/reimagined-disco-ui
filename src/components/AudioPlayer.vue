<script setup>
import { watch, useTemplateRef } from 'vue'
import useDiscStore from '@/stores/disc'

//
const discStore = useDiscStore();
const audioElement = useTemplateRef('audioElement');

// watch
watch(discStore, () => {
        if (discStore.songUrl) {
            audioElement.value.src = discStore.songUrl;
        }
})
</script>

<template>
    <audio v-show="discStore.songUrl" ref="audioElement" controls>
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