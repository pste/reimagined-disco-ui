import { defineStore } from 'pinia';
import { inject } from 'vue';

// using a "setup store" to handle circular reference between API and store
const useCoversStore = defineStore('covers', () => {
    const API = inject('API');
    const idxDB = inject('idxDB');
    const queue = [];
    let isProcessing = false;

    async function getcover(album_id) {
        const buffer = await API.getBlob('/search/cover', {album_id});
        //logger.log("covers API get:", buffer);
        await idxDB.put("covers", album_id, buffer);
        return buffer;
    }

    async function dequeue() {
        isProcessing = true;
        while (queue.length >0) {
            const {album_id,resolve,reject} = queue[0]; // take head, dont remove
            try {
                const buffer = await getcover(album_id); // download cover
                resolve(buffer); // return data to the caller
            }
            catch(err) {
                reject(err)
            }
            finally {
                queue.shift(); // remove head
            }
        } // go on
        isProcessing = false;
    }

    async function enqueue(album_id) {
        return new Promise(async (resolve, reject) => {
            // queued requests to avoid flooding
            queue.push({ album_id, resolve, reject });
            if (!isProcessing) {
                dequeue();
            }
        });
    }

    return {
        get: async function(album_id) {
            const dbCover = await idxDB.get("covers", album_id);
            //logger.log("covers idxdb get:", dbCover);
            // from local DB
            if (dbCover) {
                return dbCover;
            }
            // from APIs
            else {
                // queued requests to avoid flooding
                const buffer = await enqueue(album_id);
                // const buffer = await getcover(album_id); // request flooding ...
                return buffer;
            }
        }
    }
})

export default useCoversStore;