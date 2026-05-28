import { defineStore } from 'pinia';
import { ref, inject } from 'vue';

const useParametersStore = defineStore('parameters', () => {
    const API = inject('API');

    const cronRequeue = ref('');
    const cacheTTLDays = ref(7);
    const _loaded = ref(false);

    async function load() {
        if (_loaded.value) return;
        const data = await API.get('/parameters');
        if (data?.length > 0) {
            cronRequeue.value = data[0].cronRequeue ?? '';
            cacheTTLDays.value = data[0].cacheTTLDays ?? 7;
        }
        _loaded.value = true;
    }

    async function save() {
        await API.post('/parameters', {
            cronRequeue: cronRequeue.value,
            cacheTTLDays: cacheTTLDays.value,
        });
    }

    return { cronRequeue, cacheTTLDays, load, save };
});

export default useParametersStore;
