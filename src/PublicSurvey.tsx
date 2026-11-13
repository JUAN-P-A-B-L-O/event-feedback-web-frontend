import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api/auth'
import { eventApi, type PublicSurvey as Survey } from './api/events'

export function PublicSurvey({ token }: { token: string }) {
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  async function load() {
    setLoading(true); setMessage(''); setUnavailable(false)
    try { setSurvey(await eventApi.survey(token)) }
    catch (error) {
      if (error instanceof ApiError && error.status === 404) setUnavailable(true)
      else setMessage('Não foi possível carregar. Tente novamente.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [token])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !survey) return
    const data = new FormData(event.currentTarget)
    setBusy(true); setMessage('')
    try {
      await eventApi.respond(token, String(data.get('phone')), survey.questions
        .filter(q => q.required || String(data.get(q.key)).trim())
        .map(q => ({ questionKey: q.key, value: String(data.get(q.key)) })))
      setSent(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setUnavailable(true)
      else setMessage(error instanceof ApiError && error.status === 409
        ? 'Não foi possível enviar. Confira o telefone informado ou se você já respondeu.'
        : error instanceof ApiError && error.status === 429
          ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
          : 'Não foi possível enviar. Confira os campos e tente novamente.')
    } finally { setBusy(false) }
  }
  return <div className="shell"><header className="site-header"><div className="brand">event<span>feedback</span></div></header>
    <main><section className="panel survey-panel">
      {loading && <p role="status">Carregando pesquisa...</p>}
      {unavailable && <h1>Pesquisa indisponível</h1>}
      {sent && <div role="status"><h1>Resposta recebida</h1><p>Obrigado por compartilhar sua opinião.</p></div>}
      {message && <p id="survey-error" className="feedback" role="alert">{message}</p>}
      {!loading && !unavailable && !survey && <button onClick={() => void load()}>Tentar novamente</button>}
      {!loading && !unavailable && !sent && survey && <><h1>{survey.name}</h1>
        <p id="phone-purpose">Usamos seu telefone para conferir se ele está autorizado neste evento e evitar respostas duplicadas. Ele fica associado à resposta. Informá-lo não comprova identidade nem posse do número.</p>
        <form onSubmit={event => void submit(event)} aria-describedby="survey-error">
          <label htmlFor="participant-phone">Telefone com DDD</label><input id="participant-phone" name="phone" type="tel" autoComplete="tel" maxLength={32} required disabled={busy} aria-describedby="phone-purpose survey-error" />
          {survey.questions.map(q => <div className="question" key={q.key}><label htmlFor={`question-${q.key}`}>{q.label}{!q.required && ' (opcional)'}</label>
            {q.options.length ? <select id={`question-${q.key}`} name={q.key} required={q.required} disabled={busy} defaultValue="">
              <option value="" disabled>Selecione uma nota</option>{q.options.map(option => <option key={option} value={option}>{option}</option>)}
            </select> : <textarea id={`question-${q.key}`} name={q.key} maxLength={2000} rows={4} disabled={busy} />}</div>)}
          <button disabled={busy}>{busy ? 'Enviando...' : 'Enviar resposta'}</button>
        </form></>}
    </section></main></div>
}
