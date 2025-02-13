import pinia from './pinia';
import api from './api';
import router from './router';
import imagedata from './imagedata';
//
import PrimeVue from 'primevue/config';
import 'primeicons/primeicons.css'
import Tooltip from 'primevue/tooltip';
import Aura from '@primevue/themes/aura';

export function registerPlugins(app) {    
    app.use(pinia);
    
    app.use(PrimeVue, {
        theme: {
            preset: Aura, // Aura Material, Lara, Nora
            options: {
                darkModeSelector: '.dark-mode'
            }
        }
    });
    app.directive("tooltip", Tooltip);


    app.use(router); // after pinia
    app.use(api);
    app.use(imagedata);
}
