import { createRouter, createWebHistory } from 'vue-router'
import useSessionStore from '@/stores/session'

import LoginView from '../pages/Login.vue'
import CollectionView from '../pages/Collection.vue'
import ArtistView from '../pages/Artist.vue'
import AlbumView from '../pages/Album.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView,
    },
    {
        path: '/collection',
        name: 'collection',
        component: CollectionView,
        meta: { requiresAuth: true }
    },
    {
        path: '/albums/:artistid',
        name: 'albums',
        component: ArtistView,
        meta: { requiresAuth: true }
    },
    {
        path: '/album',
        name: 'album',
        component: AlbumView,
        meta: { requiresAuth: true }
    },
    /*
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },*/
  ],
})

//
router.beforeEach((to) => {
    const store = useSessionStore();
    
    if (to.meta.requiresAuth === true && store.loggedIn === false) {
        return '/'
    }
})

//
export default router
