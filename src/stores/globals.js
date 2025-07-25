import { defineStore } from 'pinia';
import { ref } from 'vue';

const useGlobalsStore = defineStore('globals', () => {
    const baseFolder = ref('.');
    const apiURL = ref(process.env.APIURL);

    return {
        baseFolder,
        apiURL,
    }
})

export default useGlobalsStore;