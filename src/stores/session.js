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

        loggedIn: computed(() => {
            return user.value.name !== "";
        }),

        // actions
        async userLogin(name, pwd) {
            const dbuser = await API.post('/login', { username: name, password: pwd });
            user.value.name = dbuser?.username || '';
        },

        async userLogout() {
            await API.post('/logout', { });
            user.value.name = "";
        }
    }
})

export default useSessionStore;