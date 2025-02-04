<script setup>
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import useSessionStore from '@/stores/session'
import useAlbumsStore from '@/stores/albums'

const API = inject('API');
const router = useRouter()
const session = useSessionStore()
const albumsStore = useAlbumsStore()

// data
const menuOpen = ref();
const menuItems = ref([
    {
        label: 'Options',
        items: [
            {
                label: 'Refresh',
                icon: 'pi pi-refresh',
                command: async() => {
                    albumsStore.discs = await API.get('/search/albums');
                }
            },
            {
                label: 'Export',
                icon: 'pi pi-upload',
                command: () => {
                    // TODO
                }
            }
        ]
    }
]);

// methods
function logout() {
    session.userLogout();
    router.replace('/');
}

const toggleMenu = (event) => {
    menuOpen.value.toggle(event);
};
</script>

<template>
    <Menubar  v-if="session.loggedIn">
        <template #start>
            <Button 
                icon="pi pi-bars" 
                @click="toggleMenu" 
                class="mr-2" 
                text severity="secondary" 
                aria-haspopup="true" 
                aria-controls="overlay_menu" 
            />
            <Menu ref="menuOpen" id="overlay_menu" :model="menuItems" :popup="true" />

            <InputText 
                    v-model="albumsStore.filter"
                    placeholder="Search" 
                    type="text" 
                    size="small"
            />
            <Button icon="pi pi-times-circle" class="mr-2" severity="secondary" text @click="albumsStore.filter=''" />
        </template>

        <template #end>
            <div class="flex items-center gap-2">
                <Avatar icon="pi pi-user" shape="circle" v-tooltip.bottom="`${session.username}`"/>
                <Button icon="pi pi-sign-out" class="mr-2" severity="secondary" text @click="logout" />
            </div>
        </template>
    </Menubar >
</template>

<style scoped>
.p-menubar {
    padding: 0;
}
</style>