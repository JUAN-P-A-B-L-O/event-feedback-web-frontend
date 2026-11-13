import { useRef, useState } from 'react'

export function SurveyLink({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle')

  async function copy() {
    if (state === 'copying') return
    setState('copying')
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('manual')
      input.current?.focus()
      input.current?.select()
    }
  }

  return <section className="survey-link" aria-labelledby="share-title">
    <h3 id="share-title">Compartilhe a pesquisa</h3>
    <p className="supporting-text">Copie o endereço e envie aos participantes autorizados.</p>
    <label htmlFor="public-link">Link para compartilhar</label>
    <input ref={input} id="public-link" readOnly value={url} onFocus={event => event.target.select()} aria-describedby="copy-feedback" />
    <div className="link-actions">
      <button type="button" disabled={state === 'copying'} onClick={() => void copy()}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
        {state === 'copying' ? 'Copiando...' : 'Copiar link'}
      </button>
      <a href={url} target="_blank" rel="noreferrer">Abrir pesquisa <span aria-hidden="true">↗</span><span className="sr-only"> (nova aba)</span></a>
    </div>
    <p id="copy-feedback" className="copy-feedback" role="status">
      {state === 'copied' ? 'Link copiado! Pronto para compartilhar.'
        : state === 'manual' ? 'Não foi possível copiar automaticamente. O endereço está selecionado; use a opção de copiar do seu dispositivo.'
          : 'Você também pode selecionar o endereço e copiar manualmente.'}
    </p>
  </section>
}
