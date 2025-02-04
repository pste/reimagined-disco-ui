import { defineStore } from 'pinia';

const useErrorsStore = defineStore('errors', {
    state: () => ({
        errors: []
    }),

    actions: {
        pushError(val) {
            this.errors.push(val);
        },
    }
})

export default useErrorsStore;