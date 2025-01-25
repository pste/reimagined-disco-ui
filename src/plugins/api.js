import userStore from '@/stores/userStore'
import errorsStore from '@/stores/errorsStore'

const baseaddress = 'http://127.0.0.1:3001' // TODO

function buildHeaders() {
    const token = userStore.token; // should be undefined or a valid token
    return {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'authorization': 'Bearer ' + token
        }
    }
}

function createAPI() {
    return {
        get: async (url, data) => {
            // headers
            const config = buildHeaders();
            // url
            let address = new URL(url, baseaddress);
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