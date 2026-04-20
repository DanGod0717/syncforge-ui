<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDocument, deleteDocument, getMyDocuments, getSharedDocuments } from '../api/documents'
import { authState, logout } from '../stores/auth'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const creating = ref(false)
const createTitle = ref('')
const createContent = ref('')
const deletingId = ref(0)
const mine = ref([])
const shared = ref([])

function pickListPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.records)) return payload.records
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

const allDocs = computed(() => {
  const normalizedMine = mine.value.map((d) => ({ ...d, source: 'mine' }))
  const normalizedShared = shared.value.map((d) => ({ ...d, source: 'shared' }))
  return [...normalizedMine, ...normalizedShared]
})

async function fetchDocuments() {
  loading.value = true
  error.value = ''
  try {
    const [mineData, sharedData] = await Promise.all([
      getMyDocuments({ page: 1, size: 20 }),
      getSharedDocuments({ page: 1, size: 20 })
    ])
    mine.value = pickListPayload(mineData)
    shared.value = pickListPayload(sharedData)
  } catch (e) {
    error.value = e?.message || '加载文档失败'
  } finally {
    loading.value = false
  }
}

async function onCreate() {
  if (!createTitle.value.trim()) {
    error.value = '文档标题不能为空'
    return
  }
  creating.value = true
  error.value = ''
  try {
    const created = await createDocument({
      title: createTitle.value.trim(),
      content: createContent.value
    })
    createTitle.value = ''
    createContent.value = ''
    const id = created?.id
    if (id) {
      router.push(`/documents/${id}`)
      return
    }
    await fetchDocuments()
  } catch (e) {
    error.value = e?.message || '创建文档失败'
  } finally {
    creating.value = false
  }
}

function goEditor(id) {
  router.push(`/documents/${id}`)
}

async function onDelete(id) {
  deletingId.value = id
  error.value = ''
  try {
    await deleteDocument(id)
    await fetchDocuments()
  } catch (e) {
    error.value = e?.message || '删除文档失败'
  } finally {
    deletingId.value = 0
  }
}

function onLogout() {
  logout()
  router.push('/login')
}

onMounted(fetchDocuments)
</script>

<template>
  <div class="page-shell">
    <header class="topbar">
      <div>
        <h1 class="title">文档列表</h1>
        <p class="subtitle">当前用户：{{ authState.username || '未命名用户' }}</p>
      </div>
      <button class="ghost" @click="onLogout">退出登录</button>
    </header>

    <section class="card form-card">
      <h2>新建文档</h2>
      <div class="form">
        <label>
          标题
          <input v-model="createTitle" type="text" placeholder="请输入标题" />
        </label>
        <label>
          初始内容
          <textarea v-model="createContent" rows="4" placeholder="请输入初始内容"></textarea>
        </label>
      </div>
      <button :disabled="creating" @click="onCreate">{{ creating ? '创建中...' : '创建并进入编辑器' }}</button>
    </section>

    <section class="card">
      <h2>我的 + 分享给我的文档</h2>
      <p v-if="loading" class="tip">加载中...</p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="!loading && !allDocs.length" class="tip">暂无文档</p>
      <table v-if="!loading && allDocs.length" class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>来源</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in allDocs" :key="`${doc.source}-${doc.id}`">
            <td>{{ doc.id }}</td>
            <td>{{ doc.title || '(无标题)' }}</td>
            <td>{{ doc.source === 'mine' ? '我创建的' : '分享给我' }}</td>
            <td class="actions">
              <button class="small" @click="goEditor(doc.id)">打开</button>
              <button
                v-if="doc.source === 'mine'"
                class="small danger"
                :disabled="deletingId === doc.id"
                @click="onDelete(doc.id)"
              >
                {{ deletingId === doc.id ? '删除中...' : '删除' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
