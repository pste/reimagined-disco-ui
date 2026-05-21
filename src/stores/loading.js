import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const useLoadingStore = defineStore('loading', () => {
    const count = ref(0);
    const isLoading = computed(() => count.value > 0);

    function start() {
        count.value++;
    }
    function stop() {
        if (count.value > 0) {
            count.value--;
        }
    }

    return {
        isLoading,
        start,
        stop,
    }
})

export default useLoadingStore;
