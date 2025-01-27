import pinia from './pinia';
import api from './api';
import router from './router';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import Aura from '@primevue/themes/aura';

export function registerPlugins(app) {
    console.log("registerPlugins");
    app.use(PrimeVue, {
        theme: {
            preset: Aura
        }
    });
    app.directive("tooltip", Tooltip);

    app.use(pinia);
    app.use(router); // after pinia
    app.use(api);
}
