<script setup>
import { useRouter } from 'vue-router'
import ArtistDisc from '@/components/ArtistDisc.vue'
import useCollectionStore from '@/stores/collection'

//
const router = useRouter();
const collectionStore = useCollectionStore();

// gli album dell'artista, dal più recente al più vecchio (il primo è la cover frontale)
function stackAlbumIds(artist_id) {
    return collectionStore.getDiscography(artist_id)
        .map(el => el.album_id)
        .reverse();
}

// methods
function gotoArtist(artist_id) {
    router.push({ name: 'artist', params: { artistid: artist_id }});
}
</script>

<template>
    <div class="collection-grid w-full px-4 py-6">
        <template v-for="item in collectionStore.artists" :key="item.artist_id">
            <ArtistDisc
                class="clickable"
                :album_ids="stackAlbumIds(item.artist_id)"
                :artist="item.name"
                :title="`${item.albumCount} album`"
                @click="gotoArtist(item.artist_id)"
            >
            </ArtistDisc>
        </template>
    </div>
</template>
