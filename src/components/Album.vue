<script setup>
import { computed } from 'vue'

// props
const props = defineProps({
    id: Number,
    year: Number,
    genre: String,
    artist: String,
    title: String,
    cover: Object, // type: Buffer, data: Array
})

// computed
const image = computed(() => {
    const buffer = props?.cover?.data;
    if (buffer) {
        const arr = new Uint8Array(buffer);
        const str = String.fromCharCode.apply(null, arr);
        const base64 = btoa(str);
        return `data:image/png;base64, ${base64}`;
    }
    return null;
})
</script>

<template>
     <!-- <img :src="image" />-->
    <div class="album" 
        v-tooltip.bottom="`${title}`"
    >
        <div class="cover" :style="{backgroundImage: `url('${image}')`}"></div>
        <div class="info">
            <span class="artist">{{ artist }}</span>
            <span class="title">{{ title }}</span>
        </div>
    </div>
</template>

<style scoped>
.album {
    border: 2px;
    margin: 10px;
    font-family: Inter var,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;
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
}
</style>