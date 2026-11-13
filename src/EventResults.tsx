import { useEffect, useRef, useState } from 'react'
import { ApiError } from './api/auth'
import { eventApi, type Comments, type Results, type Rating } from './api/events'

const number = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const date = (value: string) => value.split('-').reverse().join('/')
const percent = (value: number | null) => value === null ? 'Não disponível' : `${number(value)}%`
const groupLabels: Record<string, string> = { detractors: 'Detratores (0–6)', neutral: 'Neutros (7–8)', promoters: 'Promotores (9–10)' }

function RatingChart({ rating }: { rating: Rating }) {
  return <section className="result-card"><h3>{rating.label}</h3>
    <p className="result-value">{rating.average === null ? 'Sem respostas' : `${number(rating.average)} de 5`}</p>
    <p>{rating.validResponses} respostas válidas</p>
    <ul className="rating-bars" aria-label={`Distribuição: ${rating.label}`}>{rating.distribution.map(bucket =>
      <li key={bucket.label}><span>Nota {bucket.label}</span><div className="bar-track" aria-hidden="true"><span style={{ width: `${bucket.percentage ?? 0}%` }} /></div>
        <span>{bucket.count} · {percent(bucket.percentage)}</span></li>)}</ul>
  </section>
}

export function EventResults({ eventId, onSessionExpired }: { eventId: string; onSessionExpired: () => void }) {
  const [data, setData] = useState<Results | null>(null)
  const [comments, setComments] = useState<Comments | null>(null)
  const [busy, setBusy] = useState(true)
  const [commentsBusy, setCommentsBusy] = useState(false)
  const [error, setError] = useState('')
  const [commentError, setCommentError] = useState('')
  const active = useRef(true)
  const callback = useRef(onSessionExpired)
  callback.current = onSessionExpired
  function failure(error: unknown, comments = false) {
    if (!active.current) return
    if (error instanceof ApiError && error.status === 401) callback.current()
    const message = error instanceof ApiError && error.status === 404
      ? 'Resultados indisponíveis.' : 'Não foi possível atualizar. Tente novamente.'
    if (comments) setCommentError(message); else setError(message)
  }
  async function loadComments(page: number) {
    setCommentsBusy(true); setCommentError('')
    try { const result = await eventApi.comments(eventId, page); if (active.current) setComments(result) }
    catch (error) { failure(error, true) }
    finally { if (active.current) setCommentsBusy(false) }
  }
  async function refresh() {
    setBusy(true); setError('')
    try {
      const result = await eventApi.results(eventId)
      if (!active.current) return
      setData(result)
      if (result.hasCommentQuestion) await loadComments(0)
      else setComments(null)
    } catch (error) { failure(error) }
    finally { if (active.current) setBusy(false) }
  }
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false } }, [eventId])
  const participation = data?.participation
  const maxDaily = data?.daily.reduce((max, day) => Math.max(max, day.count), 1) ?? 1
  return <section className="results" aria-labelledby="results-title">
    <div className="results-heading"><h2 id="results-title">Resultados</h2>
      <button disabled={busy || commentsBusy} onClick={() => void refresh()}>{busy ? 'Atualizando resultados...' : 'Atualizar resultados'}</button></div>
    {error && <p className="feedback" role="alert">{error}</p>}
    {busy && <p role="status">{data ? 'Atualizando os resultados exibidos...' : 'Carregando resultados...'}</p>}
    {data && participation && <>
      <h3>{data.name}</h3><p>Data: {date(data.date)} · {data.published ? `Pesquisa publicada · versão ${data.version}` : 'Pesquisa em rascunho'}</p>
      <section className="result-card" aria-labelledby="participation-title"><h3 id="participation-title">Participação na lista atual</h3>
        <dl className="participation-cards">
          <div><dt>Telefones autorizados · lista atual</dt><dd>{participation.authorizedPhones}</dd></div>
          <div><dt>Respostas recebidas</dt><dd>{participation.responses}</dd></div>
          <div><dt>Participação · lista atual</dt><dd>{percent(participation.percentage)}</dd></div>
        </dl>
        {participation.authorizedPhones > 0 && <progress aria-label="Participação na lista atual" value={participation.responses} max={participation.authorizedPhones} />}
        <p>{participation.responses} de {participation.authorizedPhones} responderam.</p>
        <p className="result-note">Adicionar participantes à lista atual pode alterar o percentual de participação.</p>
      </section>
      {participation.responses === 0 && <p className="empty-state">Ainda não há respostas</p>}
      <div className="ratings-grid">{data.ratings.map(rating => <RatingChart key={rating.questionKey} rating={rating} />)}</div>
      {data.recommendation && <section className="result-card"><h3>Recomendação / NPS</h3><p>{data.recommendation.label}</p>
        <p className="result-value">{data.recommendation.score === null ? 'Sem respostas' : `${data.recommendation.score > 0 ? '+' : ''}${number(data.recommendation.score)}`}</p>
        <p>{data.recommendation.validResponses} respostas válidas · escala de −100 a +100</p>
        <div className="nps-bar" aria-hidden="true">{data.recommendation.groups.map(group => <span key={group.label} className={group.label} style={{ width: `${group.percentage ?? 0}%` }} />)}</div>
        <ul className="nps-legend">{data.recommendation.groups.map(group => <li key={group.label}><span className={`group-marker ${group.label}`} aria-hidden="true" />{groupLabels[group.label]}: {group.count} · {percent(group.percentage)}</li>)}</ul>
      </section>}
      <section className="result-card"><h3>Evolução das respostas</h3><p className="result-note">Respostas por dia · fuso {data.timezone}</p>
        {data.daily.length === 0 ? <p>Sem respostas</p> : <>
          <div className="daily-columns" aria-hidden="true">{data.daily.map(day => <div className="daily-column" key={day.date}><span style={{ height: `${day.count / maxDaily * 100}%` }} /></div>)}</div>
          <details><summary>Ver datas e quantidades do gráfico</summary><table className="daily-table"><caption>Respostas por dia ({data.timezone})</caption>
            <thead><tr><th scope="col">Data</th><th scope="col">Respostas</th></tr></thead>
            <tbody>{data.daily.map(day => <tr key={day.date}><th scope="row">{date(day.date)}</th><td>{day.count}</td></tr>)}</tbody>
          </table></details>
          <p>De {date(data.daily[0].date)} a {date(data.daily[data.daily.length - 1].date)}; cada coluna representa um dia.</p>
        </>}
      </section>
      {data.hasCommentQuestion && <section className="result-card"><h3>Comentários</h3>
        <p className="result-note">Comentários podem conter informações pessoais inseridas por quem respondeu.</p>
        {commentError && <><p className="feedback" role="alert">{commentError}</p><button disabled={busy || commentsBusy} onClick={() => void loadComments(comments?.page ?? 0)}>Tentar carregar comentários novamente</button></>}
        {commentsBusy && <p role="status">Carregando comentários...</p>}
        {comments && <><p>{comments.total} comentários preenchidos · mais recentes primeiro</p>
          {comments.items.length === 0 ? <p>Nenhum comentário nesta página.</p> : <ul className="comment-list">{comments.items.map((text, index) => <li key={`${comments.page}-${index}`}>{text}</li>)}</ul>}
          <div className="comment-pagination"><button disabled={busy || commentsBusy || comments.page === 0} onClick={() => void loadComments(comments.page - 1)}>Página anterior</button>
            <span>Página {comments.page + 1}</span><button disabled={busy || commentsBusy || (comments.page + 1) * comments.size >= comments.total} onClick={() => void loadComments(comments.page + 1)}>Próxima página</button></div>
        </>}
      </section>}
    </>}
  </section>
}
