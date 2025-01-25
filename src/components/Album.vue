<script setup>
defineProps({
    artist: String,
    title: String,
})
</script>

<template>
    <div class="album">
        Artist: {{ artist }}
        Album: {{ title }}
    </div>
</template>

<style scoped>
.album {
    border: 2px solid black;
    margin: 2px;
}
</style>
