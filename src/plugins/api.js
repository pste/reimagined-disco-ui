import useSessionStore from '@/stores/session'
import useErrorsStore from '@/stores/errors'
import useGlobalsStore from '@/stores/globals'

function createAPI() {
    return {
        get: async (url, data) => {
            // defer store usage (this handles circular reference between store => API => store)
            const errorsStore = useErrorsStore();
            //const sessionStore = useSessionStore();
            const globals = useGlobalsStore();

            // fetch
            let address = new URL(url, globals.apiURL);
            if (data) {
                address += '?' + new URLSearchParams(data);
            }
            let headers = {
                //'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            // api call
            try {
                const res = await fetch(address, {
                    method: "GET",
                    headers,
                    credentials: 'include'
                });
                if (!res?.ok) {
                    const err = new Error(`HTTP code (${res?.status}): ${data.message}`);
                    throw err;
                }
                const resdata = await res.json();
                return resdata;
            }
            catch (err) {
                console.error(`API GET ERROR: ${url}`);
                errorsStore.pushError(err);
                throw err;
            }
        },

        post: async (url, data) => {
            const errorsStore = useErrorsStore();
            const globals = useGlobalsStore();

            // fetch
            let address = new URL(url, globals.apiURL);
            try {
                let headers = {
                    //'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
                const res = await fetch(address, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(data),
                    credentials: 'include'
                });
                if (!res?.ok) {
                    const err = new Error(`HTTP code (${res?.status}): ${data.message}`);
                    throw err;
                }
                const resdata = await res.json();
                return resdata;
            }
            catch (err) {
                console.error(`API POST ERROR: ${url}`)
                errorsStore.pushError(err);
                throw err;
            }
        }
    }
}

export default {
    install: (app, options) => {
        app.provide("API", createAPI());
    }
}