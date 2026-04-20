<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDocumentLatest, updateDocumentContent } from '../api/documents'
import { authState } from '../stores/auth'
import { createCollabClient } from '../api/collab'
import { colorForUser, createCursorPayload, transformRemoteCursors } from '../collab/cursor'
import { applyOperation, deriveOpsFromDiff, transformCursorPosition, transformOp } from '../collab/ot'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const wsState = ref('disconnected')
const editorRef = ref(null)
const remoteCursors = ref({})
const pendingOps = ref([])
const lastSnapshot = ref('')
const localSeq = ref(0)
const selfColor = computed(() => colorForUser(authState.userId))

let collabClient = null
let cursorTimer = null

const doc = ref({
  id: 0,
  title: '',
  content: '',
  version: 0
})

function pickSinglePayload(payload) {
  if (payload && typeof payload === 'object' && payload.document) return payload.document
  return payload
}

function nextClientOpId() {
  localSeq.value += 1
  return `${authState.userId || 0}-${Date.now()}-${localSeq.value}`
}

function clearCollabState() {
  pendingOps.value = []
  remoteCursors.value = {}
}

async function loadLatest(id) {
  loading.value = true
  error.value = ''
  try {
    const data = pickSinglePayload(await getDocumentLatest(id))
    doc.value = {
      id: data.id,
      title: data.title || '',
      content: data.content || '',
      version: Number(data.version || 0)
    }
    lastSnapshot.value = doc.value.content
    clearCollabState()
  } catch (e) {
    error.value = e?.message || '加载文档失败'
  } finally {
    loading.value = false
  }
}

function upsertRemoteCursor(payload) {
  const userId = Number(payload?.userId || 0)
  if (!userId || userId === Number(authState.userId || 0)) return
  remoteCursors.value = {
    ...remoteCursors.value,
    [userId]: {
      userId,
      username: payload.username || `User-${userId}`,
      position: Number(payload.position || 0),
      selectionEnd: Number(payload.selectionEnd ?? payload.position ?? 0),
      color: colorForUser(userId),
      updatedAt: Date.now()
    }
  }
}

function handleRemoteApplied(payload) {
  const rawRemoteOp = {
    clientOpId: payload.clientOpId,
    opType: payload.opType,
    position: Number(payload.position || 0),
    content: payload.content || '',
    deleteLength: Number(payload.deleteLength || 0)
  }
  const isOwn = Number(payload.authorUserId || 0) === Number(authState.userId || 0)
  if (isOwn) {
    pendingOps.value = pendingOps.value.filter((item) => item.clientOpId !== rawRemoteOp.clientOpId)
    doc.value.version = Number(payload.serverVersion || doc.value.version)
    return
  }

  let incomingForLocalView = rawRemoteOp
  pendingOps.value.forEach((item) => {
    incomingForLocalView = transformOp(incomingForLocalView, item)
  })
  if (!incomingForLocalView) {
    doc.value.version = Number(payload.serverVersion || doc.value.version + 1)
    return
  }

  const transformedPending = []
  pendingOps.value.forEach((item) => {
    const transformed = transformOp(item, rawRemoteOp)
    if (transformed) transformedPending.push(transformed)
  })
  pendingOps.value = transformedPending

  doc.value.content = applyOperation(doc.value.content, incomingForLocalView)
  doc.value.version = Number(payload.serverVersion || doc.value.version + 1)
  lastSnapshot.value = doc.value.content
  remoteCursors.value = transformRemoteCursors(remoteCursors.value, incomingForLocalView)

  const editor = editorRef.value
  if (editor) {
    const start = transformCursorPosition(editor.selectionStart || 0, incomingForLocalView)
    const end = transformCursorPosition(editor.selectionEnd || 0, incomingForLocalView)
    editor.selectionStart = start
    editor.selectionEnd = end
  }
}

function publishCursor(selectionStart, selectionEnd) {
  if (!collabClient || wsState.value !== 'connected' || !doc.value.id) return
  const payload = createCursorPayload(
    doc.value.id,
    authState.userId,
    authState.username,
    selectionStart,
    selectionEnd
  )
  collabClient.publishCursor(payload)
}

function scheduleCursorPublish() {
  const editor = editorRef.value
  if (!editor) return
  if (cursorTimer) clearTimeout(cursorTimer)
  cursorTimer = setTimeout(() => {
    publishCursor(editor.selectionStart || 0, editor.selectionEnd || 0)
  }, 80)
}

function onSelectionChange() {
  scheduleCursorPublish()
}

function onTextInput(event) {
  const nextContent = event.target.value
  const beforeContent = lastSnapshot.value
  const ops = deriveOpsFromDiff(beforeContent, nextContent)
  lastSnapshot.value = nextContent
  if (!ops.length || !collabClient || wsState.value !== 'connected') return
  ops.forEach((rawOp) => {
    const op = {
      ...rawOp,
      clientOpId: nextClientOpId(),
      baseVersion: doc.value.version
    }
    pendingOps.value.push(op)
    collabClient.publishOp(op)
    remoteCursors.value = transformRemoteCursors(remoteCursors.value, op)
  })
  scheduleCursorPublish()
}

async function onSaveSnapshot() {
  saving.value = true
  error.value = ''
  try {
    const updated = await updateDocumentContent(doc.value.id, {
      content: doc.value.content,
      version: doc.value.version
    })
    doc.value.version = Number(updated?.version || doc.value.version + 1)
    lastSnapshot.value = doc.value.content
  } catch (e) {
    error.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function connectCollab(documentId) {
  if (!documentId) return
  if (collabClient) {
    collabClient.disconnect()
    collabClient = null
  }
  collabClient = createCollabClient({
    documentId,
    onState: (state) => {
      wsState.value = state
    },
    onError: (payload) => {
      error.value = payload?.message || '协同连接异常'
    },
    onAck: async (payload) => {
      if (!payload?.accepted) {
        error.value = payload?.message || '服务端拒绝操作，已回滚到最新版本'
        await loadLatest(documentId)
      }
    },
    onOp: (payload) => {
      handleRemoteApplied(payload)
    },
    onCursor: (payload) => {
      upsertRemoteCursor(payload)
    }
  })
  wsState.value = 'connecting'
  collabClient.connect()
}

function backList() {
  router.push('/documents')
}

const activeRemoteCursors = computed(() => {
  const now = Date.now()
  return Object.values(remoteCursors.value)
    .filter((item) => now - item.updatedAt < 15000)
    .sort((a, b) => a.userId - b.userId)
})

const selfCursorPercentage = computed(() => {
  const editor = editorRef.value
  if (!editor || !doc.value.content.length) return 0
  const pos = editor.selectionStart || 0
  return Math.min(100, Math.round((pos / doc.value.content.length) * 100))
})

watch(
  () => route.params.id,
  async (id) => {
    const numericId = Number(id)
    if (numericId) {
      await loadLatest(numericId)
      connectCollab(numericId)
    }
  }
)

onMounted(async () => {
  const id = Number(route.params.id)
  if (id) {
    await loadLatest(id)
    connectCollab(id)
  }
})

onBeforeUnmount(() => {
  if (cursorTimer) clearTimeout(cursorTimer)
  if (collabClient) collabClient.disconnect()
})
</script>

<template>
  <div class="page-shell">
    <header class="topbar">
      <div>
        <h1 class="title">文档编辑</h1>
        <p class="subtitle">
          ID: {{ doc.id }} | 版本: {{ doc.version }} | 协同:
          <span :class="['ws-dot', wsState]">{{ wsState }}</span>
        </p>
      </div>
      <button class="ghost" @click="backList">返回列表</button>
    </header>

    <section class="card form-card">
      <p v-if="loading" class="tip">加载中...</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="form">
        <label>
          标题
          <input v-model="doc.title" type="text" disabled />
        </label>
        <label>
          内容（OT 实时协同）
          <textarea
            ref="editorRef"
            v-model="doc.content"
            rows="14"
            :disabled="loading"
            @input="onTextInput"
            @keyup="onSelectionChange"
            @click="onSelectionChange"
            @select="onSelectionChange"
          ></textarea>
        </label>
      </div>
      <div class="cursor-rail">
        <span class="cursor-item self" :style="{ left: `${selfCursorPercentage}%`, backgroundColor: selfColor }"></span>
        <span
          v-for="cursor in activeRemoteCursors"
          :key="cursor.userId"
          class="cursor-item"
          :style="{ left: `${Math.min(100, Math.round((cursor.position / Math.max(1, doc.content.length)) * 100))}%`, backgroundColor: cursor.color }"
        ></span>
      </div>
      <div class="cursor-list">
        <span class="cursor-pill self" :style="{ borderColor: selfColor }">
          我（{{ authState.username || authState.userId }}）
        </span>
        <span
          v-for="cursor in activeRemoteCursors"
          :key="`pill-${cursor.userId}`"
          class="cursor-pill"
          :style="{ borderColor: cursor.color }"
        >
          {{ cursor.username }} @ {{ cursor.position }}
        </span>
      </div>
      <button :disabled="saving || loading" @click="onSaveSnapshot">
        {{ saving ? '保存中...' : '手动快照保存（HTTP）' }}
      </button>
    </section>
  </div>
</template>
