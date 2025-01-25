import pinia from './pinia'
import api from './api'

export function registerPlugins(app) {
    app.use(pinia);
    app.use(api);
}
