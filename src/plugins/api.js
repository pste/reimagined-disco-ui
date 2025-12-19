import useSessionStore from '@/stores/session'
import useErrorsStore from '@/stores/errors'
import useGlobalsStore from '@/stores/globals'

const logger = console; // PSTE TODO REF LOGGER PLUGIN

function buildURL(base, url) {
    if (base.endsWith("/")) {
        base = base.slice(0, base.length-1);
    }
    return `${base}${url}`;
}

async function makeRequest(method, headers, url, querystring, body) {
    // defer store usage (this handles circular reference between store => API => store)
    const errorsStore = useErrorsStore();
    const sessionStore = useSessionStore();
    const globals = useGlobalsStore();

    // fetch
    let address = buildURL(globals.apiURL, url);
    if (querystring) {
        address += '?' + new URLSearchParams(querystring);
    }
    // api call
    const res = await fetch(address, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
    });
    if (!res?.ok) {
        const resStatus = res?.status;
        if (resStatus === 401) {
            errorsStore.showError("401 Unauthorized");
            sessionStore.userLogout();
        }
        else {
            const data = res.json();
            const msg = data?.error || data?.message || "Generic Fetch Error";
            const err = new Error(`HTTP code (${resStatus}): ${msg}`);
            throw err;
        }
    }
    return res;
}

function createAPI() {
    const errorsStore = useErrorsStore();

    return {
        buildURL: buildURL,

        get: async (url, data) => {
            try {
                const res = await makeRequest("GET", {'Content-Type': 'application/json'}, url, data);
                const resdata = await res.json();
                return resdata;
            }
            catch (err) {
                logger.error(`API ERROR: ${url}`);
                errorsStore.showError(err);
            }
        },

        getBlob: async (url, data) => {
            try {
                const res = await makeRequest("GET", {'Content-Type': 'application/octet-stream'}, url, data);
                const resdata = await res.blob();
                return resdata;
            }
            catch (err) {
                logger.error(`API ERROR: ${url}`);
                errorsStore.showError(err);
            }
        },

        post: async (url, data) => {
            try {
                const res = await makeRequest("POST", {'Content-Type': 'application/json'}, url, undefined, data);
                const resdata = await res.json();
                return resdata;
            }
            catch (err) {
                logger.error(`API ERROR: ${url}`);
                errorsStore.showError(err);
            }
        }
    }
}

export default {
    install: (app, options) => {
        app.provide("API", createAPI());
    }
}