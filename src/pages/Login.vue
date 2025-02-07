<script setup>
import { inject } from 'vue'
import router from '../plugins/router';

const API = inject('API');

// pinia 
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'
const sessionStore = useSessionStore();
const collectionStore = useCollectionStore();

// methods 
async function login() {
    //
    await sessionStore.userLogin({
        token: 12345678,
        name: "Sepo"
    })
    // 
    await collectionStore.load()
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
