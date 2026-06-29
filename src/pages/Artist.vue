<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MiniDisc from '@/components/MiniDisc.vue'
import useCollectionStore from '@/stores/collection'

//
const route = useRoute();
const router = useRouter();
const collectionStore = useCollectionStore();

// the artist discography, in chronological order
const discography = computed(() => collectionStore.getDiscography(route.params.artistid));
const artistName = computed(() => discography.value[0]?.name ?? '');

// methods
function gotoArtistAlbum(album_id) {
    router.push({ name: 'album', params: { albumid: album_id }});
}
</script>

<template>
    <div class="w-full px-4 py-6">
        <div class="text-xl font-bold mb-3">{{ artistName }}</div>
        <div class="collection-grid w-full">
            <template v-for="item in discography" :key="item.album_id">
                <MiniDisc
                    class="clickable"
                    :album_id="item.album_id"
                    :artist="item.year ? `${item.year}` : ''"
                    :title="item.title"
                    :favorite="item.favorite"
                    favoritable
                    @click="gotoArtistAlbum(item.album_id)"
                    @toggle-favorite="collectionStore.toggleFavorite(item.album_id)"
                >
                </MiniDisc>
            </template>
        </div>
    </div>
</template>
