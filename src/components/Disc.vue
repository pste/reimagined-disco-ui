<script setup>
import { ref, watch, onUnmounted } from 'vue'
import useCoversStore from '@/stores/covers'

// 
const coversStore = useCoversStore();

// props
const props = defineProps({
    album_id: Number,
    artist: String,
    title: String,
});

//
const image = ref(null);
watch(
    () => props.album_id, // watch on a getter from the props
    loadImage,
    { immediate: true },
);
async function loadImage() {
    const id = props?.album_id;
    const buffer = await coversStore.get(id); // buffer is a blob
    if (buffer) {
        //console.log("Disc: loadCover", buffer);
        image.value = URL.createObjectURL(buffer);
    }
    else {
        console.log("Disc: cover not found for", id);
        image.value = null;
    }
}

onUnmounted(() => {
    if (image.value) {
        URL.revokeObjectURL(image.value); // done with the buffer ...
    }
})
</script>

<template>
    <div class="album">
        <div    class="cover" 
                :style="{backgroundImage: `url('${image}')`}"
                v-tooltip.bottom="{ value: title, disabled: (title)?false:true}"
        ></div>
        <div class="info">
            <span class="artist">{{ artist }}</span>
            <span class="title" >{{ title }}</span>
        </div>
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
.info {
    width: 150px;
    height: 50px;
}
.artist-old {
    font-size: .9em;
    display: block;
    text-overflow: ellipsis;
    overflow:hidden;
    white-space: nowrap;
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