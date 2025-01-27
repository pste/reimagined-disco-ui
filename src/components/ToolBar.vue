<script setup>
import useSessionStore from '@/stores/session'
import { useRouter } from 'vue-router'

const router = useRouter()
const session = useSessionStore()

function logout() {
    session.userLogout();
    router.replace('/');
}
</script>

<template>
    <Toolbar v-if="session.loggedIn">
        <template #start>
            <Button icon="pi pi-plus" class="mr-2" severity="secondary" text @click="logout" />
        </template>

        <template #center>
            <IconField>
                <InputIcon>
                    <i class="pi pi-search" />
                </InputIcon>
                <InputText placeholder="Search" />
            </IconField>
        </template>

        <template #end>
            {{ session.username }}
        </template>
    </Toolbar>
</template>