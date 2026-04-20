import { transformCursorPosition } from './ot'

const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export function colorForUser(userId) {
  const normalized = Math.abs(Number(userId) || 0)
  return CURSOR_COLORS[normalized % CURSOR_COLORS.length]
}

export function createCursorPayload(documentId, userId, username, position, selectionEnd) {
  return {
    type: 'CURSOR_UPDATE',
    documentId,
    userId,
    username,
    position,
    selectionEnd
  }
}

export function transformRemoteCursors(cursors, op) {
  const next = {}
  Object.entries(cursors).forEach(([key, cursor]) => {
    next[key] = {
      ...cursor,
      position: transformCursorPosition(cursor.position, op),
      selectionEnd: transformCursorPosition(cursor.selectionEnd, op)
    }
  })
  return next
}
