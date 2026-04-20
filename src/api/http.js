import axios from 'axios'
import { clearToken, getToken } from './token'

const http = axios.create({
  baseURL: '/api'
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use((resp) => {
  const body = resp.data
  if (body && typeof body.code !== 'undefined') {
    if (body.code !== 200) return Promise.reject(new Error(body.message || 'API error'))
    return body.data
  }
  return resp.data
}, (error) => {
  if (error?.response?.status === 401) {
    clearToken()
  }
  return Promise.reject(error)
})

export default http
