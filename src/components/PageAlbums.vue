<script setup>
import { ref, inject } from 'vue'
import Album from './Album.vue'

// init stuff
const API = inject('API');

// data
const items = ref([])

// methods 
async function getTime() {
    items.value = await API.get('/search/songs', {title: "time"});
}
</script>

<template>
    <button @click="getTime">Click Me!</button>
    Albums:
    <Album v-for="item in items"
        :artist="item.artist"
        :title="item.title"
    >
    </Album>
</template>

<style scoped>
</style>
