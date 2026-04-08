import { defineStore } from 'pinia';
import { ref } from 'vue';

const useGlobalsStore = defineStore('globals', () => {
    const baseFolder = ref('.');
    const apiURL = ref("/api");
    if (import.meta.env.VITE_APIURL) { // dev mode
        apiURL.value = import.meta.env.VITE_APIURL;
    }
    else { // production mode
        const url = new URL(window.location.href);
        apiURL.value = url.origin + '/api';
    }

    return {
        baseFolder,
        apiURL,
    }
})

export default useGlobalsStore;