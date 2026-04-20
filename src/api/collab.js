import { Client } from '@stomp/stompjs'
import { getToken } from './token'

function toWsProtocol() {
  return location.protocol === 'https:' ? 'wss' : 'ws'
}

export function createCollabClient({ documentId, onAck, onOp, onError, onCursor, onState }) {
  const token = getToken()
  const wsUrl = `${toWsProtocol()}://${location.host}/ws?token=${encodeURIComponent(token || '')}`
  const subscriptions = []
  const client = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 4000,
    debug: () => {}
  })

  client.onConnect = () => {
    subscriptions.push(client.subscribe(`/topic/documents/${documentId}/ops`, (frame) => {
      const payload = JSON.parse(frame.body)
      if (payload?.type === 'OT_APPLIED') {
        onOp?.(payload)
      } else if (payload?.type === 'CURSOR_UPDATE') {
        onCursor?.(payload)
      }
    }))
    subscriptions.push(client.subscribe('/user/queue/collab/ack', (frame) => {
      onAck?.(JSON.parse(frame.body))
    }))
    subscriptions.push(client.subscribe('/user/queue/collab/errors', (frame) => {
      onError?.(JSON.parse(frame.body))
    }))
    onState?.('connected')
  }

  client.onWebSocketClose = () => onState?.('disconnected')
  client.onStompError = (frame) => onError?.({ message: frame?.headers?.message || 'STOMP error' })

  function publishOp(op) {
    client.publish({
      destination: `/app/documents/${documentId}/ops`,
      body: JSON.stringify(op)
    })
  }

  function publishCursor(cursorPayload) {
    client.publish({
      destination: `/app/documents/${documentId}/cursor`,
      body: JSON.stringify(cursorPayload)
    })
  }

  function disconnect() {
    subscriptions.forEach((sub) => sub.unsubscribe())
    subscriptions.length = 0
    client.deactivate()
  }

  return {
    connect: () => client.activate(),
    disconnect,
    publishOp,
    publishCursor
  }
}
