import { defineStore } from 'pinia';
import { inject, computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import logger from '@/plugins/logger'
import usePlaylistStore from '@/stores/playlist'

//
const useSessionStore = defineStore('session', () => {
    const router = useRouter();
    const playlistStore = usePlaylistStore();
    const API = inject('API');

    const SESSION_KEY = 'session_username';

    // data — username restored synchronously so the router guard sees it immediately
    const user = ref({
        name: localStorage.getItem(SESSION_KEY) || "",
        preferences: {
            sortCollectionBy: 'name',
            sortCollectionDirection: 'asc',
        },
    });

    async function userLogin(name, pwd) {
        const dbuser = await API.post('/login', { username: name, password: pwd });
        user.value.name = dbuser?.username || 'anonymous';
        localStorage.setItem(SESSION_KEY, user.value.name);
    }

    async function userLogout() {
        playlistStore.clear();
        user.value.name = ""; // to update loggedIn computed ASAP
        localStorage.removeItem(SESSION_KEY);

        await API.post('/logout', { });
        // heavy reload
        const { protocol, host } = window.location;
        window.location.replace(`${protocol}//${host}`);
        logger.info("Logged out.");
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