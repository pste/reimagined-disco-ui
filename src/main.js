import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

import { registerPlugins } from '@/plugins';
import { registerSW } from 'virtual:pwa-register';

const app = createApp(App);

registerPlugins(app);

app.mount('#app');

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    import('virtual:pwa-register').then(({ registerSW }) => {
        registerSW({ immediate: true });
    });
}

// Register the PWA service worker
registerSW({ immediate: true });