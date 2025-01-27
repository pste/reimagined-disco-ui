<script setup>
import { ref, inject } from 'vue'
import Artist from '@/components/Artist.vue'

// init stuff
const API = inject('API');

// data
const items = ref([])

// methods 
async function loadPage() {
    const data = await API.get('/search/artists');
    items.value = data.sort( (a,b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    });
}
loadPage()
</script>

<template>
    <Fluid>
        <Artist v-for="item in items"
            :id="item.artist_id"
            :artist="item.name"
        >
        </Artist>
    </Fluid>
</template>

<style scoped>
</style>
