import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DocumentListView from '../views/DocumentListView.vue'
import DocumentEditorView from '../views/DocumentEditorView.vue'
import { authState } from '../stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', redirect: '/documents' },
    { path: '/documents', component: DocumentListView },
    { path: '/documents/:id', component: DocumentEditorView }
  ]
})

router.beforeEach((to, _, next) => {
  const token = authState.token
  if (to.path !== '/login' && !token) return next('/login')
  if (to.path === '/login' && token) return next('/documents')
  next()
})

export default router
