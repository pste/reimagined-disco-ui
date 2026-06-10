<script setup>
import { ref, computed, watch, inject } from 'vue'

const props = defineProps({
    visible: { type: Boolean, default: false },
    albumId: { type: [String, Number], required: true },
    artist:  { type: String, default: '' },
    album:   { type: String, default: '' },
    mbid:    { type: String, default: null }, // release-group MBID già noto (salta la search testuale)
});
const emit = defineEmits(['update:visible', 'saved']);

const API = inject('API');

const proposals = ref([]);
const releaseGroupId = ref(null);
const selected = ref(null);
const loadingFast = ref(false);
const loadingMore = ref(false);
const saving = ref(false);

// parametri di ricerca editabili (pre-compilati dai props all'apertura)
const searchArtist = ref('');
const searchAlbum = ref('');

// paginazione "altre opzioni": lista release del gruppo, consumata a batch
const BATCH = 5;
const releaseIds = ref([]);
const releaseIdsLoaded = ref(false);
const nextIndex = ref(0);

// prima di caricare la lista assumiamo che ci siano altre opzioni; dopo, solo finché restano release
const hasMore = computed(() => !releaseIdsLoaded.value || nextIndex.value < releaseIds.value.length);
const moreButtonVisible = computed(() => !!releaseGroupId.value && hasMore.value);

const dialogVisible = computed({
    get: () => props.visible,
    set: (val) => emit('update:visible', val),
});

function reset() {
    proposals.value = [];
    releaseGroupId.value = null;
    selected.value = null;
    releaseIds.value = [];
    releaseIdsLoaded.value = false;
    nextIndex.value = 0;
    searchArtist.value = props.artist;
    searchAlbum.value = props.album;
}

// aggiunge i nuovi candidati saltando quelli già presenti (stessa imageId)
function mergeDedup(list) {
    const seen = new Set(proposals.value.map(c => c.imageId));
    for (const c of list) {
        if (!seen.has(c.imageId)) {
            seen.add(c.imageId);
            proposals.value.push(c);
        }
    }
}

// useMbid=true solo per la ricerca automatica all'apertura (usa il release-group già noto);
// la ricerca manuale dopo modifica dei campi è puramente testuale (scarta il mbid).
async function fetchFast({ useMbid = false } = {}) {
    loadingFast.value = true;
    try {
        const query = { artist: searchArtist.value, album: searchAlbum.value };
        // mbid solo se noto e richiesto: altrimenti URLSearchParams manderebbe "null"
        if (useMbid && props.mbid) { query.mbid = props.mbid; }
        const data = await API.get('/cover/fetch', query);
        proposals.value = data?.candidates ?? [];
        releaseGroupId.value = data?.releaseGroupId ?? null;
        selected.value = proposals.value[0] ?? null;
        // nuova ricerca: invalida la paginazione "altre opzioni"
        releaseIds.value = [];
        releaseIdsLoaded.value = false;
        nextIndex.value = 0;
    }
    finally {
        loadingFast.value = false;
    }
}

// Carica una volta sola la lista degli id release del gruppo.
async function ensureReleaseIds() {
    if (releaseIdsLoaded.value || !releaseGroupId.value) { return; }
    const data = await API.get('/cover/fetch/releases', { mbid: releaseGroupId.value });
    if (!data) { return; } // errore: lascia riprovare al prossimo click
    releaseIds.value = data.releaseIds ?? [];
    nextIndex.value = 0;
    releaseIdsLoaded.value = true;
}

// Carica i prossimi batch di front: BATCH richieste /cover/fetch/front in parallelo (Promise.all),
// è l'API a throttlarle. candidate=null (release senza front) ed errori si scartano.
// Molte release non hanno una front propria: si continua coi batch finché non arriva
// almeno una cover nuova (o le release finiscono), così il click non sembra a vuoto.
async function loadMore() {
    if (!releaseGroupId.value) { return; }
    loadingMore.value = true;
    try {
        await ensureReleaseIds();
        while (nextIndex.value < releaseIds.value.length) {
            const batch = releaseIds.value.slice(nextIndex.value, nextIndex.value + BATCH);
            const results = await Promise.all(batch.map(id => API.get('/cover/fetch/front', { id })));
            const before = proposals.value.length;
            mergeDedup(results.map(r => r?.candidate).filter(Boolean));
            nextIndex.value += batch.length;
            if (proposals.value.length > before) { break; }
        }
    }
    finally {
        loadingMore.value = false;
    }
}

// base64 (dalla risposta del save) → Blob, per aggiornare subito la cache cover
function base64ToBlob(b64, mime) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

async function save() {
    if (!selected.value) { return; }
    saving.value = true;
    try {
        const res = await API.post('/cover/save', {
            album_id: props.albumId,
            imageUrl: selected.value.imageUrl,
            mbid: releaseGroupId.value,
        });
        // su errore (es. 502 archive.org giù) l'API client mostra già l'errore globale e res è undefined
        if (res?.ok) {
            const blob = base64ToBlob(res.cover, res.mime);
            emit('saved', blob);
            dialogVisible.value = false;
        }
    }
    finally {
        saving.value = false;
    }
}

// una front rotta lato CAA: la togliamo dalla griglia
function onImgError(candidate) {
    proposals.value = proposals.value.filter(c => c.imageId !== candidate.imageId);
    if (selected.value?.imageId === candidate.imageId) {
        selected.value = proposals.value[0] ?? null;
    }
}

// le proposte fast possono venire da release-group diversi: la paginazione "altre opzioni"
// segue il gruppo della cover selezionata (anche il save persiste quel gruppo)
watch(selected, (sel) => {
    if (sel?.releaseGroupId && sel.releaseGroupId !== releaseGroupId.value) {
        releaseGroupId.value = sel.releaseGroupId;
        releaseIds.value = [];
        releaseIdsLoaded.value = false;
        nextIndex.value = 0;
    }
});

// carica le proposte solo all'apertura del dialog
watch(() => props.visible, (open) => {
    if (open) {
        reset();
        fetchFast({ useMbid: true });
    }
});
</script>

<template>
    <Dialog v-model:visible="dialogVisible" modal header="Scegli la cover"
            :style="{ width: '40rem' }" :breakpoints="{ '768px': '95vw' }" :dismissableMask="true">
        <div class="picker-search">
            <InputText v-model="searchArtist" placeholder="Artista" :disabled="loadingFast" @keyup.enter="fetchFast()" />
            <InputText v-model="searchAlbum" placeholder="Album" :disabled="loadingFast" @keyup.enter="fetchFast()" />
            <Button icon="pi pi-search" label="Cerca" :loading="loadingFast" @click="fetchFast()" />
        </div>

        <div v-if="loadingFast" class="picker-status">
            <ProgressSpinner class="picker-spinner" strokeWidth="4" />
            <span>Ricerca cover…</span>
        </div>

        <div v-else-if="!proposals.length" class="picker-status">
            Nessuna cover trovata per «{{ searchAlbum || 'questo album' }}».
        </div>

        <div v-else class="picker-grid">
            <button
                v-for="c in proposals"
                :key="c.imageId"
                type="button"
                class="picker-thumb"
                :class="{ selected: selected?.imageId === c.imageId }"
                @click="selected = c"
            >
                <img :src="c.thumbUrl" :alt="c.album" loading="lazy" @error="onImgError(c)" />
                <!-- album+anno per distinguere release-group diversi; le front lazy non hanno metadati -->
                <span class="picker-caption">{{ c.album || 'altra edizione' }}<template v-if="c.year"> ({{ c.year }})</template></span>
            </button>
        </div>

        <div v-if="loadingMore" class="picker-status picker-more">
            <ProgressSpinner class="picker-spinner" strokeWidth="4" />
            <span>Cerco altre cover… (può richiedere qualche secondo)</span>
        </div>

        <template #footer>
            <div class="picker-footer">
                <Button
                    v-if="moreButtonVisible"
                    :label="releaseIdsLoaded ? 'Carica altre' : 'Mostra altre opzioni'"
                    icon="pi pi-images"
                    text severity="secondary"
                    :loading="loadingMore"
                    :disabled="loadingFast"
                    @click="loadMore"
                />
                <div class="picker-spacer" />
                <Button label="Annulla" icon="pi pi-times" text severity="secondary" :disabled="saving" @click="dialogVisible = false" />
                <Button label="Usa questa" icon="pi pi-check" :loading="saving" :disabled="!selected" @click="save" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.picker-search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.picker-search .p-inputtext {
    flex: 1;
    min-width: 0;
}

.picker-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 9rem;
    color: var(--p-text-muted-color, #888);
}

/* indicatore "altre opzioni": sotto la griglia, compatto */
.picker-more {
    min-height: 0;
    margin-top: 0.75rem;
    font-size: 0.9rem;
}

.picker-spinner {
    width: 2.5rem;
    height: 2.5rem;
}

.picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.75rem;
    max-height: 24rem;
    overflow-y: auto;
    padding: 0.25rem;
}

.picker-thumb {
    padding: 0;
    border: 2px solid transparent;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.picker-thumb img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
}

.picker-caption {
    max-width: 100%;
    padding: 0.15rem 0.2rem;
    font-size: 0.7rem;
    line-height: 1.2;
    color: var(--p-text-muted-color, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.picker-thumb.selected {
    border-color: var(--p-primary-color, #3b82f6);
    box-shadow: 0 0 0 2px var(--p-primary-color, #3b82f6);
}

.picker-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
}

.picker-spacer {
    flex: 1;
}

/* Mobile: ricerca su due righe (input affiancati, bottone sotto) e footer che va a capo */
@media (max-width: 767px) {
    .picker-search {
        flex-wrap: wrap;
    }

    .picker-search .p-inputtext {
        flex: 1 1 40%;
    }

    .picker-search .p-button {
        flex: 1 1 100%;
    }

    .picker-footer {
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .picker-grid {
        grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
        max-height: 50vh;
    }
}
</style>
