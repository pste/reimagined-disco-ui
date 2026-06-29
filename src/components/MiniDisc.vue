<script setup>
import { ref, watch, onMounted, onUnmounted, useTemplateRef } from 'vue'
import useCoversStore from '@/stores/covers'
import logger from '@/plugins/logger'

const coversStore = useCoversStore();

const props = defineProps({
    album_id: Number,
    artist: String,
    title: String,
    favorite: Boolean,        // stato preferito dell'album
    favoritable: Boolean,     // se true mostra la stella (toggle preferito)
});

const emit = defineEmits(['toggle-favorite']);

const image = ref(null);
const cardEl = useTemplateRef('card');
let observer = null;
let deferredTimer = null;

async function loadImage() {
    const id = props?.album_id;
    const buffer = await coversStore.get(id);
    if (buffer) {
        image.value = URL.createObjectURL(buffer);
    } else {
        logger.log("Disc: cover not found for", id);
        image.value = null;
    }
}

function scheduleLoad() {
    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            teardown();
            loadImage();
        }
    }, { rootMargin: '200px' }); // preload leggermente prima di entrare nel viewport
    observer.observe(cardEl.value);

    // carica il resto dopo che i visibili hanno avuto la precedenza
    deferredTimer = setTimeout(() => {
        teardown();
        loadImage();
    }, 1000);
}

function teardown() {
    observer?.disconnect();
    observer = null;
    clearTimeout(deferredTimer);
    deferredTimer = null;
}

onMounted(() => scheduleLoad());

// se album_id cambia (es. resort), ricarica
watch(() => props.album_id, () => {
    teardown();
    image.value = null;
    scheduleLoad();
});

onUnmounted(() => {
    teardown();
    if (image.value) {
        URL.revokeObjectURL(image.value);
    }
})
</script>

<template>
    <div ref="card" class="flex flex-column surface-card border-round shadow-2 minidisc-card p-1 surface-border">
        <div class="cover-wrap mb-2">
            <div
                :style="{backgroundImage: `url('${image}')`}"
                class="cover w-full border-round bg-gray-100"
            ></div><!-- v-tooltip.bottom="{ value: title, disabled: (title)?false:true}" -->
            <Button
                v-if="favoritable"
                :icon="favorite ? 'pi pi-star-fill' : 'pi pi-star'"
                rounded
                text
                size="small"
                class="fav-btn"
                :class="{ 'fav-on': favorite }"
                @click.stop="emit('toggle-favorite')"
                :aria-label="favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
            />
        </div>
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
.minidisc-card {
    width: 12rem;
}

@media (max-width: 767px) {
    .minidisc-card {
        width: 100%;
    }
}

.cover-wrap {
    position: relative;
}
.cover {
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    width: 100%;
    aspect-ratio: 1 / 1;
}
.fav-btn {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 2rem;
    height: 2rem;
    color: #fff;
    background: rgba(0, 0, 0, 0.35);
}
.fav-btn.fav-on {
    color: var(--yellow-400, #fbbf24);
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