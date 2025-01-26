import pinia from './pinia';
import api from './api';
import router from './router';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';

export function registerPlugins(app) {
    app.use(PrimeVue, {
        theme: {
            preset: Aura
        }
    });
    app.use(router);
    app.use(pinia);
    app.use(api);
}
