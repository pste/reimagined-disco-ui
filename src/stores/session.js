import { defineStore } from 'pinia';
import { inject, computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import logger from '@/plugins/logger'
import usePlaylistStore from '@/stores/playlist'
import useGlobalsStore from '@/stores/globals'

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
            sortCollectionBy: 'played',
            sortCollectionDirection: 'desc',
        },
    });
    const isVerifying = ref(false);

    function apiUrl(path) {
        const globals = useGlobalsStore();
        return globals.apiURL.replace(/\/$/, '') + path;
    }

    function clearSession() {
        user.value.name = "";
        localStorage.removeItem(SESSION_KEY);
    }

    // Checks the real server session. Returns false only if the server says it expired (401).
    // Uses raw fetch to avoid triggering the API 401 handler (which would call userLogout recursively).
    // Network error / 5xx (offline, server down): the session is kept as valid, so the cached
    // songs stay playable; if it really expired, the first 401 of any API call logs out anyway
    async function verifySession() {
        isVerifying.value = true;
        try {
            const res = await fetch(apiUrl('/user/me'), { credentials: 'include' });
            if (res.status === 401) {
                clearSession();
                return false;
            }
            if (res.ok) {
                const data = await res.json();
                if (data?.username) {
                    user.value.name = data.username;
                    localStorage.setItem(SESSION_KEY, user.value.name);
                }
            }
            return true;
        }
        catch (_) {
            logger.info("verifySession: server unreachable, keeping the local session");
            return true;
        }
        finally {
            isVerifying.value = false;
        }
    }

    async function userLogin(name, pwd) {
        const dbuser = await API.post('/login', { username: name, password: pwd });
        // su errore (401 credenziali, rete) l'API client restituisce undefined: si lancia
        // così Login.vue mostra il messaggio, invece di loggare un utente "anonymous"
        if (!dbuser?.username) {
            throw new Error('Login failed');
        }
        user.value.name = dbuser.username;
        localStorage.setItem(SESSION_KEY, user.value.name);
    }

    async function userLogout() {
        playlistStore.clear();
        clearSession();

        // fire-and-forget: the session may already be expired on the server
        fetch(apiUrl('/logout'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }).catch(() => {});

        router.push('/');
        logger.info("Logged out.");
    }

    // done
    return {
        user,
        isVerifying,

        // computed
        username: computed(() => user.value.name),
        loggedIn: computed(() => user.value.name !== ""),

        // actions
        verifySession,
        userLogin,
        userLogout,
    }
})

export default useSessionStore;