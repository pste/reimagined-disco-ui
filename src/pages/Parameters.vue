<script setup>
import { inject, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import useErrorsStore from '@/stores/errors'
import useParametersStore from '@/stores/parameters'

const API = inject('API');
const errorsStore = useErrorsStore();
const parametersStore = useParametersStore();
const { cronRequeue, cacheTTLDays, favCacheTTLDays } = storeToRefs(parametersStore);

// data
const sources = ref([]);
const pwd1 = ref('');
const pwd2 = ref('');

// methods
async function loadSources() {
    sources.value = await API.get('/sources'); // { source_id, path }
}

async function savePassword() {
    if (pwd1.value !== pwd2.value) {
        errorsStore.showError("Password does not match!");
    }
    else {
        await API.post('/user/password', { value: pwd1.value });
    }
}

// init page
onMounted(async () => {
    await loadSources();
    await parametersStore.load();
})
</script>

<template>
    <div class="flex flex-column align-items-center pt-8 pb-6 gap-4 w-11 md:w-10 lg:w-8 xl:w-7">

        <!-- Sorgenti musicali -->
        <Card class="w-full">
            <template #title>
                <div class="flex align-items-center justify-content-between">
                    <span>Sorgenti musicali</span>
                    <Button
                        icon="pi pi-refresh"
                        severity="secondary"
                        size="small"
                        text
                        @click="loadSources"
                    />
                </div>
            </template>

            <template #content>
                <div v-if="sources.length === 0" class="text-center text-color-secondary py-4">
                    Nessuna sorgente configurata.
                </div>

                <DataTable
                    v-else
                    :value="sources"
                    dataKey="source_id"
                    size="small"
                    striped-rows
                >
                    <Column header="Path" field="path" />
                </DataTable>
            </template>
        </Card>

        <!-- Pianificazione scan -->
        <Card class="w-full">
            <template #title>
                <span>Pianificazione scan</span>
            </template>

            <template #content>
                <div class="flex flex-column gap-3">
                    <IftaLabel>
                        <InputText id="txtCronRequeue" v-model="cronRequeue" fluid />
                        <label for="txtCronRequeue">Cron riaccodamento scan (es. 0 2 * * *)</label>
                    </IftaLabel>

                    <IftaLabel>
                        <InputNumber id="numCacheTTL" v-model="cacheTTLDays" :min="1" :max="365" fluid />
                        <label for="numCacheTTL">Durata cache (giorni)</label>
                    </IftaLabel>

                    <IftaLabel>
                        <InputNumber id="numFavCacheTTL" v-model="favCacheTTLDays" :min="1" :max="365" fluid />
                        <label for="numFavCacheTTL">Durata cache preferiti (giorni)</label>
                    </IftaLabel>

                    <div class="flex justify-content-end">
                        <Button label="Salva" icon="pi pi-check" @click="parametersStore.save()" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Cambio password -->
        <Card class="w-full">
            <template #title>
                <span>Cambio password</span>
            </template>

            <template #content>
                <div class="flex flex-column gap-3">
                    <InputGroup>
                        <InputGroupAddon>
                            <i class="pi pi-lock"></i>
                        </InputGroupAddon>
                        <IftaLabel>
                            <InputText id="txtpwd1" v-model="pwd1" name="password1" type="password" />
                            <label for="txtpwd1">Nuova password</label>
                        </IftaLabel>
                    </InputGroup>

                    <InputGroup>
                        <InputGroupAddon>
                            <i class="pi pi-lock"></i>
                        </InputGroupAddon>
                        <IftaLabel>
                            <InputText id="txtpwd2" v-model="pwd2" name="password2" type="password" />
                            <label for="txtpwd2">Conferma password</label>
                        </IftaLabel>
                    </InputGroup>

                    <div class="flex justify-content-end">
                        <Button label="Salva" icon="pi pi-check" @click="savePassword" />
                    </div>
                </div>
            </template>
        </Card>

    </div>
</template>
