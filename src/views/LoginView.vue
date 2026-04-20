<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/auth'
import { setAuth } from '../stores/auth'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const form = reactive({
  username: '',
  password: ''
})

async function onSubmit() {
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码'
    return
  }
  error.value = ''
  loading.value = true
  try {
    const data = await login({
      username: form.username,
      password: form.password
    })
    setAuth(data)
    router.push('/documents')
  } catch (e) {
    error.value = e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page-shell centered">
    <div class="card auth-card">
      <h1 class="title">SyncForge</h1>
      <p class="subtitle">登录后管理和编辑文档</p>
      <form class="form" @submit.prevent="onSubmit">
        <label>
          用户名
          <input v-model.trim="form.username" type="text" placeholder="alice" />
        </label>
        <label>
          密码
          <input v-model="form.password" type="password" placeholder="请输入密码" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>
