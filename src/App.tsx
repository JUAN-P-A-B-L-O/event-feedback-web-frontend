import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, authApi, type Organizer } from './api/auth'

import { Events } from './Events'
import { PublicSurvey } from './PublicSurvey'

export function App() {
  const match = window.location.pathname.match(/^\/s\/([^/]+)\/?$/)
  return match ? <PublicSurvey token={match[1]} /> : <OrganizerApp />
}

type View = 'loading' | 'login' | 'workspace' | 'error'

function OrganizerApp() {
  const [view, setView] = useState<View>('loading')
  const [organizer, setOrganizer] = useState<Organizer | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadSession(refresh = false) {
    if (!refresh) setView('loading')
    try {
      setOrganizer(await authApi.me())
      setView('workspace')
    } catch (error) {
      setOrganizer(null)
      if (error instanceof ApiError && error.status === 401) {
        setMessage(refresh ? 'Sua sessão expirou. Entre novamente.' : '')
        setView('login')
      } else {
        setMessage('Não foi possível carregar sua sessão. Tente novamente.')
        setView('error')
      }
    }
  }

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    if (view !== 'workspace') return
    const checkOnReturn = () => {
      if (document.visibilityState === 'visible') void loadSession(true)
    }
    document.addEventListener('visibilitychange', checkOnReturn)
    return () => document.removeEventListener('visibilitychange', checkOnReturn)
  }, [view])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setMessage('')
    try {
      setOrganizer(await authApi.login(String(data.get('email')), String(data.get('password'))))
      form.reset()
      setView('workspace')
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 401
        ? 'E-mail ou senha inválidos.'
        : 'Não foi possível entrar. Confira sua conexão e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setMessage('')
    try {
      await authApi.logout()
      setOrganizer(null)
      setView('login')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setOrganizer(null)
        setMessage('Sua sessão expirou. Entre novamente.')
        setView('login')
      } else {
        setMessage('Não foi possível sair. Tente novamente.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell">
      <header className="site-header">
        <div className="brand" aria-label="Event Feedback">event<span>feedback</span></div>
        {view === 'workspace' && <button className="text-button" onClick={() => void logout()} disabled={busy}>Sair</button>}
      </header>
      <main>
        {view === 'loading' && <section className="panel" role="status"><p>Carregando sua área...</p></section>}
        {view === 'error' && <section className="panel" role="alert"><h1>Algo deu errado</h1><p>{message}</p><button onClick={() => void loadSession()}>Tentar novamente</button></section>}
        {view === 'login' && <section className="panel login-panel" aria-labelledby="login-heading">
          <p className="eyebrow">Área do organizador</p>
          <h1 id="login-heading">Bem-vindo de volta.</h1>
          <p className="intro">Entre para acompanhar os seus eventos e pesquisas.</p>
          <form onSubmit={event => void login(event)}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" required disabled={busy} />
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required disabled={busy} />
            {message && <p className="feedback" role="alert">{message}</p>}
            <button type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </section>}
        {view === 'workspace' && organizer && <section className="workspace">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">{organizer.organization.name}</p>
              <h1>Olá, {organizer.displayName}.</h1>
              <p className="intro">Seu espaço para acompanhar eventos e pesquisas.</p>
            </div>
          </div>
          {message && <p className="feedback" role="alert">{message}</p>}
          <Events onSessionExpired={() => void loadSession(true)} />
        </section>}
      </main>
    </div>
  )
}
