import { defineStore } from 'pinia';
import { inject } from 'vue';

// using a "setup store" to handle circular reference between API and store
const useCoversStore = defineStore('covers', () => {
    const API = inject('API');
    const idxDB = inject('idxDB');

    return {
        // not async with intention
        get: async function(album_id) {
            const dbCover = await idxDB.get("covers", album_id);
            //logger.log("covers idxdb get:", dbCover);
            // from local DB
            if (dbCover) {
                return dbCover;
            }
            // from APIs
            else {
                const buffer = await API.getBlob('/search/cover', {album_id});
                //logger.log("covers API get:", buffer);
                // to local db
                await idxDB.put("covers", album_id, buffer);
                return buffer;
            }
        }
    }
})

export default useCoversStore;