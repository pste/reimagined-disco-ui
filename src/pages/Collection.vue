<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Disc from '@/components/Disc.vue'
import useCollectionStore from '@/stores/collection'

//
const router = useRouter()
const collectionStore = useCollectionStore();

// computed
const sortedArtists = computed(() => {
    return collectionStore.artists.sort( (a,b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    });
})

// methods
function gotoArtistAlbums(artist_id) {
    router.push({ name: 'albums', params: { artistid: artist_id }});
}
</script>

<template>
    <div class="collection">
        <!--<div class="list" v-for="item in sortedArtists">-->
        <div class="list" v-for="item in collectionStore.filteredData">
            <Disc
                class="shadowed-off clickable"
                :album_id="item.album_id"
                :artist="item.name"
                :title="item.title"
                @click="gotoArtistAlbums(item.artist_id)"
            >
            </Disc>
            <!--<div class="info">
                <span class="artist">{{ item.name }}</span>
            </div>-->
        </div>
    </div>
</template>

<style scoped>
.collection {
    width: 98vw;
    height: 90vh;
    text-align: left;
}
.list {
    display: inline-block;
}
.shadowed {
    border-radius: 10px;
    box-shadow: 3px 3px 1px 0px #8b8b92, 6px 6px 1px 0px #38383b, 9px 9px 1px 0px #000000;
}
</style>
