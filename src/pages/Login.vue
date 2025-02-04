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
    <div class="loginpage">
        <div class="loginbox">
            <Card class="logincard">
                <template #content>
                    <div class="centered-content">
                        <Button @click="login">Login</Button>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>

<style scoped>
.loginpage {
  display: table;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
}
.loginbox {
    display: table-cell;
    vertical-align: middle;
}
.logincard {
    margin-left: auto;
    margin-right: auto;
    width: 50vw;
}
.centered-content {
    margin: auto;
    text-align: center;
}
</style>
