<script setup>
import { useRouter } from 'vue-router'
import MiniDisc from '@/components/MiniDisc.vue'
import useCollectionStore from '@/stores/collection'

//
const router = useRouter();
const collectionStore = useCollectionStore();

// methods
function gotoArtist(artist_id) {
    router.push({ name: 'artist', params: { artistid: artist_id }});
}
</script>

<template>
    <div class="collection-grid w-full px-4 py-6">
        <template v-for="item in collectionStore.artists" :key="item.artist_id">
            <MiniDisc
                class="clickable"
                :album_id="item.album_id"
                :artist="item.name"
                :title="`${item.albumCount} album`"
                @click="gotoArtist(item.artist_id)"
            >
            </MiniDisc>
        </template>
    </div>
</template>
