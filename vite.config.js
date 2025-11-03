import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { fileURLToPath, URL } from 'node:url'
// primevue unplugin auto import
import Components from 'unplugin-vue-components/vite';
import {PrimeVueResolver} from '@primevue/auto-import-resolver';

// https://vite.dev/config/
export default defineConfig({
    server: {
        // host: 'localhost',
        host: 'localhost.saba.net',
        port: 3000,
        // allowedHosts: ['localhost.saba.net'],
    },
    plugins: [
        vue(),
        vueDevTools(),
        Components({
            resolvers: [
              PrimeVueResolver()
            ]
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
})
