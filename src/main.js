import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

import { registerPlugins } from '@/plugins';

const app = createApp(App);

registerPlugins(app);

app.mount('#app');

import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
