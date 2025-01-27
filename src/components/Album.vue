<script setup>
const props = defineProps({
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
    border: 2px solid rgb(34, 34, 34);
    border-radius: 10px;
    background-color: aquamarine;
    margin: 2px;
    padding: 2px;
    width: 100px;
    height: 100px;
}
</style>
