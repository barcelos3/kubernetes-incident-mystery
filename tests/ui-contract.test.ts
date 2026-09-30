import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('mystery interface contract', () => {
  it('provides case file, tutorial, terminal, evidence board, and accessible controls', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

    expect(html).toContain('O INCIDENTE DO NAMESPACE FANTASMA')
    expect(html).toContain('id="terminal-input"')
    expect(html).toContain('id="terminal-output"')
    expect(html).toContain('id="tutorial-panel"')
    expect(html).toContain('id="evidence-list"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Modo investigação')
    expect(html).toContain('Modo tutorial')
    expect(html).toContain('id="case-selector"')
    expect(html).toContain('id="case-level"')
    expect(source).toContain("createMysterySession(activeCase.id)")
    expect(source).toContain('renderCaseSelector')
  })
})
