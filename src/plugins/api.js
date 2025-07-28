import useSessionStore from '@/stores/session'
import useErrorsStore from '@/stores/errors'
import useGlobalsStore from '@/stores/globals'

function buildHeaders() {
    return {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'credentials': 'include',
        }
    }
}

function createAPI() {
    return {
        get: async (url, data) => {
            // defer store usage (this handles circular reference between store => API => store)
            const errorsStore = useErrorsStore();
            //const sessionStore = useSessionStore();
            const globals = useGlobalsStore();

            // headers
            const config = buildHeaders();
            // url
            let address = new URL(url, globals.apiURL);
            // querystring
            if (data) {
                address += '?' + new URLSearchParams(data);
            }
            // api call
            try {
                const res = await fetch(`${address}`, config);
                const data = await res.json();
                if (!res?.ok) {
                    const err = new Error(`HTTP code (${res?.status}): ${data.message}`);
                    throw err;
                }
                return data;
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

            // headers
            const config = buildHeaders();
            config.method = "POST";
            config.body = JSON.stringify(data);
            // url
            let address = new URL(url, globals.apiURL);

            try {
                const res = await fetch(`${address}`, config);
                const data = await res.json();
                if (!res?.ok) {
                    const err = new Error(`HTTP code (${res?.status}): ${data.message}`);
                    throw err;
                }
                return data;
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