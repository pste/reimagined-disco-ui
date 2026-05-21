<script setup>
import useLoadingStore from '@/stores/loading'

const loading = useLoadingStore()
</script>

<template>
    <Transition name="loadbar">
        <div v-if="loading.isLoading" class="loading-bar">
            <span class="loading-sweep"></span>
        </div>
    </Transition>
</template>

<style scoped>
.loading-bar {
    width: 100%;
    height: 3px;
    background: rgba(139, 92, 246, 0.15);
    overflow: hidden;
    position: relative;
}

.loading-sweep {
    position: absolute;
    top: 0;
    height: 100%;
    width: 45%;
    background: linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, transparent);
    animation: sweep 1.6s ease-in-out infinite;
}

@keyframes sweep {
    0%   { left: -45%; }
    100% { left: 100%; }
}

.loadbar-enter-active,
.loadbar-leave-active {
    transition: opacity 0.2s ease;
}
.loadbar-enter-from,
.loadbar-leave-to {
    opacity: 0;
}
</style>
