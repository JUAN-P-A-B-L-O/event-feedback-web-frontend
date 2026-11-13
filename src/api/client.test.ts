import { afterEach, expect, it, vi } from 'vitest'
import { ApiError, authApi } from './auth'
import { eventApi, PhoneListError } from './events'

const fetchMock = vi.fn<typeof fetch>()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

it('logs in with form encoding and CSRF before reading the cookie session, then logs out', async () => {
  vi.stubGlobal('fetch', fetchMock)
  const organizer = { id: 'synthetic', email: 'organizer@example.test', displayName: 'Teste',
    organization: { id: 'org', name: 'Teste' } }
  fetchMock.mockResolvedValueOnce(json({ token: 'synthetic-login-csrf' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(json(organizer))
    .mockResolvedValueOnce(json({ token: 'synthetic-logout-csrf' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))

  expect(await authApi.login(organizer.email, 'synthetic-password')).toEqual(organizer)
  expect(fetchMock.mock.calls[0]).toEqual(['/api/auth/csrf', { credentials: 'same-origin' }])
  const [url, options] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/auth/login')
  expect(options).toMatchObject({ credentials: 'same-origin', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-XSRF-TOKEN': 'synthetic-login-csrf' } })
  expect(String(options?.body)).toBe('username=organizer%40example.test&password=synthetic-password')
  expect(fetchMock.mock.calls[2][0]).toBe('/api/auth/me')
  await authApi.logout()
  expect(fetchMock.mock.calls[4]).toEqual(['/api/auth/logout', { credentials: 'same-origin', method: 'POST',
    headers: { 'X-XSRF-TOKEN': 'synthetic-logout-csrf' } }])
})

it('sends event JSON with cookies and CSRF and preserves the returned event', async () => {
  vi.stubGlobal('fetch', fetchMock)
  const input = { name: 'Teste', date: '2026-11-12', description: '', phones: '' }
  const event = { ...input, id: 'synthetic', phones: [], version: 1, questions: [], publicUrl: null }
  fetchMock.mockResolvedValueOnce(json({ token: 'synthetic-csrf' })).mockResolvedValueOnce(json(event))
  expect(await eventApi.create(input)).toEqual(event)
  expect(fetchMock.mock.calls[1]).toEqual(['/api/events', { credentials: 'same-origin', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'synthetic-csrf' }, body: JSON.stringify(input) }])
})

it('encodes public tokens and accepts the empty 201 response after a CSRF-protected submission', async () => {
  vi.stubGlobal('fetch', fetchMock)
  const survey = { name: 'Teste', version: 1, questions: [] }
  fetchMock.mockResolvedValueOnce(json(survey)).mockResolvedValueOnce(json({ token: 'synthetic-csrf' }))
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
  expect(await eventApi.survey('synthetic/token?')).toEqual(survey)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/public/surveys/synthetic%2Ftoken%3F')
  await expect(eventApi.respond('synthetic/token?', '11900000000', [{ questionKey: 'overall', value: '5' }]))
    .resolves.toBeUndefined()
  expect(fetchMock.mock.calls[2]).toEqual(['/api/public/surveys/synthetic%2Ftoken%3F/responses', {
    credentials: 'same-origin', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'synthetic-csrf' },
    body: JSON.stringify({ phone: '11900000000', answers: [{ questionKey: 'overall', value: '5' }] }),
  }])
})

it('preserves authorization errors and phone-line validation failures', async () => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(json({ token: 'synthetic-csrf' }))
    .mockResolvedValueOnce(json([{ line: 2, message: 'Invalid' }], 400))
    .mockResolvedValueOnce(json({ token: 'synthetic-csrf' }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
  await expect(eventApi.list()).rejects.toMatchObject({ status: 401 })
  await expect(eventApi.addPhones('synthetic', 'invalid')).rejects.toBeInstanceOf(PhoneListError)
  await expect(authApi.logout()).rejects.toBeInstanceOf(ApiError)
})
