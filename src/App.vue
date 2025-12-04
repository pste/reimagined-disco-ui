<script setup>
import { RouterView } from 'vue-router'
import ToolBar from './components/ToolBar.vue'
import AudioPlayer from '@/components/AudioPlayer.vue'
</script>

<template>
  <div class="flex w-full flex-column align-items-center min-h-screen">
    <header class="flex w-full">
        <ToolBar />
    </header>
    <RouterView />
    <AudioPlayer />
  </div>
</template>

<style>
body {
    background-color: var(--p-slate-600);
}
/*
footera {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  text-align: center;
}*/
</style>
