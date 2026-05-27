<script setup>
import { inject, ref, onMounted } from 'vue'

const API = inject('API');
const jobs = ref([]);

function statusSeverity(status) {
    const map = { pending: 'warn', running: 'info', done: 'success', error: 'danger' };
    return map[status] || 'secondary';
}

function statusIcon(status) {
    const map = {
        pending: 'pi pi-clock',
        running: 'pi pi-spin pi-spinner',
        done:    'pi pi-check-circle',
        error:   'pi pi-times-circle',
    };
    return map[status] || 'pi pi-question-circle';
}

function formatDate(val) {
    if (!val) return '—';
    return new Date(val).toLocaleString();
}

async function load() {
    jobs.value = await API.get('/jobs') ?? [];
}

onMounted(load);
</script>

<template>
    <div class="flex flex-column align-items-center pt-8 pb-6 gap-4 w-11 md:w-10 lg:w-8 xl:w-7">
        <Card class="w-full">
            <template #title>
                <div class="flex align-items-center justify-content-between">
                    <span>Jobs</span>
                    <Button icon="pi pi-refresh" severity="secondary" size="small" text @click="load" />
                </div>
            </template>
            <template #content>
                <div v-if="!jobs.length" class="text-center text-color-secondary py-4">
                    Nessun job trovato.
                </div>
                <DataTable v-else :value="jobs" dataKey="job_id" size="small" striped-rows>

                    <Column style="width: 3rem">
                        <template #body="{ data }">
                            <Tag :severity="statusSeverity(data.status)" :icon="statusIcon(data.status)" rounded />
                        </template>
                    </Column>

                    <Column field="name" header="Job" />

                    <Column header="Creato">
                        <template #body="{ data }">{{ formatDate(data.when) }}</template>
                    </Column>

                    <Column header="Avviato">
                        <template #body="{ data }">{{ formatDate(data.started) }}</template>
                    </Column>

                    <Column header="Concluso">
                        <template #body="{ data }">{{ formatDate(data.ended) }}</template>
                    </Column>

                    <Column header="Risultato">
                        <template #body="{ data }">
                            <span class="text-sm text-color-secondary">{{ data.result || '—' }}</span>
                        </template>
                    </Column>

                </DataTable>
            </template>
        </Card>
    </div>
</template>
