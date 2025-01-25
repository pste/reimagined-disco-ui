import { defineStore } from 'pinia';

const useUserStore = defineStore('user', {
    state: () => {
        user: null
    },

    getters: {
        token(state) {
            return undefined // state?.user?.name || '';
        }
    }, 
    
    actions: {
        userLogin(val) {
            this.user = val;
        },

        userLogout() {
            this.user = null
        }
    }
})

export default useUserStore;

/* 
in your component:

1. import needed stuff
import { mapStores, mapState, mapWritableState } from 'pinia'
import { useUserStore } from '@/stores/userStore'

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