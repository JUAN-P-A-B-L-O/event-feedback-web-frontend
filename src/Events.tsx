import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api/auth'
import { eventApi, PhoneListError, type EventView, type Question } from './api/events'
import { EventResults } from './EventResults'
import { SurveyLink } from './SurveyLink'

export function SurveyPreview({ questions }: { questions: Question[] }) {
  return <ol>{questions.map(q => <li key={q.key}>{q.label}: {q.options.length
    ? `${q.options[0]}–${q.options[q.options.length - 1]}` : 'texto opcional'}{q.required && ' (obrigatória)'}</li>)}</ol>
}
export function Events({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [events, setEvents] = useState<EventView[] | null>(null)
  const [selected, setSelected] = useState<EventView | null>(null)
  const [creating, setCreating] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState('')
  function failure(error: unknown) {
    if (error instanceof ApiError && error.status === 401) onSessionExpired()
    setMessage(error instanceof PhoneListError
      ? `Telefones inválidos nas linhas: ${error.lines.join(', ')}. Nenhum telefone foi gravado.`
      : error instanceof ApiError && error.status === 400
        ? 'Confira os campos e o limite de 1.000 telefones por evento.'
        : 'Não foi possível concluir. Confira sua conexão e tente novamente.')
  }
  async function load() {
    setMessage('')
    try { setEvents(await eventApi.list()) } catch (error) { failure(error) }
  }
  useEffect(() => { void load() }, [])
  async function run(action: () => Promise<EventView>, form?: HTMLFormElement) {
    if (busy) return
    setBusy(true); setMessage(''); setSuccess('')
    try {
      const result = await action()
      setSelected(result); setCreating(false); form?.reset()
      setEvents(previous => [result, ...(previous ?? []).filter(item => item.id !== result.id)])
      setSuccess('Operação concluída.')
    } catch (error) { failure(error) } finally { setBusy(false) }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, data = new FormData(form)
    void run(() => eventApi.create({ name: String(data.get('name')), date: String(data.get('date')),
      description: String(data.get('description')), phones: String(data.get('phones')) }), form)
  }
  return <div className="event-area">
    {message && <p id="event-error" className="feedback" role="alert">{message}</p>}
    {success && <p role="status">{success}</p>}
    {!creating && !selected && <>
      <button onClick={() => { setCreating(true); setMessage(''); setSuccess('') }}>Cadastrar evento</button>
      {events === null && !message && <p role="status">Carregando eventos...</p>}
      {events === null && message && <button onClick={() => void load()}>Tentar novamente</button>}
      {events?.length === 0 && <div className="empty-state"><h2>Nenhum evento por aqui ainda</h2><p>Cadastre seu primeiro evento para publicar uma pesquisa.</p></div>}
      <ul className="event-list">{events?.map(item => <li key={item.id}><button className="text-button" disabled={busy}
        onClick={() => void run(() => eventApi.get(item.id))}>{item.name} — {item.date.split('-').reverse().join('/')}</button></li>)}</ul>
    </>}
    {creating && <section className="event-card"><h2>Cadastrar evento</h2><form onSubmit={create}>
      <label htmlFor="event-name">Nome</label><input id="event-name" name="name" required maxLength={160} disabled={busy} />
      <label htmlFor="event-date">Data do evento</label><input id="event-date" name="date" type="date" required disabled={busy} />
      <label htmlFor="event-description">Descrição (opcional)</label><textarea id="event-description" name="description" maxLength={2000} disabled={busy} />
      <label htmlFor="event-phones">Telefones autorizados (opcional)</label><textarea id="event-phones" name="phones" maxLength={32000} rows={6} disabled={busy} aria-describedby="phone-help event-error" />
      <p id="phone-help" className="supporting-text">Um telefone brasileiro com DDD por linha. Código 55 opcional. Até 1.000 telefones por evento.</p>
      <button disabled={busy}>{busy ? 'Salvando...' : 'Salvar evento'}</button>
    </form></section>}
    {selected && !creating && showResults && <><EventResults key={selected.id} eventId={selected.id} onSessionExpired={onSessionExpired} />
      <button className="text-button" onClick={() => setShowResults(false)}>Voltar ao evento</button></>}
    {selected && !creating && !showResults && <section className="event-card"><h2>{selected.name}</h2>
      <button onClick={() => setShowResults(true)}>Resultados</button>
      <p className="event-date">Data: {selected.date.split('-').reverse().join('/')}</p><p>{selected.description}</p>
      <h3>Pesquisa padrão · versão {selected.version}</h3><SurveyPreview questions={selected.questions} />
      {selected.publicUrl ? <><p role="status">Pesquisa publicada. As perguntas estão fixadas.</p>
        <SurveyLink key={selected.publicUrl} url={selected.publicUrl} /></>
        : <><p>Rascunho: ainda não aceita respostas.</p><button disabled={busy} onClick={() => void run(() => eventApi.publish(selected.id))}>{busy ? 'Publicando...' : 'Publicar pesquisa'}</button></>}
      <h3>Telefones autorizados ({selected.phones.length})</h3>
      {selected.phones.length ? <ul className="phone-list">{selected.phones.map(phone => <li key={phone}>{phone}</li>)}</ul> : <p>Nenhum telefone autorizado.</p>}
      <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
        void run(() => eventApi.addPhones(selected.id, String(new FormData(form).get('phones'))), form) }}>
        <label htmlFor="more-phones">Adicionar telefones, um por linha</label><textarea id="more-phones" name="phones" required maxLength={32000} rows={5} disabled={busy} aria-describedby="event-error" />
        <button disabled={busy}>{busy ? 'Salvando...' : 'Adicionar telefones'}</button>
      </form>
    </section>}
    {(creating || selected) && <button className="text-button" disabled={busy} onClick={() => { setCreating(false); setSelected(null); setShowResults(false); setMessage(''); setSuccess('') }}>Voltar aos eventos</button>}
  </div>
}
