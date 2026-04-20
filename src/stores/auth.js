import { reactive } from 'vue'
import { clearToken, getToken, setToken } from '../api/token'

export const authState = reactive({
  token: getToken(),
  userId: Number(localStorage.getItem('userId') || 0),
  username: localStorage.getItem('username') || ''
})

export function setAuth(data) {
  authState.token = data.token
  authState.userId = data.userId
  authState.username = data.username
  setToken(data.token)
  localStorage.setItem('userId', String(data.userId))
  localStorage.setItem('username', data.username)
}

export function logout() {
  authState.token = ''
  authState.userId = 0
  authState.username = ''
  clearToken()
  localStorage.removeItem('userId')
  localStorage.removeItem('username')
}
