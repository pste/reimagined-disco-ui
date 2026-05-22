<script setup>
import { inject, ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import useCollectionStore from '@/stores/collection'
import useCoversStore from '@/stores/covers'
import useLoadingStore from '@/stores/loading'

const route = useRoute();
const router = useRouter();
const API = inject('API');
const collectionStore = useCollectionStore();
const coversStore = useCoversStore();
const loadingStore = useLoadingStore();

const album = computed(() => collectionStore.getAlbum(route.params.albumid));

const tracks = ref([]);
const albumMeta = ref({ albumTitle: '', artist: '', year: '', genre: '' });
const image = ref(null);
const editing = ref(false);
const saving = ref(false);

async function load() {
    loadingStore.start();
    try {
        const songs = await API.get('/search/songs', { albumid: route.params.albumid });
        if (!songs?.length) { return; }

        songs.sort((a, b) => {
            if (a.disc_nr !== b.disc_nr) { return a.disc_nr - b.disc_nr; }
            return a.track_nr - b.track_nr;
        });

        const id3List = await Promise.all(songs.map(s => API.get('/song/id3', { id: s.song_id })));

        const first = id3List[0] ?? {};
        albumMeta.value = {
            albumTitle: first.album  ?? '',
            artist:     first.artist ?? '',
            year:       first.year   ?? '',
            genre:      Array.isArray(first.genre) ? first.genre.join(', ') : (first.genre ?? ''),
        };

        tracks.value = songs.map((s, i) => {
            const id3 = id3List[i] ?? {};
            return {
                songId:  s.song_id,
                title:   id3.title     ?? '',
                trackNo: id3.track?.no ?? null,
                discNo:  id3.disk?.no  ?? null,
                bitrate: id3.bitrate   ?? null,
            };
        });

        const blob = await coversStore.get(route.params.albumid);
        if (blob) { image.value = URL.createObjectURL(blob); }
    }
    finally {
        loadingStore.stop();
    }
}

async function save() {
    saving.value = true;
    try {
        for (const track of tracks.value) {
            const body = {
                title:  track.title                || null,
                album:  albumMeta.value.albumTitle || null,
                artist: albumMeta.value.artist     || null,
                year:   albumMeta.value.year       || null,
                genre:  albumMeta.value.genre      || null,
                track:  track.trackNo != null ? { no: track.trackNo } : null,
                disk:   track.discNo  != null ? { no: track.discNo  } : null,
            };
            await API.post('/song/id3', body, { id: track.songId });
        }
        collectionStore.updateAlbum(route.params.albumid, {
            title: albumMeta.value.albumTitle,
            name:  albumMeta.value.artist,
            year:  albumMeta.value.year,
        });
        const blob = await coversStore.refresh(route.params.albumid);
        if (blob) {
            if (image.value) { URL.revokeObjectURL(image.value); }
            image.value = URL.createObjectURL(blob);
        }
        editing.value = false;
    }
    finally {
        saving.value = false;
    }
}

function autoFillTrackNumbers() {
    const counters = new Map();
    for (const track of tracks.value) {
        const disc = track.discNo ?? 1;
        counters.set(disc, (counters.get(disc) ?? 0) + 1);
        track.trackNo = counters.get(disc);
    }
}

function propagateDisc(fromIndex) {
    const val = tracks.value[fromIndex].discNo;
    for (let i = fromIndex + 1; i < tracks.value.length; i++) {
        tracks.value[i].discNo = val;
    }
}

onMounted(load);
onUnmounted(() => { if (image.value) { URL.revokeObjectURL(image.value); } });
</script>

<template>
    <div class="flex justify-content-center py-6 w-11 md:w-10 lg:w-8 xl:w-7">
        <Card class="w-full">
            <template #title>
                <div class="flex align-items-center gap-2">
                    <Button icon="pi pi-arrow-left" text rounded severity="secondary" size="small" @click="router.back()" aria-label="Indietro" />
                    <span class="flex-grow-1">{{ album?.title ?? 'Dettagli album' }}</span>
                    <template v-if="editing">
                        <Button label="Salva" icon="pi pi-check" severity="primary" size="small" text :loading="saving" @click="save" />
                        <Button label="Annulla" icon="pi pi-times" severity="danger" size="small" text :disabled="saving" @click="editing = false" />
                    </template>
                    <Button v-else label="Modifica" icon="pi pi-pencil" severity="secondary" size="small" text @click="editing = true" />
                </div>
            </template>

            <template #content>
                <!-- common fields -->
                <div class="album-header">
                    <div class="cover-col">
                        <img v-if="image" class="cover-img" :src="image" />
                        <div v-else class="cover-placeholder" />
                    </div>
                    <div class="fields-col">
                        <div class="field-row">
                            <label class="field-label">Titolo album</label>
                            <span v-if="!editing">{{ albumMeta.albumTitle || '—' }}</span>
                            <InputText v-else v-model="albumMeta.albumTitle" class="w-full" size="small" />
                        </div>
                        <div class="field-row">
                            <label class="field-label">Artista</label>
                            <span v-if="!editing">{{ albumMeta.artist || '—' }}</span>
                            <InputText v-else v-model="albumMeta.artist" class="w-full" size="small" />
                        </div>
                        <div class="field-row">
                            <label class="field-label">Anno</label>
                            <span v-if="!editing">{{ albumMeta.year || '—' }}</span>
                            <InputText v-else v-model="albumMeta.year" class="w-full" size="small" />
                        </div>
                        <div class="field-row">
                            <label class="field-label">Genere</label>
                            <span v-if="!editing">{{ albumMeta.genre || '—' }}</span>
                            <InputText v-else v-model="albumMeta.genre" class="w-full" size="small" />
                        </div>
                    </div>
                </div>

                <!-- tracks -->
                <DataTable :value="tracks" size="small" striped-rows>
                    <Column header="Disco" class="col-narrow">
                        <template #body="{ data, index }">
                            <span v-if="!editing">{{ data.discNo ?? '—' }}</span>
                            <div v-else class="disc-edit-cell">
                                <InputNumber v-model="data.discNo" :min="1" inputClass="col-number-input" />
                                <Button
                                    v-if="index < tracks.length - 1"
                                    icon="pi pi-arrow-down"
                                    text rounded size="small" severity="secondary"
                                    @click="propagateDisc(index)"
                                    aria-label="Copia sui successivi"
                                />
                            </div>
                        </template>
                    </Column>
                    <Column class="col-narrow">
                        <template #header>
                            <div class="flex align-items-center gap-1">
                                <span>Traccia</span>
                                <Button
                                    v-if="editing"
                                    icon="pi pi-sort-numeric-down"
                                    text rounded size="small" severity="secondary"
                                    @click="autoFillTrackNumbers"
                                    aria-label="Numera automaticamente"
                                />
                            </div>
                        </template>
                        <template #body="{ data }">
                            <span v-if="!editing">{{ data.trackNo ?? '—' }}</span>
                            <InputNumber v-else v-model="data.trackNo" :min="1" inputClass="col-number-input" />
                        </template>
                    </Column>
                    <Column header="Titolo">
                        <template #body="{ data }">
                            <span v-if="!editing">{{ data.title || '—' }}</span>
                            <InputText v-else v-model="data.title" class="w-full" size="small" />
                        </template>
                    </Column>
                    <Column header="Bitrate" class="col-bitrate">
                        <template #body="{ data }">
                            <span class="text-color-secondary text-sm">{{ data.bitrate ? data.bitrate + ' kbps' : '—' }}</span>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>
    </div>
</template>

<style scoped>
.album-header {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
    align-items: flex-start;
}

.cover-col {
    flex: none;
}

.cover-img,
.cover-placeholder {
    width: 150px;
    height: 150px;
    border-radius: 6px;
}

.cover-img {
    object-fit: cover;
    box-shadow: var(--p-shadow-2, 0 2px 8px rgba(0,0,0,.15));
}

.cover-placeholder {
    background: var(--p-surface-200, #e5e7eb);
}

.fields-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
}

.field-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.field-label {
    font-size: 0.7rem;
    opacity: 0.55;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

:deep(.col-narrow) {
    width: 5rem;
}

:deep(.col-bitrate) {
    width: 7rem;
}

:deep(.col-number-input) {
    width: 4rem;
    text-align: center;
}

.disc-edit-cell {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
</style>
