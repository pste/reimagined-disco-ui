<script setup>
import { inject, ref, onMounted } from 'vue'
import logger from '@/plugins/logger'
import useErrorsStore from '@/stores/errors'

const API = inject('API');
const errorsStore = useErrorsStore();

// data
const sources = ref([]);
const aaa = ref('ciao');
const pwd1 = ref('');
const pwd2 = ref('');

// methods
async function loadSources() {
    sources.value = await API.get('/sources'); // { source_id, path }
}

function onCellEditComplete(event) {
    let { data, newValue, field } = event;
    logger.log(`onCellEditComplete NOOP ${field}`);
}

async function savePassword() {
    if (pwd1.value !== pwd2.value) {
        // ERROR
        errorsStore.showError("Password does not match!");
    }
    else {
        await API.post('/user/password', { value: pwd1.value})
    }
}

// init page
onMounted(async () => {
  await loadSources();
})
</script>

<template>
    <div class="flex flex-column row-gap-2">
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

        <!-- PASSWORD CHANGE -->
        <InputGroup>
            <InputGroupAddon>
                <i class="pi pi-lock"></i>
            </InputGroupAddon>
            
            <IftaLabel>
                <InputText id="txtpwd1"  v-model="pwd1"  name="password1" type="password" />
                <label for="password1">Password</label>
            </IftaLabel>

            <IftaLabel>
                <InputText id="txtpwd2"  v-model="pwd2"  name="password2" type="password" />
                <label for="password2">Repeat Password</label>
            </IftaLabel>

            <Button @click="savePassword">Save</Button>
        </InputGroup>
        
    </div>
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