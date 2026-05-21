import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';

const ERROR_LIFE = 4000;
const MESSAGE_LIFE = 3000;

const useErrorsStore = defineStore('errors', () => {
    const toast = useToast();

    // dedup: tracks active error messages to avoid flooding
    const activeErrors = new Map(); // key (string) → clearTimeout handle

    function showError(err) {
        const detail = String(err?.message ?? err ?? 'Errore sconosciuto');
        if (activeErrors.has(detail)) { return; }
        const handle = setTimeout(() => activeErrors.delete(detail), ERROR_LIFE);
        activeErrors.set(detail, handle);
        toast.add({ severity: 'error', summary: 'Errore', detail, life: ERROR_LIFE });
    }

    function showMessage(msg) {
        toast.add({ severity: 'info', summary: 'Info', detail: msg, life: MESSAGE_LIFE });
    }

    return {
        showError,
        showMessage,
    }
})

export default useErrorsStore;