<script setup>
import { ref, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Disc from '@/components/Disc.vue'
import useDiscStore from '@/stores/disc'

// init stuff
const route = useRoute();
const discStore = useDiscStore();
const router = useRouter();
const API = inject('API');

// data
const sortedList = ref([])

// computed
const artistName = computed(() => {
    if (sortedList.value.length > 0) {
        return sortedList.value[0].artist;
    }
    return '...'
})

// methods 
async function loadAlbums() {
    const artistid = route.params.artistid;
    if (artistid) {
       const data = await API.get('/search/albums', { artistid })
       sortedList.value = data.sort( (a,b) => {
            if (a.year < b.year) return -1;
            if (a.year > b.year) return 1;
            if (a.album < b.album) return -1;
            if (a.album > b.album) return 1;
            return 0;
        })
    }
    else {
        console.error('Bad Route: no album id found');
        //router.push({ name: 'login' });
    }
}

function albumTitle(item) {
    if (item.year) {
        return `${item.year}. ${item.album}`;
    }
    else {
        return item.album;
    }
}

// methods
function gotoAlbum(disc) {
    discStore.store(disc);
    router.push({ name: 'album' }); // , params: { albumid: disc.album_id }});
}

//
loadAlbums()
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
                :id="item.album_id"
                :artist="item.artist"
                :title="item.album"
                :year="item.year"
                :genre="item.genre"
                :cover="item.cover"
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
