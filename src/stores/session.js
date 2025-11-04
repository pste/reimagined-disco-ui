import { defineStore } from 'pinia';
import { inject, computed, ref } from 'vue'

import { useIdleObserver } from '@idle-observer/vue3'
import usePlayerStore from '@/stores/player'

//
const useSessionStore = defineStore('session', () => {
    const playerStore = usePlayerStore();
    const API = inject('API');

    // idle timer
    //let observer = buildObserver();
    //setTimeout(observer.pause, 1000); // there's a bug in the observer, I cannot pause immediatly

    // data
    const user = ref({
        name: "",
        // token: "",
    });

    // methods
    function buildObserver() {
        const observer = useIdleObserver({
            timeout: 8 * 1000, // secs TODO
            idleWarningDuration: 5 * 1000, // secs
            onIdle: () => {
                if (playerStore.isIdle === false) {
                    observer.reset(); // continuosly restarts if playing
                }
                else {
                    userLogout();
                }
            },
            onIdleWarning: function() {
                console.log('User will be idle soon!');
            },
            activityEvents: ['mousemove', 'keydown'],
        });
        return observer;
    }

    async function userLogin(name, pwd) {
        const dbuser = await API.post('/login', { username: name, password: pwd });
        user.value.name = dbuser?.username || 'anonymous';
        //observer.resume();
    }

    async function userLogout() {
        //observer.pause();
        playerStore.clear();

        await API.post('/logout', { });
        user.value.name = "";
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