<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Disc from '@/components/Disc.vue'
import useCollectionStore from '@/stores/collection'

// init stuff
const router = useRouter();
const route = useRoute();
const collectionStore = useCollectionStore();

//
const artistid = route.params.artistid;
const sortedList = collectionStore.getDiscography(artistid);

// computed
const artistName = computed(() => {
    if (sortedList.length > 0) {
        return sortedList[0].name;
    }
    return '...'
})

function albumTitle(item) {
    if (item.year) {
        return `${item.year}. ${item.title}`;
    }
    else {
        return item.title;
    }
}

// methods
function gotoAlbum(disc) {
    // discStore.album(disc);
    router.push({ name: 'album', params: { albumid: disc.album_id }});
}
</script>

<template>
    <Toolbar class="artistname">
        <template #center>
            {{ artistName }}
        </template>
    </Toolbar>

    <div class="collection">
        <div class="list" v-for="item in sortedList">
            <Disc class="clickable"
                :album_id="item.album_id"
                :title="item.title"
                @click="gotoAlbum(item)"
            >
            </Disc>
            <div class="info">
                <span class="artist">{{ item.name }}</span>
                <span class="title" >{{ albumTitle(item) }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.artistname {
    margin-top: 10px;
    text-align: center;
    background-color: var(--p-slate-200);
    color: var(--p-slate-900);
    font-size: 1.2em;
}
.collection {
    width: 98vw;
    height: 90vh;
    text-align: left;
}
.list {
    display: inline-block;
}
.info {
    width: 150px;
    height: 50px;
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
}
</style>
