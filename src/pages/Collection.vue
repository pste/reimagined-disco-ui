<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import MiniDisc from '@/components/MiniDisc.vue'
import useCollectionStore from '@/stores/collection'
import useCoversStore from '@/stores/covers'

//
const router = useRouter();
const collectionStore = useCollectionStore();
const coversStore = useCoversStore();

// paginazione: solo i primi PAGE_SIZE album (dopo filtro e ordinamento), in fondo il
// pulsante per caricare il blocco successivo
const PAGE_SIZE = 50;
const pageCount = ref(1);
const visibleItems = computed(() => collectionStore.filteredData.slice(0, pageCount.value * PAGE_SIZE));
const remaining = computed(() => collectionStore.filteredData.length - visibleItems.value.length);

function loadMore() {
    pageCount.value++;
}

// nuovo filtro o nuovo ordinamento: si riparte dal primo blocco
watch(
    [() => collectionStore.filter.global, () => collectionStore.favoritesOnly, () => collectionStore.sort.collection],
    () => {
        pageCount.value = 1;
    },
    { deep: true }
);

// quando arriva la lista (dalla cache locale o dal server) parte lo scaricamento
// in background delle cover mancanti
watch(() => collectionStore.items.length, (length) => {
    if (length > 0) {
        coversStore.prefetchAll(collectionStore.items.map((el) => el.album_id));
    }
}, { immediate: true });

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
        <template v-for="item in visibleItems" :key="item.album_id">
            <MiniDisc
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

    <div v-if="remaining > 0" class="flex justify-content-center pb-4">
        <Button
            :label="`Load more (${Math.min(remaining, PAGE_SIZE)})`"
            icon="pi pi-angle-down"
            severity="secondary"
            outlined
            @click="loadMore"
        />
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
