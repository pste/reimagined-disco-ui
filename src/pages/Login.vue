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
        await sessionStore.userLogout();
    }
}
</script>

<template>
    <div class="loginbox card p-5 shadow-2 border-round">
        <div class="flex flex-column row-gap-2">
            <InputGroup>
                <InputGroupAddon>
                    <i class="pi pi-user"></i>
                </InputGroupAddon>
                <InputText id="txtname" v-model="user" name="username" type="text" placeholder="Username" />
            </InputGroup>

            <InputGroup>
                <InputGroupAddon>
                    <i class="pi pi-lock"></i>
                </InputGroupAddon>
                <InputText id="txtpwd"  v-model="pwd"  name="password" type="password" />
            </InputGroup>

            <Button @click="login" type="submit">Login</Button>
        </div>
    </div>
</template>

<style scoped>
.loginbox {
  background-color: var(--p-slate-800);
}
</style>
