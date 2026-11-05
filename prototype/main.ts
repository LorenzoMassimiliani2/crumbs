// PROTOTIPO — entry separato, non incluso nella build di produzione.
import { createApp } from 'vue'

import '../src/style.css'
import PrototypeApp from './PrototypeApp.vue'

createApp(PrototypeApp).mount('#app')
