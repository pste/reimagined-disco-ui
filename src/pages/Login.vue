<script setup>
import { inject, ref } from 'vue'
import router from '../plugins/router';

const API = inject('API');

// pinia 
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'
const session = useSessionStore();
const collectionStore = useCollectionStore();

// data
const user = ref("");
const pwd = ref("");

// methods 
async function login() {
    try {
        await session.userLogin(user.value, pwd.value);
        await collectionStore.load();
        router.push( {name: 'collection' } );
    }
    catch (err) {
        console.error(err);
        await session.userLogout();
    }
}
</script>

<template>
    <Transition>
    <div class="loginbox card p-5 shadow-2 border-round" v-if="session.loggedIn === false">
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
    </Transition>
</template>

<style scoped>
.loginbox {
  position:absolute;
  background-color: var(--p-slate-800);
}

/**/
.v-enter-active,
.v-leave-active {
  transition: all .5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  transform: translateY(100px);
}
</style>
