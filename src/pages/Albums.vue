<script setup>
import { ref, inject, computed } from 'vue'
import { useRoute } from 'vue-router'
import Album from '@/components/Album.vue'

const route = useRoute();

// init stuff
const API = inject('API');

// data
const items = ref([]);

// methods 
async function loadPage() {
    items.value = await API.get('/search/albums', { artistid: route.params.artistid });
}
loadPage()
</script>

<template>
    <Fluid>
        <Album v-for="item in items"
            :artist="item.artist"
            :title="item.title"
        >
        </Album>
    </Fluid>
</template>

<style scoped>
</style>
