import { defineStore } from 'pinia';
import { inject } from 'vue';
import useSessionStore from '@/stores/session'

// log diagnostico verso il DB (tabella logs, righe "CLIENT <evento>"): dal telefono i log
// della console non si vedono. Gli eventi vanno prima in localStorage, così sopravvivono
// alla pagina congelata o chiusa in background, e partono a blocchi verso l'API; si tolgono
// dal buffer solo a invio riuscito → quelli del blackout arrivano alla riapertura dell'app
const STORAGE_KEY = 'clientlog:pending';
const MAX_PENDING = 500; // oltre, si tengono solo i più recenti
const MAX_BATCH = 200; // limite della rotta /clientlog
const FLUSH_INTERVAL_MS = 15000;

function readPending() {
    try {
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    }
    catch (_) {
        return [];
    }
}

function writePending(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_PENDING)));
    }
    catch (_) { /* storage pieno o bloccato: il log diagnostico non deve rompere nulla */ }
}

const useClientLogStore = defineStore('clientLog', () => {
    const API = inject('API');
    const sessionStore = useSessionStore();
    let flushing = false;

    function log(event, details) {
        const list = readPending();
        list.push({ t: new Date().toISOString(), event, details: details ?? {} });
        writePending(list);
    }

    async function flush() {
        if (flushing || !sessionStore.user.name) { return; } // senza login la rotta darebbe 401
        const batch = readPending().slice(0, MAX_BATCH);
        if (batch.length === 0) { return; }
        flushing = true;
        try {
            const res = await API.post('/clientlog', { events: batch }, undefined, { quiet: true });
            if (res?.ok) {
                // rilettura: nel frattempo possono essere arrivati altri eventi (in coda)
                writePending(readPending().slice(batch.length));
            }
        }
        finally {
            flushing = false;
        }
    }

    // invio periodico + all'avvio + a ogni cambio di visibilità della pagina
    setInterval(flush, FLUSH_INTERVAL_MS);
    document.addEventListener('visibilitychange', flush);
    flush();

    return { log, flush };
});

export default useClientLogStore;
