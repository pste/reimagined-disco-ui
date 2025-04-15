<script setup>
import { inject, ref } from 'vue'
import useCoversStore from '@/stores/covers'

// 
const ImageData = inject('ImageData');
const coversStore = useCoversStore();

// props
const props = defineProps({
    album_id: Number,
    title: String,
})

//
const image = ref(null)
async function loadImage() {
    const buffer = await coversStore.get(props?.album_id);
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
</style>