import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import { registerPlugins } from '@/plugins'

const app = createApp(App).mount('#app')
registerPlugins(app)