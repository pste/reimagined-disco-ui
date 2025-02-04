<script setup>
import { ref, inject, computed } from 'vue'
//import { useRoute } from 'vue-router'
import Album from '@/components/Album.vue'

// const route = useRoute();

// computed
const sortedList = computed(() => {
    return albums.value.sort( (a,b) => {
        if (a.artist < b.artist) return -1;
        if (a.artist > b.artist) return 1;
        if (a.year < b.year) return -1;
        if (a.year > b.year) return 1;
        return 0;
    });
})

// init stuff
const API = inject('API');

// data
const albums = ref([]);

// methods 
async function loadPage() {
    albums.value = await API.get('/search/albums'); // , { artistid: route.params.artistid });
}
loadPage()
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
