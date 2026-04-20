function clampPosition(position, contentLength) {
  if (position < 0) return 0
  if (position > contentLength) return contentLength
  return position
}

export function applyOperation(content, op) {
  if (!op) return content
  if (op.opType === 'insert') {
    const position = clampPosition(op.position, content.length)
    return content.slice(0, position) + (op.content || '') + content.slice(position)
  }
  if (op.opType === 'delete') {
    const position = clampPosition(op.position, content.length)
    const deleteLength = Math.max(0, Number(op.deleteLength || 0))
    return content.slice(0, position) + content.slice(position + deleteLength)
  }
  return content
}

export function deriveOpsFromDiff(beforeText, afterText) {
  if (beforeText === afterText) return []
  const beforeLength = beforeText.length
  const afterLength = afterText.length

  let prefix = 0
  while (prefix < beforeLength && prefix < afterLength && beforeText[prefix] === afterText[prefix]) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix + prefix < beforeLength &&
    suffix + prefix < afterLength &&
    beforeText[beforeLength - 1 - suffix] === afterText[afterLength - 1 - suffix]
  ) {
    suffix += 1
  }

  const deletedLength = beforeLength - prefix - suffix
  const insertedText = afterText.slice(prefix, afterLength - suffix)
  const ops = []

  if (deletedLength > 0) {
    ops.push({
      opType: 'delete',
      position: prefix,
      deleteLength: deletedLength
    })
  }

  if (insertedText.length > 0) {
    ops.push({
      opType: 'insert',
      position: prefix,
      content: insertedText
    })
  }

  return ops
}

export function transformCursorPosition(position, op) {
  if (!op) return position
  if (op.opType === 'insert') {
    if (op.position <= position) return position + (op.content?.length || 0)
    return position
  }
  if (op.opType === 'delete') {
    const start = op.position
    const end = start + Number(op.deleteLength || 0)
    if (position <= start) return position
    if (position <= end) return start
    return position - (end - start)
  }
  return position
}

export function transformOp(localOp, remoteOp) {
  if (!localOp || !remoteOp) return localOp

  if (remoteOp.opType === 'insert') {
    const insertLength = remoteOp.content?.length || 0
    if (localOp.opType === 'insert') {
      const shouldShift = localOp.position > remoteOp.position ||
        (localOp.position === remoteOp.position && String(localOp.clientOpId || '') > String(remoteOp.clientOpId || ''))
      if (shouldShift) {
        return { ...localOp, position: localOp.position + insertLength }
      }
      return localOp
    }
    if (localOp.opType === 'delete') {
      const deleteStart = localOp.position
      const deleteEnd = deleteStart + Number(localOp.deleteLength || 0)
      if (remoteOp.position <= deleteStart) {
        return { ...localOp, position: deleteStart + insertLength }
      }
      if (remoteOp.position < deleteEnd) {
        return { ...localOp, deleteLength: Number(localOp.deleteLength || 0) + insertLength }
      }
      return localOp
    }
  }

  if (remoteOp.opType === 'delete') {
    const remoteStart = remoteOp.position
    const remoteEnd = remoteStart + Number(remoteOp.deleteLength || 0)
    if (localOp.opType === 'insert') {
      if (localOp.position >= remoteEnd) {
        return { ...localOp, position: localOp.position - (remoteEnd - remoteStart) }
      }
      if (localOp.position >= remoteStart) {
        return { ...localOp, position: remoteStart }
      }
      return localOp
    }
    if (localOp.opType === 'delete') {
      const localStart = localOp.position
      const localEnd = localStart + Number(localOp.deleteLength || 0)

      let nextStart = localStart
      if (localStart >= remoteEnd) {
        nextStart = localStart - (remoteEnd - remoteStart)
      } else if (localStart >= remoteStart) {
        nextStart = remoteStart
      }

      const overlap = Math.max(0, Math.min(localEnd, remoteEnd) - Math.max(localStart, remoteStart))
      const nextLength = Number(localOp.deleteLength || 0) - overlap
      if (nextLength <= 0) return null
      return { ...localOp, position: nextStart, deleteLength: nextLength }
    }
  }

  return localOp
}
