import { defineStore } from 'pinia';
import { inject, computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import usePlaylistStore from '@/stores/playlist'

//
const useSessionStore = defineStore('session', () => {
    const router = useRouter();
    const playlistStore = usePlaylistStore();
    const API = inject('API');

    // data
    const user = ref({
        name: "",
        preferences: {
            sortCollectionBy: 'name',
            sortCollectionDirection: 'asc',
        },
    });

    async function userLogin(name, pwd) {
        const dbuser = await API.post('/login', { username: name, password: pwd });
        user.value.name = dbuser?.username || 'anonymous';
    }

    async function userLogout() {
        playlistStore.clear();
        user.value.name = ""; // to update loggedIn computed ASAP

        await API.post('/logout', { });
        // heavy reload
        const { protocol, host } = window.location;
        window.location.replace(`${protocol}//${host}`);
    }

    // done
    return {
        user,

        // computed
        username: computed(() => {
            return user.value.name;
        }),
        loggedIn: computed(() => {
            return user.value.name !== "";
        }),

        // actions
        userLogin,
        userLogout,
    }
})

export default useSessionStore;