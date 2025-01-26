<script setup>
import { ref, inject } from 'vue'
import Album from '@/components/Album.vue'

// init stuff
const API = inject('API');

// data
const items = ref([])

// methods 
async function getTime() {
    items.value = await API.get('/search/albums'); //, {title: "time"});
}
</script>

<template>
    <Button @click="getTime">Click Me!</Button>
    Albums:
    <Album v-for="item in items"
        :artist="item.artist"
        :title="item.title"
    >
    </Album>
</template>

<style scoped>
</style>
