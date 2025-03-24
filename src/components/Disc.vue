<script setup>
import { inject, computed, ref } from 'vue'
import useCoversStore from '@/stores/covers'

// 
const ImageData = inject('ImageData');
const coversStore = useCoversStore();

// props
const props = defineProps({
    artist_id: Number,
    year: Number,
    genre: String,
    artist: String,
    title: String,
})

// computed
const image = ref(null)
async function loadImage() {
    const buffer = await coversStore.get(props?.artist_id);
    if (buffer) {
        image.value = ImageData.toBase64(buffer);
    }
}
loadImage()
</script>

<template>
    <div class="album">
        <div    class="cover" 
                :style="{backgroundImage: `url('${image}')`}"
                v-tooltip.bottom="{ value: title, disabled: (title)?false:true}"
        ></div>
    </div>
</template>

<style scoped>
.album {
    border: 2px;
    margin: 10px;
    width: 150px;
    display: inline-block;
}
.cover {
    border-radius: 10px;
    background-color: black;
    background-position: center; /* Center the image */
    background-repeat: no-repeat; /* Do not repeat the image */
    background-size: cover; /* Resize the background image to cover the entire container */
    width: 150px;
    height: 150px;
}
/*
.info {
    width: 150px;
    height: 50px;
}
.artist {
    font-size: .6em;
    display: block;
    text-overflow: ellipsis;
    overflow:hidden;
    white-space: nowrap;
}
.title {
    font-size: .8em;
    display: block;
    text-overflow: ellipsis;
    overflow:hidden;
    white-space: nowrap;
}*/
</style>