import { ApiError, csrfToken } from './auth'

export interface Question { key: string; label: string; required: boolean; options: number[] }
export interface PublicSurvey { name: string; version: number; questions: Question[] }
export interface EventView extends PublicSurvey {
  id: string; date: string; description: string | null; phones: string[]; publicUrl: string | null
}
export interface Bucket { label: string; count: number; percentage: number | null }
export interface Rating { questionKey: string; label: string; validResponses: number; average: number | null; distribution: Bucket[] }
export interface Recommendation { questionKey: string; label: string; validResponses: number; score: number | null; groups: Bucket[] }
export interface Results {
  name: string; date: string; published: boolean; version: number | null
  participation: { authorizedPhones: number; responses: number; percentage: number | null }
  ratings: Rating[]; recommendation: Recommendation | null; timezone: string
  daily: { date: string; count: number }[]; hasCommentQuestion: boolean
}
export interface Comments { page: number; size: number; total: number; items: string[] }
export class PhoneListError extends ApiError {
  constructor(readonly lines: number[]) { super(400, 'Invalid phone list') }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    headers['X-XSRF-TOKEN'] = await csrfToken()
  }
  const response = await fetch(`/api/${path}`, {
    credentials: 'same-origin', headers,
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    if (response.status === 400) {
      const data: unknown = await response.json().catch(() => null)
      if (Array.isArray(data)) throw new PhoneListError(data.map((item: { line: number }) => item.line))
    }
    throw new ApiError(response.status, 'Request failed')
  }
  if (response.status === 201) return undefined as T
  return response.json() as Promise<T>
}
export const eventApi = {
  results: (id: string) => request<Results>(`events/${id}/results`),
  comments: (id: string, page: number) => request<Comments>(`events/${id}/results/comments?page=${page}&size=10`),
  list: () => request<EventView[]>('events'),
  get: (id: string) => request<EventView>(`events/${id}`),
  create: (body: { name: string; date: string; description: string; phones: string }) => request<EventView>('events', body),
  addPhones: (id: string, phones: string) => request<EventView>(`events/${id}/phones`, { phones }),
  publish: (id: string) => request<EventView>(`events/${id}/publish`, {}),
  survey: (token: string) => request<PublicSurvey>(`public/surveys/${encodeURIComponent(token)}`),
  respond: (token: string, phone: string, answers: { questionKey: string; value: string }[]) =>
    request<void>(`public/surveys/${encodeURIComponent(token)}/responses`, { phone, answers }),
}
