// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SurveyLink } from './SurveyLink'

const url = 'http://localhost:15173/s/fictitious-survey'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('copies the complete URL, announces success and keeps the open action', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SurveyLink url={url} />)
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
  await screen.findByText('Link copiado! Pronto para compartilhar.')
  expect(writeText).toHaveBeenCalledWith(url)
  const link = screen.getByRole('link', { name: 'Abrir pesquisa (nova aba)' })
  expect(link.getAttribute('href')).toBe(url)
  expect(link.getAttribute('target')).toBe('_blank')
})

it.each([undefined, { writeText: vi.fn().mockRejectedValue(new Error('Denied')) }])(
  'selects the URL for manual copy when the clipboard is unavailable or denied', async clipboard => {
    vi.stubGlobal('navigator', { clipboard })
    render(<SurveyLink url={url} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await screen.findByText(/Não foi possível copiar automaticamente/)
    const input = screen.getByLabelText('Link para compartilhar') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(url.length)
    expect(input.value).toBe(url)
  },
)

it('disables repeated copy attempts until the clipboard finishes', async () => {
  let done: () => void = () => undefined
  const writeText = vi.fn(() => new Promise<void>(resolve => { done = resolve }))
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SurveyLink url={url} />)
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
  const button = screen.getByRole('button', { name: 'Copiando...' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(writeText).toHaveBeenCalledOnce()
  done()
  await screen.findByText('Link copiado! Pronto para compartilhar.')
})
