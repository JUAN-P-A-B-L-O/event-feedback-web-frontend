export interface Organizer {
  id: string
  email: string
  displayName: string
  organization: { id: string; name: string }
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function request(path: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/auth/${path}`, { credentials: 'same-origin', ...options })
  if (!response.ok) throw new ApiError(response.status, 'Request failed')
  return response
}

export async function csrfToken(): Promise<string> {
  const response = await request('csrf')
  const data: { token: string } = await response.json()
  return data.token
}

export const authApi = {
  async me(): Promise<Organizer> {
    const response = await request('me')
    return response.json() as Promise<Organizer>
  },
  async login(email: string, password: string): Promise<Organizer> {
    const token = await csrfToken()
    await request('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-XSRF-TOKEN': token },
      body: new URLSearchParams({ username: email, password }),
    })
    return this.me()
  },
  async logout(): Promise<void> {
    const token = await csrfToken()
    await request('logout', { method: 'POST', headers: { 'X-XSRF-TOKEN': token } })
  },
}
