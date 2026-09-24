<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { RouterView } from 'vue-router'
import ToolBar from './components/ToolBar.vue'
import AudioPlayer from '@/components/AudioPlayer.vue'
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'
import usePlaylistStore from '@/stores/playlist'

const session = useSessionStore();
const collectionStore = useCollectionStore();
const playlistStore = usePlaylistStore();
const router = useRouter();

onMounted(async () => {
    if (session.loggedIn) {
        const valid = await session.verifySession();
        if (valid) {
            playlistStore.restoreLastPlayed();
            await collectionStore.load();
            // su /album o altre rotte la collection è necessaria; se mancasse, redirect a /collection
            const route = router.currentRoute.value;
            if (route.name === 'login') {
                router.push({ name: 'collection' });
            }
        }
    }
});
</script>

<template>
  <div class="flex w-full flex-column align-items-center min-h-screen">
    <header class="flex w-full">
        <ToolBar />
    </header>
    <template v-if="!session.isVerifying">
        <div class="page-content w-full flex flex-column align-items-center">
            <RouterView />
        </div>
        <AudioPlayer />
    </template>
    <Toast />
  </div>
</template>

<style>
body {
    background-color: var(--p-slate-600);
}

/* spazio sotto le pagine per il player fixed: --player-height è la sua altezza reale,
   aggiornata da AudioPlayer (ResizeObserver) + 1rem di respiro. I valori fissi restano
   come fallback finché la variabile non è impostata */
.page-content {
    padding-bottom: calc(var(--player-height, 5rem) + 1rem);
}

@media (max-width: 767px) {
    .page-content {
        padding-bottom: calc(var(--player-height, 10rem) + 1rem);
    }
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
