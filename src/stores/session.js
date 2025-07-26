import { defineStore } from 'pinia';
import { inject, computed, ref } from 'vue'

const useSessionStore = defineStore('session', () => {
    const API = inject('API');
    const user = ref({
        name: "",
        token: "",
    });

    return {
        user, 
        // computed
        username: computed(() => {
            return user.value.name;
        }),

        token: computed(() => {
            return user.value.token;
        }),

        loggedIn: computed(() => {
            return user.value.name !== "";
        }),

        // actions
        userLogin(name, pwd) {
            user.value.name = name || "";
            user.value.token = pwd || "";
        },

        userLogout() {
            user.value.name = "";
            user.value.token = "";
        }
    }
    /*
    state: () => ({
        user: null
    }),

    getters: {
        username(state) {
            return state.user?.name || '';
        },

        token(state) {
            return state?.user?.token;
        },

        loggedIn(state) {
            return state.user !== null;
        },
    }, 
    
    actions: {
        userLogin(val) {
            this.user = val;
        },

        userLogout() {
            this.user = null;
        }
    }*/
})

export default useSessionStore;