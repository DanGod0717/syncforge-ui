import http from './http'

export async function getMyDocuments(params = { page: 1, size: 20 }) {
  return http.get('/documents/mine', { params })
}

export async function getSharedDocuments(params = { page: 1, size: 20 }) {
  return http.get('/documents/shared-with-me', { params })
}

export async function createDocument(payload) {
  return http.post('/documents', payload)
}

export async function getDocumentLatest(id) {
  return http.get(`/documents/${id}/latest`)
}

export async function updateDocumentContent(id, payload) {
  return http.put(`/documents/${id}/content`, payload)
}

export async function deleteDocument(id) {
  return http.delete(`/documents/${id}`)
}
