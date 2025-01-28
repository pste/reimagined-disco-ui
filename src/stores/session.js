import { defineStore } from 'pinia';

const useSessionStore = defineStore('session', {
    state: () => {
        user: null
    },

    getters: {
        username(state) {
            return state.user?.name || '';
        },

        token(state) {
            return state?.user?.token;
        },

        loggedIn(state) {
            return this.user !== null;
        },
    }, 
    
    actions: {
        userLogin(val) {
            this.user = val;
        },

        userLogout() {
            this.user = null;
        }
    }
})

export default useSessionStore;