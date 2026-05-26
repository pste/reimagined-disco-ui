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
            sessionStore.userLogout();
            throw new Error('401 Unauthorized');
        }
        else {
            const data = await res.json();
            const msg = data?.error || data?.message || "Generic Fetch Error";
            throw new Error(`HTTP code (${resStatus}): ${msg}`);
        }
    }
    return res;
}

async function handleRequest(url, fn) {
    try {
        return await fn();
    }
    catch (err) {
        logger.error(`API ERROR: ${url}`);
        useErrorsStore().showError(err);
    }
}

function createAPI() {
    return {
        buildURL: buildURL,

        get: async (url, data) => {
            return handleRequest(url, async () => {
                const res = await makeRequest("GET", {'Content-Type': 'application/json'}, url, data);
                return res.json();
            });
        },

        getBlob: async (url, data) => {
            return handleRequest(url, async () => {
                const res = await makeRequest("GET", {'Content-Type': 'application/octet-stream'}, url, data);
                return res.blob();
            });
        },

        post: async (url, data, query) => {
            return handleRequest(url, async () => {
                const res = await makeRequest("POST", {'Content-Type': 'application/json'}, url, query, data);
                return res.json();
            });
        },
    }
}

export default {
    install: (app, options) => {
        app.provide("API", createAPI());
    }
}
