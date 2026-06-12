<script setup>
import { ref, computed, onMounted } from 'vue'
import useLoadingStore from '@/stores/loading'
import useCacheStore from '@/stores/cache'

const cacheStore = useCacheStore();
const loadingStore = useLoadingStore();

const CACHE_TABLE = 'chunks';

const allChunks = ref([]);
const deleting = ref(null); // songId currently being deleted

const songs = computed(() => {
    const map = new Map();
    for (const record of allChunks.value) {
        const data = record.data;
        if (!data?.songId) { continue; } // skip malformed records
        const { songId, expiresAt } = data;
        const size = data.blob?.size ?? 0;
        if (!map.has(songId)) {
            map.set(songId, { songId, chunks: 0, totalBytes: 0, expiresAt: 0, meta: null });
        }
        const entry = map.get(songId);
        entry.chunks++;
        entry.totalBytes += size;
        if (expiresAt > entry.expiresAt) {
            entry.expiresAt = expiresAt;
        }
        if (!entry.meta && data.meta) {
            entry.meta = data.meta;
        }
    }
    return Array.from(map.values()).sort((a, b) => b.expiresAt - a.expiresAt);
});

const totalSize = computed(() =>
    songs.value.reduce((acc, s) => acc + s.totalBytes, 0)
);

async function loadCache() {
    loadingStore.start();
    try {
        allChunks.value = await cacheStore.getAll(CACHE_TABLE);
    }
    finally {
        loadingStore.stop();
    }
}

// le mutazioni passano dallo store cache, che tiene aggiornata
// la Map reattiva (spunte "in cache" della pagina Album)
async function deleteSong(songId) {
    deleting.value = songId;
    loadingStore.start();
    try {
        await cacheStore.removeSong(songId);
        allChunks.value = await cacheStore.getAll(CACHE_TABLE);
    }
    finally {
        deleting.value = null;
        loadingStore.stop();
    }
}

async function deleteAll() {
    loadingStore.start();
    try {
        await cacheStore.removeAll();
        allChunks.value = [];
    }
    finally {
        loadingStore.stop();
    }
}

async function sweepExpired() {
    loadingStore.start();
    try {
        await cacheStore.sweep();
        allChunks.value = await cacheStore.getAll(CACHE_TABLE);
    }
    finally {
        loadingStore.stop();
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function daysUntil(ts) {
    if (!ts) return '—';
    const days = Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'scaduto';
    return `${days} gg`;
}

onMounted(loadCache);
</script>

<template>
    <div class="flex justify-content-center py-6 w-11 md:w-10 lg:w-8 xl:w-7">
        <Card class="w-full">
            <template #title>
                <div class="flex align-items-center justify-content-between">
                    <span>Cache locale</span>
                    <div class="flex gap-2">
                        <Button
                            v-if="songs.length > 0"
                            label="Elimina tutto"
                            icon="pi pi-trash"
                            severity="danger"
                            size="small"
                            text
                            @click="deleteAll"
                        />
                        <Button
                            label="Sweep scaduti"
                            icon="pi pi-clock"
                            severity="secondary"
                            size="small"
                            text
                            @click="sweepExpired"
                        />
                        <Button
                            icon="pi pi-refresh"
                            severity="secondary"
                            size="small"
                            text
                            @click="loadCache"
                        />
                    </div>
                </div>
            </template>

            <template #content>
                <div v-if="songs.length === 0" class="text-center text-color-secondary py-4">
                    Cache vuota.
                </div>

                <DataTable v-else :value="songs" size="small" striped-rows>
                    <template #header>
                        <div class="text-sm text-color-secondary">
                            {{ songs.length }} brani · {{ formatSize(totalSize) }} totali
                        </div>
                    </template>

                    <Column header="Canzone">
                        <template #body="{ data }">
                            <span v-if="data.meta">
                                {{ data.meta.artist }} · {{ data.meta.album }} · <b>{{ data.meta.title }}</b>
                            </span>
                            <span v-else class="text-color-secondary">#{{ data.songId }}</span>
                        </template>
                    </Column>

                    <Column field="chunks" header="Chunks" />

                    <Column header="Dimensione">
                        <template #body="{ data }">
                            {{ formatSize(data.totalBytes) }}
                        </template>
                    </Column>

                    <Column header="Scade tra">
                        <template #body="{ data }">
                            {{ daysUntil(data.expiresAt) }}
                        </template>
                    </Column>

                    <Column header="">
                        <template #body="{ data }">
                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                size="small"
                                text
                                rounded
                                :loading="deleting === data.songId"
                                @click="deleteSong(data.songId)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>
    </div>
</template>
