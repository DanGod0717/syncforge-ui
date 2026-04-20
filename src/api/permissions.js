import http from './http'

export async function grantPermission(documentId, targetUserId, role) {
  return http.put(`/documents/${documentId}/permissions/${targetUserId}`, { role })
}

export async function revokePermission(documentId, targetUserId) {
  return http.delete(`/documents/${documentId}/permissions/${targetUserId}`)
}
