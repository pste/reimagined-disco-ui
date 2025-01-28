import useSessionStore from '@/stores/session'
import useErrorsStore from '@/stores/errors'
import useGlobalsStore from '@/stores/globals'

function buildHeaders(token) {
    return {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'authorization': 'Bearer ' + token
        }
    }
}

function createAPI() {
    const errorsStore = useErrorsStore();
    const sessionStore = useSessionStore();
    const globals = useGlobalsStore();

    return {
        get: async (url, data) => {
            // headers
            const config = buildHeaders(sessionStore.token);
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
                    const err = new Error(`HTTP code (${res?.status}): ${data.message}`)
                    throw err
                }
                return data
            }
            catch (err) {
                console.error(`API ERROR: ${url}`)
                errorsStore.pushError(err)
                throw err
            }
        },

        post: {
            // TODO
        }
    }
}

export default {
    install: (app, options) => {
        app.provide("API", createAPI());
    }
}