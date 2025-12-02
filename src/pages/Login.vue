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
const gotError = ref("");

// methods 
async function login() {
    try {
        gotError.value = false;
        await session.userLogin(user.value, pwd.value);
        await collectionStore.load();
        router.push( {name: 'collection' } );
    }
    catch (err) {
        console.error(err);
        gotError.value = true;
        //setTimeout(() => {gotError.value = false;}, 1000);
        await session.userLogout();
    }
}
</script>

<template>
    <!--<Transition name="xlogin">-->
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

            <!--<Transition name="xerror">-->
                <Message    severity="error" 
                            variant="outlined" 
                            size="small" 
                            icon="pi pi-times-circle" 
                            v-show="gotError"
                            @click="gotError=false"
                >
                    Wrong Login
                </Message>
            <!--</Transition>-->
        </div>
    </div>
    <!--</Transition>-->
</template>

<style scoped>
.loginbox {
  position:absolute;
  background-color: var(--p-slate-800);
  margin-top: 50px;
}

/**/
.login-enter-active,
.login-leave-active {
  transition: all .5s ease-out;
}

.login-enter-from,
.login-leave-to {
  opacity: 0;
  transform: translateY(100px);
}

.error-enter-active,
.error-leave-active {
  transition: all .8s ease-out;
}

.error-enter-from,
.error-leave-to {
  opacity: 0;
}
</style>
