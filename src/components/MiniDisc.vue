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
    <div class="flex flex-column surface-card border-round shadow-2 w-12rem p-1 surface-border">
        <div 
            :style="{backgroundImage: `url('${image}')`}"
            class="cover w-full h-12rem border-round mb-2 bg-gray-100"
        ></div><!-- v-tooltip.bottom="{ value: title, disabled: (title)?false:true}" -->
        <div class="flex flex-column">
            <span class="font-bold text-sm text-400 cover-text">
                {{ artist }}
            </span>
            <span class="text-xs text-300 line-height-3 cover-text">
                {{title}}
            </span>
        </div>
    </div>
</template>

<style scoped>
.cover {
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    width: 100%;
    height: 8rem; /* Altezza fissa obbligatoria - vedi h-9rem */
}
.cover-text {
    text-overflow: ellipsis;
    overflow:hidden;
    white-space: nowrap;
}

/*
.album {
    border: 2px;
    margin: 10px;
    width: 150px;
    display: inline-block;
}
.cover {
    x-border-radius: 10px;
    background-color: black;
    background-position: center; // Center the image 
    background-repeat: no-repeat; // Do not repeat the image 
    background-size: cover; // Resize the background image to cover the entire container 
    width: 100%;
    height: 80%;
}
.info {
    width: 100%;
    height: 20%;
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
}*/
</style>