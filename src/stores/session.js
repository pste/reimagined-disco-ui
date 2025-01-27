import { defineStore } from 'pinia';

console.log("defineStore session")

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

/* 
in your component:

1. import needed stuff
import { mapStores, mapState, mapWritableState } from 'pinia'
import useUserStore from '@/stores/userStore'

2. use it rough:
data() {
  return {
    user: useUserStore()
  }
}
...
user.userLogin(..)

or in a plugin (beware it must be installed => createPinia + app.use(pinia) ):
const userStore = useUserStore();
userStore.userLogout();
*/