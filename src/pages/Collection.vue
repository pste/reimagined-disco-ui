<script setup>
import { computed } from 'vue'
import Album from '@/components/Album.vue'

import useAlbumsStore from '@/stores/albums'
const albumsStore = useAlbumsStore()

// computed
const sortedList = computed(() => {
    return albumsStore.filteredAlbums
    /*.sort( (a,b) => {
        if (a.artist < b.artist) return -1;
        if (a.artist > b.artist) return 1;
        if (a.year < b.year) return -1;
        if (a.year > b.year) return 1;
        return 0;
    });*/
})
</script>

<template>
    <div class="collection">
        <Album v-for="item in sortedList"
            :key="item.album.id"
            :id="item.album_id"
            :artist="item.artist"
            :title="item.album"
            :year="item.year"
            :genre="item.genre"
            :cover="item.cover"
        >
        </Album>
    </div>
</template>

<style scoped>
.collection {
    width: 98vw;
    height: 90vh;
    text-align: left;
}
</style>
