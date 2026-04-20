import http from './http'

export async function login(payload) {
  return http.post('/users/login', payload)
}

export async function register(payload) {
  return http.post('/users', payload)
}
