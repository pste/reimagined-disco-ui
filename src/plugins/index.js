import { createPinia } from 'pinia';
const pinia = createPinia();

export function registerPlugins(app) {
    app.use(pinia);
}