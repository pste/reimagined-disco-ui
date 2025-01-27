import { defineStore } from 'pinia';
console.log("defineStore errors")

const useErrorsStore = defineStore('errors', {
    state: () => {
        errors: []
    },

    actions: {
        pushError(val) {
            this.errors.push(val);
        },
    }
})

export default useErrorsStore;