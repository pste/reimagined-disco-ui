<script setup>
import { ref, computed, watch, onMounted, onUnmounted, useTemplateRef } from 'vue'
import useCoversStore from '@/stores/covers'
import logger from '@/plugins/logger'

const coversStore = useCoversStore();

const props = defineProps({
    album_ids: Array, // most recent first; the first one is the front cover
    artist: String,
    title: String,
});

const MAX_STACK = 3; // front cover + up to 2 behind
const STACK_OFFSET = 0.45; // rem of diagonal offset between stacked covers

const images = ref([]); // object URLs, front first (albums without cover are skipped)
const cardEl = useTemplateRef('card');
let observer = null;
let deferredTimer = null;

// at least one layer, so the empty gray cover shows when nothing is loaded yet
const layers = computed(() => (images.value.length > 0) ? images.value : [null]);

function layerStyle(i) {
    const n = layers.value.length;
    return {
        backgroundImage: layers.value[i] ? `url('${layers.value[i]}')` : null,
        left: `${i * STACK_OFFSET}rem`,
        top: `${(n - 1 - i) * STACK_OFFSET}rem`,
        width: `calc(100% - ${(n - 1) * STACK_OFFSET}rem)`,
        zIndex: n - i, // front cover on top
    };
}

function revokeImages() {
    for (const url of images.value) {
        URL.revokeObjectURL(url);
    }
    images.value = [];
}

async function loadImages() {
    const ids = (props.album_ids ?? []).slice(0, MAX_STACK);
    const loaded = [];
    for (const id of ids) {
        const buffer = await coversStore.get(id);
        if (buffer) {
            loaded.push(URL.createObjectURL(buffer));
        }
        else {
            logger.log("ArtistDisc: cover not found for", id);
        }
    }
    revokeImages();
    images.value = loaded;
}

function scheduleLoad() {
    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            teardown();
            loadImages();
        }
    }, { rootMargin: '200px' }); // preload leggermente prima di entrare nel viewport
    observer.observe(cardEl.value);

    // carica il resto dopo che i visibili hanno avuto la precedenza
    deferredTimer = setTimeout(() => {
        teardown();
        loadImages();
    }, 1000);
}

function teardown() {
    observer?.disconnect();
    observer = null;
    clearTimeout(deferredTimer);
    deferredTimer = null;
}

onMounted(() => scheduleLoad());

// se la lista album cambia (es. resort), ricarica; il confronto su join() evita
// reload inutili quando il re-render passa un array nuovo ma identico
watch(() => (props.album_ids ?? []).join(), () => {
    teardown();
    revokeImages();
    scheduleLoad();
});

onUnmounted(() => {
    teardown();
    revokeImages();
})
</script>

<template>
    <div ref="card" class="flex flex-column surface-card border-round shadow-2 artistdisc-card p-1 surface-border">
        <div class="stack w-full mb-2">
            <div
                v-for="(img, i) in layers"
                :key="i"
                :style="layerStyle(i)"
                class="stack-cover border-round bg-gray-100"
            ></div>
        </div>
        <div class="flex flex-column">
            <span class="font-bold text-sm text-400 cover-text">
                {{ artist }}
            </span>
            <span class="text-xs text-300 line-height-3 cover-text">
                {{ title }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.artistdisc-card {
    width: 12rem;
}

@media (max-width: 767px) {
    .artistdisc-card {
        width: 100%;
    }
}

/* il contenitore resta quadrato come la cover di MiniDisc;
   le cover impilate sono leggermente più piccole per far spazio agli offset */
.stack {
    position: relative;
    aspect-ratio: 1 / 1;
}

.stack-cover {
    position: absolute;
    aspect-ratio: 1 / 1;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    box-shadow: -1px 1px 2px rgba(0, 0, 0, 0.35); /* stacca i bordi tra i livelli */
}

.cover-text {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}
</style>
