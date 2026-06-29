import { defineStore } from 'pinia';
import { ref, inject } from 'vue';

const useParametersStore = defineStore('parameters', () => {
    const API = inject('API');

    const cronRequeue = ref('');
    const cacheTTLDays = ref(7);
    const favCacheTTLDays = ref(30);
    const _loaded = ref(false);

    async function load() {
        if (_loaded.value) return;
        const data = await API.get('/parameters');
        if (data?.length > 0) {
            cronRequeue.value = data[0].cronRequeue ?? '';
            cacheTTLDays.value = data[0].cacheTTLDays ?? 7;
            favCacheTTLDays.value = data[0].favCacheTTLDays ?? 30;
        }
        _loaded.value = true;
    }

    async function save() {
        await API.post('/parameters', {
            cronRequeue: cronRequeue.value,
            cacheTTLDays: cacheTTLDays.value,
            favCacheTTLDays: favCacheTTLDays.value,
        });
    }

    return { cronRequeue, cacheTTLDays, favCacheTTLDays, load, save };
});

export default useParametersStore;
