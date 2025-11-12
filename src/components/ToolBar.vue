<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import useSessionStore from '@/stores/session'
import useCollectionStore from '@/stores/collection'

//
const router = useRouter();
const session = useSessionStore();
const collectionStore = useCollectionStore();

// computed filter
const filter = computed({
    get() {
        return collectionStore.filter.global;
    },
    set(val) {
        collectionStore.filter.global = val;
    }
})

// menu
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
const toggleMenu = (event) => {
    menuOpen.value.toggle(event);
};

// menu sort
function sortHelper(sortBy) {
    const srt = session.user.preferences.sortCollectionBy;
    const dir = session.user.preferences.sortCollectionDirection;
    // only change direction
    if (srt === sortBy) {
        if (dir === 'asc') {
            session.user.preferences.sortCollectionDirection = 'desc';
        }
        else {
            session.user.preferences.sortCollectionDirection = 'asc';
        }
    }
    // change sort order / reset direction
    else {
        session.user.preferences.sortCollectionBy = sortBy;
        session.user.preferences.sortCollectionDirection = 'asc'
    }
}
const menuSort = ref();
const menuItemsSort = ref([
    { 
        label: 'artist', 
        command: () => sortHelper("name") // the artist's name
    },
    { 
        label: 'year', 
        command: () => sortHelper("year")
    },
    { 
        label: 'recently added', 
        command: () => sortHelper("added")
    },
    { 
        label: 'recently played', 
        command: () => sortHelper("played")
    },
])
const toggleMenuSort = (event) => {
    menuSort.value.toggle(event);
};

// methods
function logout() {
    session.userLogout();
    router.replace('/');
}

// lifecycle
onUnmounted(() => {
    logout();
})
</script>

<template>
    <Transition name="xtoolbar">
    <Menubar v-if="session.loggedIn" class="w-full">
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
            <!---->
            <Button 
                icon="pi pi-sort" 
                @click="toggleMenuSort" 
                class="mr-2" 
                text severity="secondary" 
                aria-haspopup="true" 
                aria-controls="overlay_menu_2" 
            />
            <Menu ref="menuSort" id="overlay_menu_2" :model="menuItemsSort" :popup="true" />
            <!---->
            <InputText 
                    v-model="filter"
                    placeholder="Search" 
                    type="text" 
                    size="small"
            />
            <Button icon="pi pi-times-circle" class="mr-2" severity="secondary" text @click="collectionStore.resetFilter" />
        </template>

        <template #end>
            <div class="flex items-center gap-2">
                <Avatar icon="pi pi-user" shape="circle" v-tooltip.bottom="`${session.username}`"/>
                <Button icon="pi pi-sign-out" class="mr-2" severity="secondary" text @click="logout" />
            </div>
        </template>
    </Menubar >
    </Transition>
</template>

<style scoped>
.p-menubar {
    padding: 0;
    margin-bottom: 5px;
}

.toolbar-enter-active,
.toolbar-leave-active {
  transition: all .5s ease-out;
}

.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
}
</style>