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
