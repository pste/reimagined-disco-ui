import useSessionStore from '@/stores/session'
import useErrorsStore from '@/stores/errors'
import useGlobalsStore from '@/stores/globals'

async function makeRequest(method, headers, url, querystring, body) {
    // defer store usage (this handles circular reference between store => API => store)
    const errorsStore = useErrorsStore();
    const sessionStore = useSessionStore();
    const globals = useGlobalsStore();

    // fetch
    let address = new URL(url, globals.apiURL);
    if (querystring) {
        address += '?' + new URLSearchParams(querystring);
    }
    // api call
    try {
        const res = await fetch(address, {
            method,
            headers,
            credentials: 'include',
            body: JSON.stringify(body),
        });
        if (!res?.ok) {
            const resStatus = res?.status;
            const msg = data?.error || data?.message || "Generic GET Error";
            const err = new Error(`HTTP code (${resStatus}): ${msg}`);
            if (resStatus === 401) {
                console.error(err);
                errorsStore.pushError(err);
                sessionStore.userLogout();
            }
            else {
                throw err;
            }
        }
        return res;
    }
    catch (err) {
        console.error(`API GET ERROR: ${url}`);
        errorsStore.pushError(err);
    }
}

function createAPI() {
    return {
        get: async (url, data) => {
            const res = await makeRequest("GET", {'Content-Type': 'application/json'}, url, data);
            const resdata = await res.json();
            return resdata;
        },

        getBlob: async (url, data) => {
            const res = await makeRequest("GET", {'Content-Type': 'application/octet-stream'}, url, data);
            const resdata = await res.blob();
            return resdata;
        },

        post: async (url, data) => {
            const res = await makeRequest("POST", {'Content-Type': 'application/json'}, url, undefined, data);
            const resdata = await res.json();
            return resdata;
        }
    }
}

export default {
    install: (app, options) => {
        app.provide("API", createAPI());
    }
}