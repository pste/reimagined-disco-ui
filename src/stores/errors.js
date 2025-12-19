import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';

const useErrorsStore = defineStore('errors', () => {
    // the toast messaging service
    const toast = useToast();

    //
    // const errors = ref([]);

    //
    function showError(msg) {
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 });
    }

    function showMessage(msg) {
        toast.add({ severity: 'info', summary: 'Info', detail: msg, life: 3000 });
    }

    //
    return {
        showError,
        showMessage,
    }
})

export default useErrorsStore;