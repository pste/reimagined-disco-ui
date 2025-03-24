<script setup>
import { inject, ref } from 'vue'

const API = inject('API');

// data
const sources = ref([]);

// methods
async function loadSources() {
    sources.value = await API.get('/sources');
}

loadSources()
</script>

<template>
    <DataTable 
                :value="sources" 
                stripedRows 
                editMode="cell" 
                @cell-edit-complete="onCellEditComplete"
    >
        <Column headerStyle="width: 50px">
            <template #header="{ column }">
                <Button icon="pi pi-plus-circle" severity="secondary" />
            </template>
            <template #body="slotProps">
                <Button icon="pi pi-minus-circle" severity="secondary" />
            </template>
        </Column>
        
        <Column field="path" header="Path" bodyClass="long-text-col" >
            <template #editor="{ data, field }">
                <template>
                    <InputText v-model="data[field]" autofocus fluid />
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