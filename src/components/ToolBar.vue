<script setup>
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'

//
const router = useRouter();
const session = useSessionStore();
const collectionStore = useCollectionStore();

// data
const menuOpen = ref();
const menuItems = ref([
    {
        label: 'Menu',
        items: [
            {
                label: 'Collection',
                icon: 'pi pi-home',
                command: () => {
                    router.push({ name: 'collection' });
                }
            },
            {
                label: 'Sources',
                icon: 'pi pi-folder',
                command: () => {
                    router.push({ name: 'sources' });
                }
            },
            {
                label: 'Refresh',
                icon: 'pi pi-refresh',
                command: async() => {
                    await collectionStore.load();
                }
            },
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

// lifecycle
onUnmounted(() => {
    logout();
})
</script>

<template>
    <Menubar v-if="session.loggedIn">
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
                    v-model="collectionStore.filter"
                    placeholder="Search" 
                    type="text" 
                    size="small"
            />
            <Button icon="pi pi-times-circle" class="mr-2" severity="secondary" text @click="collectionStore.filter=''" />
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
    margin-bottom: 5px;
}
</style>