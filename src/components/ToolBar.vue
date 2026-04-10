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
        label: 'Options',
        items: [
            /*{
                label: 'Collection',
                icon: 'pi pi-home',
                command: () => {
                    router.push({ name: 'collection' });
                }
            },*/
            {
                label: 'Parameters',
                icon: 'pi pi-folder',
                command: () => {
                    router.push({ name: 'params' });
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
}

// lifecycle
onUnmounted(() => {
    logout();
})
</script>

<template>
    <!--<Transition name="xtoolbar">-->
    <Menubar v-if="session.loggedIn" class="fixed top-0 left-0 w-full shadow-6 z-5 p-0">
        <template #start>
            <!-- Menu -->
            <Button 
                icon="pi pi-bars" 
                @click="toggleMenu" 
                class="mr-2" 
                text severity="secondary" 
                aria-haspopup="true" 
                aria-controls="overlay_menu" 
            />
            <Menu ref="menuOpen" id="overlay_menu" :model="menuItems" :popup="true" />
            <!-- Home -->
             <Button 
                icon="pi pi-home" 
                @click="router.push({ name: 'collection' })" 
                class="mr-2" 
                text severity="secondary" 
                aria-haspopup="true" 
                aria-controls="overlay_menu_2" 
            />
            <!-- SortBy -->
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
            <div class="search-container">
                <InputText
                        v-model="filter"
                        placeholder="Search"
                        type="text"
                        size="small"
                        class="search-input"
                />
                <Button icon="pi pi-times-circle" severity="secondary" text @click="collectionStore.resetFilter" class="search-clear" />
            </div>
        </template>

        <template #end>
            <div class="flex items-center gap-2">
                <Avatar v-if="false" icon="pi pi-user" shape="circle" v-tooltip.bottom="`${session.username}`"/>
                <Button icon="pi pi-sign-out" class="mr-2" severity="secondary" text @click="logout" />
            </div>
        </template>
    </Menubar >
    <!--</Transition>-->
</template>

<style scoped>
.p-menubar {
    padding: 0;
    margin-bottom: 5px;
}

.search-container {
    position: relative;
    display: flex;
    align-items: center;
}

.search-input {
    width: 180px;
    padding-right: 2.5rem;
}

:deep(.search-clear.p-button) {
    position: absolute;
    right: 0;
    width: 2.5rem;
    height: 2.5rem;
}

@media (max-width: 767px) {
    .search-container {
        flex: 1 1 100%;
    }
    .search-input {
        width: 100%;
    }

    :deep(.p-button) {
        width: 3.5rem;
        height: 3.5rem;
    }
    :deep(.p-button .p-button-icon) {
        font-size: 1.25rem;
    }
    :deep(.p-avatar) {
        width: 2rem;
        height: 2rem;
        font-size: 1rem;
        align-self: center;
    }
    :deep(.search-clear.p-button) {
        width: 2.5rem;
        height: 2.5rem;
    }
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