<script setup>
import { inject } from 'vue'
import router from '../plugins/router';

const API = inject('API');

// pinia 
import useSessionStore from '@/stores/session'
import useAlbumsStore from '@/stores/albums'
const sessionStore = useSessionStore();
const albumsStore = useAlbumsStore();

// methods 
async function login() {
    //
    await sessionStore.userLogin({
        token: 12345678,
        name: "Sepo"
    })
    // 
    albumsStore.discs = await API.get('/search/albums'); // , { artistid: route.params.artistid });
    // 
    router.push( {name: 'collection' } );
}
</script>

<template>
    <Card>
        <template #content>
            <div class="centered">
                <Button @click="login">Login</Button>
            </div>
        </template>
    </Card>
</template>

<style scoped>
.centered {
    margin: auto;
    text-align: center;
}
</style>
