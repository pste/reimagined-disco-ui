<script setup>
import { ref, inject } from 'vue'

//import { mapStores, mapState, mapWritableState } from 'pinia'
import useSessionStore from '@/stores/session'
import router from '../plugins/router';
const sessionStore = useSessionStore();

// methods 
async function login() {
   await sessionStore.userLogin({
    token: 12345678,
    name: "Sepo"
   })

   router.push( {name: 'artists' } );
}
</script>

<template>
    <Button @click="login">Login</Button>
</template>

<style scoped>
</style>
