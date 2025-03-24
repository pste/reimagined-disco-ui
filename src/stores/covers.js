import { defineStore } from 'pinia';
import { inject, reactive , computed } from 'vue';

// using a "setup store" to handle circular reference between API and store
const useCoversStore = defineStore('covers', () => {
    const API = inject('API');
    const cache = reactive(new Map());

    return {
        // not async with intention
        get: async function(album_id) {
            if (cache.has(album_id)) {
                return cache.get(album_id);
            }
            else {
                const cover = await API.get('/search/cover', {album_id});
                const buffer = cover?.imagedata?.data;
                cache.set(album_id, buffer);
                return buffer;
            }
        }
    }
})

export default useCoversStore;