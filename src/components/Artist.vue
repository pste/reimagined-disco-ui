<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// props
const props = defineProps({
    id: Number,
    artist: String,
})

// computed
const shortName = computed(() => {
    const words = props.artist.split(' ');
    const letters = words.map( word => word[0] )
    return letters.join('')
})

// other
function gotoAlbums(id) {
    router.push({ name: 'albums', params: { artistid: id }});
}
</script>

<template>
    <Avatar 
        :label="shortName"
        v-tooltip="artist"
        class="mr-2 artist" 
        size="xlarge"
        @click="gotoAlbums(id)"
    />
</template>

<style scoped>
.artist {
    margin: 5px;
}
</style>