// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EventResults } from './EventResults'
import { eventApi, type Results } from './api/events'
import { ApiError } from './api/auth'
vi.mock('./api/events', () => ({ eventApi: { results: vi.fn(), comments: vi.fn() } }))
const fixture: Results = {
  name: 'Evento fictício', date: '2026-10-12', published: true, version: 1,
  participation: { authorizedPhones: 10, responses: 3, percentage: 30 },
  ratings: [{ questionKey: 'overall', label: 'Avaliação geral', validResponses: 3, average: 4.3,
    distribution: [1, 2, 3, 4, 5].map(value => ({ label: String(value), count: value === 5 ? 2 : value === 3 ? 1 : 0, percentage: value === 5 ? 66.7 : value === 3 ? 33.3 : 0 })) }],
  recommendation: { questionKey: 'recommendation', label: 'Recomendar', validResponses: 3, score: 33.3,
    groups: [{ label: 'detractors', count: 1, percentage: 33.3 }, { label: 'neutral', count: 0, percentage: 0 }, { label: 'promoters', count: 2, percentage: 66.7 }] },
  daily: [{ date: '2026-10-10', count: 1 }, { date: '2026-10-11', count: 0 }, { date: '2026-10-12', count: 2 }],
  timezone: 'America/Sao_Paulo', hasCommentQuestion: true,
}
beforeEach(() => {
  vi.mocked(eventApi.results).mockResolvedValue(fixture)
  vi.mocked(eventApi.comments).mockResolvedValue({ page: 0, size: 10, total: 11, items: ['<b>Melhorar</b>'] })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })
it('renders real values, all ratings, accessible daily data and comments as text', async () => {
  const { container } = render(<EventResults eventId="event" onSessionExpired={() => undefined} />)
  await screen.findByText('<b>Melhorar</b>')
  expect(container.querySelector('b')).toBeNull()
  expect(screen.getByText('4,3 de 5')).toBeTruthy()
  expect(screen.getByText('+33,3')).toBeTruthy()
  expect(screen.getByText('3 de 10 responderam.')).toBeTruthy()
  for (let i = 1; i <= 5; i++) expect(screen.getByText(`Nota ${i}`)).toBeTruthy()
  expect(screen.getByRole('table').textContent).toContain('11/10/20260')
  expect(screen.getByText('Neutros (7–8): 0 · 0,0%')).toBeTruthy()
  vi.mocked(eventApi.comments).mockResolvedValueOnce({ page: 1, size: 10, total: 11, items: ['Último'] })
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await screen.findByText('Último')
  expect(eventApi.comments).toHaveBeenLastCalledWith('event', 1)
})
it('preserves results and comments on refresh failures and disables pending refresh', async () => {
  render(<EventResults eventId="event" onSessionExpired={() => undefined} />)
  await screen.findByText('<b>Melhorar</b>')
  let reject: (error: Error) => void = () => undefined
  vi.mocked(eventApi.results).mockImplementationOnce(() => new Promise((_resolve, failure) => { reject = failure }))
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar resultados' }))
  expect((screen.getByRole('button', { name: 'Atualizando resultados...' }) as HTMLButtonElement).disabled).toBe(true)
  reject(new Error('Connection failed'))
  await screen.findByRole('alert')
  expect(screen.getByText('4,3 de 5')).toBeTruthy()
  expect(screen.getByText('<b>Melhorar</b>')).toBeTruthy()
  vi.mocked(eventApi.comments).mockRejectedValueOnce(new Error('Comments failed'))
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar resultados' }))
  await screen.findByRole('button', { name: 'Tentar carregar comentários novamente' })
  expect(screen.getByText('<b>Melhorar</b>')).toBeTruthy()
})
it('handles empty questions, absent blocks, zero denominator and initial errors', async () => {
  const expired = vi.fn()
  vi.mocked(eventApi.results).mockRejectedValueOnce(new ApiError(401, 'Expired'))
  render(<EventResults eventId="event" onSessionExpired={expired} />)
  await screen.findByRole('alert')
  expect(expired).toHaveBeenCalledOnce()
  vi.mocked(eventApi.results).mockResolvedValueOnce({ ...fixture, published: false, version: null,
    participation: { authorizedPhones: 0, responses: 0, percentage: null }, ratings: [], recommendation: null, daily: [], hasCommentQuestion: false })
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar resultados' }))
  await screen.findByText('Ainda não há respostas')
  expect(screen.getByText('Não disponível')).toBeTruthy()
  expect(screen.queryByText('Recomendação / NPS')).toBeNull()
  expect(screen.queryByText('Comentários')).toBeNull()
  expect(eventApi.comments).not.toHaveBeenCalled()
  vi.mocked(eventApi.results).mockResolvedValueOnce({ ...fixture,
    ratings: [{ ...fixture.ratings[0], average: null, validResponses: 0 }],
    recommendation: { ...fixture.recommendation!, score: null, validResponses: 0 }, hasCommentQuestion: false })
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar resultados' }))
  await waitFor(() => expect(screen.getAllByText('Sem respostas')).toHaveLength(2))
  expect(screen.queryByText('0,0 de 5')).toBeNull()
})
