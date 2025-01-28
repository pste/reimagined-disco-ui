import { defineStore } from 'pinia';
import { ref } from 'vue';

const useGlobalsStore = defineStore('globals', () => {
    const baseFolder = ref('.');
    const apiURL = ref('http://127.0.0.1:3001')

    return {
        baseFolder,
        apiURL,
    }
})

export default useGlobalsStore;