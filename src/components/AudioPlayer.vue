<script setup>
import { watch, computed, useTemplateRef } from 'vue'
import useDiscStore from '@/stores/disc'

//
const discStore = useDiscStore();
const audioElement = useTemplateRef('audioElement');

// watch
watch(discStore, (val) => {
        if (discStore.songUrl) {
            audioElement.value.src = discStore.songUrl;
            //audioElement.load();
            //audioElement.play();
        }
})
</script>

<template>
    <audio controls preload="auto" ref="audioElement">
        <!--<source :src="songUrl" type="audio/mpeg">-->
        Your browser does not support the audio tag.
    </audio>
</template>

<style scoped>
audio {
    width: 100%;
}
</style>