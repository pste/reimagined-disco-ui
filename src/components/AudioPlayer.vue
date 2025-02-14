<script setup>
import { watch, useTemplateRef } from 'vue'
import useDiscStore from '@/stores/disc'
//import { VueSound } from 'vue-sound'

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
    <!--<vue-sound
        v-if="discStore.songUrl"
        :title="discStore.title"
        :details="discStore.album + ' - ' + discStore.artist"
        :file="discStore.songUrl"
    />-->

    <audio controls class="audio">
        <source ref="audioElement" type="audio/mpeg">
        Your browser does not support the audio tag.
    </audio>
</template>

<style scoped>
.audio {
    width: 100%;
    background: var(--p-menubar-background);
    border: 1px solid var(--p-menubar-border-color);
    border-radius: var(--p-menubar-border-radius);
    color: var(--p-menubar-color);
}
</style>