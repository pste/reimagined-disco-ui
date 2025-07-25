import { defineStore } from 'pinia';
import { ref } from 'vue';

const useGlobalsStore = defineStore('globals', () => {
    const baseFolder = ref('.');
    const apiURL = ref(import.meta.env.VITE_APIURL);
    console.log(apiURL)

    return {
        baseFolder,
        apiURL,
    }
})

export default useGlobalsStore;