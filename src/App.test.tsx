// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { eventApi } from './api/events'
import { App } from './App'
import { ApiError, authApi } from './api/auth'

vi.mock('./api/auth', async importOriginal => {
  const original = await importOriginal<typeof import('./api/auth')>()
  return { ...original, authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() } }
})

vi.mock('./api/events', () => ({ eventApi: { list: vi.fn(), survey: vi.fn() } }))

const organizer = {
  id: 'user-a', email: 'organizer@example.test', displayName: 'Ana',
  organization: { id: 'org-a', name: 'Organização A' },
}

beforeEach(() => {
  vi.mocked(eventApi.list).mockResolvedValue([])
  vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'Unauthorized'))
})

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
})

it('opens a public survey directly at /s/{token} without requesting an organizer session', async () => {
  vi.mocked(eventApi.survey).mockResolvedValue({ name: 'Pesquisa pública de teste', version: 1, questions: [] })
  window.history.replaceState(null, '', '/s/synthetic-public-token')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Pesquisa pública de teste' })).toBeTruthy()
  expect(eventApi.survey).toHaveBeenCalledWith('synthetic-public-token')
  expect(authApi.me).not.toHaveBeenCalled()
})

describe('organizer access', () => {
  it('shows login after an anonymous load, rejects invalid credentials, and logs out', async () => {
    vi.mocked(authApi.login)
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized'))
      .mockResolvedValueOnce(organizer)
    vi.mocked(authApi.logout).mockResolvedValue()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Bem-vindo de volta.' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: organizer.email } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'correct' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Organização A')).toBeTruthy()
    expect(await screen.findByText('Nenhum evento por aqui ainda')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('heading', { name: 'Bem-vindo de volta.' })).toBeTruthy()
  })

  it('reports a network error and retries loading', async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce(organizer)
    render(<App />)
    expect(await screen.findByText('Não foi possível carregar sua sessão. Tente novamente.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Organização A')).toBeTruthy()
  })

  it('returns to login when the session expires while the tab is away', async () => {
    vi.mocked(authApi.me).mockResolvedValueOnce(organizer)
      .mockRejectedValueOnce(new ApiError(401, 'Expired'))
    render(<App />)
    expect(await screen.findByText('Organização A')).toBeTruthy()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Bem-vindo de volta.' })).toBeTruthy()
  })
})
