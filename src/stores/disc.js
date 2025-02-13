import { defineStore } from 'pinia';

const useDiscStore = defineStore('disc', {
    state: () => ({
       disc: null
    }),

    actions: {
        store(item) {
            this.disc = item;
        },

        clear() {
            this.disc = null;
        },
    }
})

export default useDiscStore;