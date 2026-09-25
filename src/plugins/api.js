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

// timeoutMs (opzionale): senza, una connessione in stallo (tipico su mobile: cambio
// wifi/4G, galleria) lascia la fetch appesa per minuti. Il signal copre anche la
// lettura del body (res.json()), non solo l'attesa degli header
async function makeRequest(method, headers, url, querystring, body, timeoutMs) {
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
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
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

// quiet: niente toast (il chiamante gestisce da sé l'errore, es. i retry del cache feeder)
async function handleRequest(url, fn, quiet) {
    try {
        return await fn();
    }
    catch (err) {
        logger.error(`API ERROR: ${url}`);
        if (!quiet) {
            useErrorsStore().showError(err);
        }
    }
}

function createAPI() {
    return {
        buildURL: buildURL,

        // options.quiet: su errore niente toast (restituisce comunque undefined)
        // options.timeoutMs: richiesta annullata oltre questo tempo (→ undefined, come un errore)
        get: async (url, data, options) => {
            return handleRequest(url, async () => {
                const res = await makeRequest("GET", {'Content-Type': 'application/json'}, url, data, undefined, options?.timeoutMs);
                return res.json();
            }, options?.quiet);
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

        delete: async (url) => {
            return handleRequest(url, async () => {
                await makeRequest("DELETE", {}, url);
            });
        },
    }
}

export default {
    install: (app, options) => {
        app.provide("API", createAPI());
    }
}
