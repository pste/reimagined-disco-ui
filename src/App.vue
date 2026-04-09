<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { RouterView } from 'vue-router'
import ToolBar from './components/ToolBar.vue'
import AudioPlayer from '@/components/AudioPlayer.vue'
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'

const session = useSessionStore();
const collectionStore = useCollectionStore();
const router = useRouter();

onMounted(async () => {
    if (session.loggedIn) {
        await collectionStore.load();
        // su /album o altre rotte la collection è necessaria; se mancasse, redirect a /collection
        const route = router.currentRoute.value;
        if (route.name === 'login') {
            router.push({ name: 'collection' });
        }
    }
});
</script>

<template>
  <div class="flex w-full flex-column align-items-center min-h-screen">
    <header class="flex w-full">
        <ToolBar />
    </header>
    <RouterView />
    <AudioPlayer />
    <Toast />
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
