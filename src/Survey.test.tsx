// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PublicSurvey } from './PublicSurvey'
import { Events } from './Events'
import { eventApi, PhoneListError } from './api/events'
import { ApiError } from './api/auth'
vi.mock('./api/events', async original => ({ ...await original<typeof import('./api/events')>(),
  eventApi: { survey: vi.fn(), respond: vi.fn(), list: vi.fn(), create: vi.fn(), publish: vi.fn(), addPhones: vi.fn(), get: vi.fn(), results: vi.fn(), comments: vi.fn() } }))
const survey = { name: 'Evento de teste', version: 1, questions: [
  { key: 'overall', label: 'Avaliação geral', required: true, options: [1, 2, 3, 4, 5] },
  { key: 'improvement', label: 'Comentário', required: false, options: [] },
] }
beforeEach(() => { vi.mocked(eventApi.survey).mockResolvedValue(survey); vi.mocked(eventApi.list).mockResolvedValue([]) })
afterEach(() => { cleanup(); vi.resetAllMocks() })
it('preserves fields on eligibility error and blocks repeated pending sends', async () => {
  let reject: (error: Error) => void = () => undefined
  vi.mocked(eventApi.respond).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    .mockResolvedValueOnce()
  render(<PublicSurvey token="test-token" />)
  await screen.findByText('Evento de teste')
  const phone = screen.getByLabelText('Telefone com DDD') as HTMLInputElement
  fireEvent.change(phone, { target: { value: '(11) 91234-5678' } })
  fireEvent.change(screen.getByLabelText('Avaliação geral'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Comentário (opcional)'), { target: { value: '<b>Melhorar</b>' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }))
  expect((screen.getByRole('button', { name: 'Enviando...' }) as HTMLButtonElement).disabled).toBe(true)
  reject(new ApiError(409, 'Conflict'))
  await screen.findByText('Não foi possível enviar. Confira o telefone informado ou se você já respondeu.')
  expect(phone.value).toBe('(11) 91234-5678')
  expect((screen.getByLabelText('Comentário (opcional)') as HTMLTextAreaElement).value).toBe('<b>Melhorar</b>')
  fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }))
  await screen.findByText('Resposta recebida')
  expect(eventApi.respond).toHaveBeenCalledTimes(2)
})
it('shows unavailable surveys without a form', async () => {
  vi.mocked(eventApi.survey).mockRejectedValue(new ApiError(404, 'Missing'))
  render(<PublicSurvey token="missing" />)
  await screen.findByText('Pesquisa indisponível')
  expect(screen.queryByLabelText('Telefone com DDD')).toBeNull()
})
it('shows line errors and preserves an invalid manual list', async () => {
  vi.mocked(eventApi.create).mockRejectedValue(new PhoneListError([2]))
  render(<Events onSessionExpired={() => undefined} />)
  await screen.findByText('Nenhum evento por aqui ainda')
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar evento' }))
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Evento' } })
  fireEvent.change(screen.getByLabelText('Data do evento'), { target: { value: '2026-10-20' } })
  const phones = screen.getByLabelText('Telefones autorizados (opcional)') as HTMLTextAreaElement
  fireEvent.change(phones, { target: { value: '11912345678\ninvalid' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }))
  await screen.findByText('Telefones inválidos nas linhas: 2. Nenhum telefone foi gravado.')
  expect(phones.value).toBe('11912345678\ninvalid')
})

it('keeps results navigation alongside survey sharing and resets it when switching events', async () => {
  const event = { ...survey, id: 'first', date: '2026-10-20', description: null, phones: [], publicUrl: 'http://localhost:15173/s/fictitious' }
  const other = { ...event, id: 'second', name: 'Outro evento' }
  vi.mocked(eventApi.list).mockResolvedValue([event, other])
  vi.mocked(eventApi.get).mockResolvedValueOnce(event).mockResolvedValueOnce(other)
  vi.mocked(eventApi.results).mockResolvedValue({ name: event.name, date: event.date, published: true, version: 1,
    participation: { authorizedPhones: 0, responses: 0, percentage: null }, ratings: [], recommendation: null,
    timezone: 'America/Sao_Paulo', daily: [], hasCommentQuestion: false })
  render(<Events onSessionExpired={() => undefined} />)
  fireEvent.click(await screen.findByRole('button', { name: /Evento de teste —/ }))
  await screen.findByRole('button', { name: 'Copiar link' })
  fireEvent.click(screen.getByRole('button', { name: 'Resultados' }))
  await screen.findByText('Ainda não há respostas')
  expect(eventApi.results).toHaveBeenCalledWith('first')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao evento' }))
  expect((screen.getByLabelText('Link para compartilhar') as HTMLInputElement).value).toBe(event.publicUrl)
  expect(screen.getByRole('button', { name: 'Copiar link' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Resultados' }))
  await screen.findByText('Ainda não há respostas')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar aos eventos' }))
  fireEvent.click(await screen.findByRole('button', { name: /Outro evento —/ }))
  await screen.findByRole('heading', { name: 'Outro evento' })
  expect(screen.getByRole('button', { name: 'Resultados' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Atualizar resultados' })).toBeNull()
})
