<script setup>
import { inject, ref } from 'vue'
import router from '../plugins/router';

const API = inject('API');

// pinia 
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'
const sessionStore = useSessionStore();
const collectionStore = useCollectionStore();

// data
const user = ref("");
const pwd = ref("");

// methods 
async function login() {
    try {
        await sessionStore.userLogin(user.value, pwd.value);
        await collectionStore.load();
        router.push( {name: 'collection' } );
    }
    catch (err) {
        console.error(err);
        //await sessionStore.userLogout();
    }
}
</script>

<template>
    <div class="loginpage">
        <div class="loginbox">
            <Card class="logincard">
                <template #content>
                    <div class="centered-content">
                        <InputText v-model="user" name="username" type="text" placeholder="Username" />
                        <InputText v-model="pwd" name="password" type="password" />
                        <Button @click="login" type="submit">Login</Button>
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
