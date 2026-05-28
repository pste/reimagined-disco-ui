<script setup>
import { inject, ref, onMounted } from 'vue'

const API = inject('API');
const jobs = ref([]);

const JOB_TYPES = ['filescan', 'fullscan'];

function nextTenMinutes() {
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    d.setMinutes(Math.ceil((d.getMinutes() + 1) / 10) * 10);
    return d;
}

const newJob = ref({ name: null, when: nextTenMinutes() });

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

async function addJob() {
    await API.post('/jobs', { name: newJob.value.name, when: newJob.value.when });
    newJob.value = { name: null, when: nextTenMinutes() };
    await load();
}

async function deleteJob(job_id) {
    await API.delete(`/jobs/${job_id}`);
    await load();
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

                <!-- New job form -->
                <div class="flex flex-wrap gap-2 mb-4">
                    <Select
                        v-model="newJob.name"
                        :options="JOB_TYPES"
                        placeholder="Tipo job"
                    />
                    <DatePicker
                        v-model="newJob.when"
                        showTime
                        hourFormat="24"
                        placeholder="Data e ora"
                    />
                    <Button
                        label="Add"
                        icon="pi pi-plus"
                        :disabled="!newJob.name || !newJob.when"
                        @click="addJob"
                    />
                </div>

                <!-- Job list -->
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

                    <Column header="When">
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

                    <Column style="width: 3rem">
                        <template #body="{ data }">
                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                size="small"
                                text
                                rounded
                                @click="deleteJob(data.job_id)"
                            />
                        </template>
                    </Column>

                </DataTable>
            </template>
        </Card>
    </div>
</template>
