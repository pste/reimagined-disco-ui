<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import MiniDisc from '@/components/MiniDisc.vue'
import useCollectionStore from '@/stores/collection'
import useCoversStore from '@/stores/covers'

//
const router = useRouter();
const collectionStore = useCollectionStore();
const coversStore = useCoversStore();

// rendering progressivo: ~1900 tile tutte insieme bloccavano la pagina prima di mostrare
// qualcosa. Le prime FIRST_BATCH subito, le altre a blocchi nei momenti liberi del browser
const FIRST_BATCH = 60;
const BATCH = 150;
const renderCount = ref(FIRST_BATCH);
const renderedItems = computed(() => collectionStore.items.slice(0, renderCount.value));
let idleHandle = null;

function whenIdle(callback) {
    if ('requestIdleCallback' in window) {
        return requestIdleCallback(callback, { timeout: 200 });
    }
    return setTimeout(callback, 16);
}

function cancelIdle(handle) {
    if ('cancelIdleCallback' in window) {
        cancelIdleCallback(handle);
    }
    else {
        clearTimeout(handle);
    }
}

function renderMore() {
    if (idleHandle !== null) {
        return;
    }
    idleHandle = whenIdle(() => {
        idleHandle = null;
        if (renderCount.value < collectionStore.items.length) {
            renderCount.value += BATCH;
            renderMore();
        }
    });
}

// riparte quando arriva (o cresce) la lista: dalla cache locale o dal server.
// Lo stesso momento avvia lo scaricamento in background delle cover mancanti
watch(() => collectionStore.items.length, (length) => {
    renderMore();
    if (length > 0) {
        coversStore.prefetchAll(collectionStore.items.map((el) => el.album_id));
    }
}, { immediate: true });

onUnmounted(() => {
    if (idleHandle !== null) {
        cancelIdle(idleHandle);
    }
});

// methods
function gotoArtistAlbum(album_id) {
    router.push({ name: 'album', params: { albumid: album_id }});
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
}
</script>

<template>
    <div class="collection-grid w-full px-4 py-6">
        <!-- tutte le tile (a blocchi), il filtro le NASCONDE: toglierlo non ricrea niente -->
        <template v-for="item in renderedItems" :key="item.album_id">
            <MiniDisc
                v-show="collectionStore.filteredIds.has(item.album_id)"
                class="clickable"
                :album_id="item.album_id"
                :artist="item.name"
                :title="item.title"
                :favorite="item.favorite"
                favoritable
                @click="gotoArtistAlbum(item.album_id)"
                @toggle-favorite="collectionStore.toggleFavorite(item.album_id)"
            >
            </MiniDisc>
        </template>
    </div>

    <Button class="scroll-btn scroll-btn-top" icon="pi pi-angle-up" rounded text severity="secondary" size="small" @click="scrollToTop" aria-label="Vai in cima" />
    <Button class="scroll-btn scroll-btn-bottom" icon="pi pi-angle-down" rounded text severity="secondary" size="small" @click="scrollToBottom" aria-label="Vai in fondo" />
</template>

<style scoped>
.scroll-btn {
    position: fixed;
    right: 1rem;
    z-index: 100;
}

.scroll-btn-top {
    top: 4rem;
}

.scroll-btn-bottom {
    bottom: 5rem;
}

@media (max-width: 767px) {
    .scroll-btn-bottom {
        bottom: 10rem;
    }
}

/* .collection-grid è globale in style.css (condivisa con Artists/Artist) */

.list {
    display: inline-block;
}

.shadowed {
    border-radius: 10px;
    box-shadow: 3px 3px 1px 0px #8b8b92, 6px 6px 1px 0px #38383b, 9px 9px 1px 0px #000000;
}
</style>
