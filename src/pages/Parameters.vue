<script setup>
import { inject, ref, onMounted } from 'vue'

const API = inject('API');

// data
const sources = ref([]);
const aaa = ref('ciao');

// methods
async function loadSources() {
    sources.value = await API.get('/sources'); // { source_id, path }
}

function onCellEditComplete(event) {
    let { data, newValue, field } = event;
    console.log(`onCellEditComplete NOOP ${field}`);
}

onMounted(async () => {
  await loadSources();
})
</script>

<template>
    <DataTable 
                :value="sources" 
                dataKey="source_id"
                stripedRows 
                editMode="cell" 
                @cell-edit-complete="onCellEditComplete"
    >
        <!-- 1st column: add/rm buttons -->
        <Column headerStyle="width: 50px">
            <template #header>
                <Button icon="pi pi-plus-circle" severity="secondary" />
            </template>
            <template #body>
                <Button icon="pi pi-minus-circle" severity="secondary" />
            </template>
        </Column>
        <!-- other columns (with data) -->
        <Column header="Path" field="path" bodyClass="long-text-col" >
            <template #editor="{ data, field }">
                <template>
                    <InputText v-model="aaa" autofocus fluid :placeholder="data" />
                </template>
            </template>
        </Column>
    </DataTable>
</template>

<style scoped>
:deep(.p-datatable-table-container) {
    border-radius: var(--p-menubar-border-radius);
    min-width: 50rem;
}
:deep(.long-text-col) {
    word-break:break-all;
}
</style>