import './style.css'
import { cases, getCaseContent, type CaseContent } from './case-content'
import { createMysterySession, type CommandResult } from './simulator'

const output = document.querySelector<HTMLElement>('#terminal-output')!
const form = document.querySelector<HTMLFormElement>('#terminal-form')!
const input = document.querySelector<HTMLInputElement>('#terminal-input')!
const evidenceList = document.querySelector<HTMLOListElement>('#evidence-list')!
const caseSelector = document.querySelector<HTMLElement>('#case-selector')!
const caseNumber = document.querySelector<HTMLElement>('#case-number')!
const caseLevel = document.querySelector<HTMLElement>('#case-level')!
const caseTitle = document.querySelector<HTMLElement>('#case-title')!
const caseTitleMain = document.querySelector<HTMLElement>('#case-title-main')!
const caseTitleEmphasis = document.querySelector<HTMLElement>('#case-title-emphasis')!
const caseLead = document.querySelector<HTMLElement>('#case-lead')!
const caseSeverity = document.querySelector<HTMLElement>('#case-severity')!
const fileTitle = document.querySelector<HTMLElement>('#file-title')!
const caseCluster = document.querySelector<HTMLElement>('#case-cluster')!
const caseNamespace = document.querySelector<HTMLElement>('#case-namespace')!
const caseStart = document.querySelector<HTMLElement>('#case-start')!
const caseImpact = document.querySelector<HTMLElement>('#case-impact')!
const caseTestimony = document.querySelector<HTMLElement>('#case-testimony')!
const caseWitness = document.querySelector<HTMLElement>('#case-witness')!
const caseObjective = document.querySelector<HTMLElement>('#case-objective')!
const terminalNamespace = document.querySelector<HTMLElement>('#terminal-namespace')!
const quickCommands = document.querySelector<HTMLElement>('#quick-commands')!
const tutorialPanel = document.querySelector<HTMLElement>('#tutorial-panel')!
const tutorialTitle = document.querySelector<HTMLElement>('#tutorial-title')!
const tutorialCopy = document.querySelector<HTMLElement>('#tutorial-copy')!
const tutorialCommand = document.querySelector<HTMLButtonElement>('#tutorial-command')!
const tutorialCounter = document.querySelector<HTMLElement>('#tutorial-counter')!
const tutorialProgress = document.querySelector<HTMLElement>('#tutorial-progress')!
const tutorialHint = document.querySelector<HTMLButtonElement>('#tutorial-hint')!
const tutorialExplanation = document.querySelector<HTMLElement>('#tutorial-explanation')!
const resetButton = document.querySelector<HTMLButtonElement>('#reset-case')!
const successDialog = document.querySelector<HTMLElement>('#success-dialog')!
const successTitle = document.querySelector<HTMLElement>('#success-title')!
const successCopy = document.querySelector<HTMLElement>('#success-copy')!
const caseScore = document.querySelector<HTMLElement>('#case-score')!
const closeSuccess = document.querySelector<HTMLButtonElement>('#close-success')!

let activeCase: CaseContent = cases[0]
let session = createMysterySession(activeCase.id)
let mode: 'investigation' | 'tutorial' = 'investigation'
let tutorialIndex = 0
let historyIndex = 0
const commandHistory: string[] = []
const evidence = new Set<string>()
const completedCases = loadCompletedCases()

function loadCompletedCases(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('k8s-mystery-completed') ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveCompletedCases() {
  try {
    localStorage.setItem('k8s-mystery-completed', JSON.stringify([...completedCases]))
  } catch {
    // Progress persistence is optional; gameplay remains fully functional.
  }
}

function makeCaseButton(item: CaseContent): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'case-option'
  button.dataset.case = item.id
  button.setAttribute('role', 'listitem')
  button.setAttribute('aria-pressed', String(item.id === activeCase.id))

  const top = document.createElement('span')
  top.className = 'case-option-top'
  const level = document.createElement('b')
  level.textContent = `NÍVEL ${item.difficulty} · ${item.level}`
  const xp = document.createElement('small')
  xp.textContent = `${item.xp} XP`
  top.append(level, xp)

  const title = document.createElement('strong')
  title.textContent = item.titleMain.replace('O ', '') + ' ' + item.titleEmphasis
  const topic = document.createElement('span')
  topic.className = 'case-topic'
  topic.textContent = item.id === 'namespace-ghost' ? 'Services & selectors' : item.id === 'poisoned-configmap' ? 'ConfigMaps & rollouts' : 'NetworkPolicies & egress'
  const difficulty = document.createElement('span')
  difficulty.className = 'difficulty-meter'
  difficulty.setAttribute('aria-label', `${item.difficulty} de 3 níveis de dificuldade`)
  for (let index = 0; index < 3; index += 1) {
    const bar = document.createElement('i')
    if (index < item.difficulty) bar.className = 'filled'
    difficulty.append(bar)
  }

  button.append(top, title, topic, difficulty)
  if (completedCases.has(item.id)) {
    const completed = document.createElement('em')
    completed.textContent = 'CONCLUÍDO'
    button.append(completed)
  }
  button.addEventListener('click', () => selectCase(item.id))
  return button
}

function renderCaseSelector() {
  caseSelector.replaceChildren(...cases.map(makeCaseButton))
  caseSelector.querySelectorAll<HTMLButtonElement>('.case-option').forEach(button => {
    const selected = button.dataset.case === activeCase.id
    button.classList.toggle('active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

function renderQuickCommands() {
  quickCommands.replaceChildren()
  activeCase.quickCommands.forEach(command => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.command = command
    const pieces = command.split(' ')
    button.textContent = pieces.slice(1, 3).join(' ')
    button.title = command
    button.addEventListener('click', () => runCommand(command))
    quickCommands.append(button)
  })
}

function applyCaseContent() {
  caseNumber.textContent = activeCase.number
  caseLevel.textContent = `NÍVEL ${activeCase.difficulty} · ${activeCase.level}`
  caseLevel.dataset.level = String(activeCase.difficulty)
  caseTitleMain.textContent = activeCase.titleMain
  caseTitleEmphasis.textContent = activeCase.titleEmphasis
  caseTitle.setAttribute('aria-label', `${activeCase.titleMain} ${activeCase.titleEmphasis}`)
  caseLead.textContent = activeCase.summary
  caseSeverity.textContent = activeCase.severity
  fileTitle.textContent = activeCase.fileTitle
  caseCluster.textContent = activeCase.cluster
  caseNamespace.textContent = activeCase.namespace
  caseStart.textContent = activeCase.start
  caseImpact.textContent = activeCase.impact
  caseTestimony.textContent = activeCase.testimony
  caseWitness.textContent = activeCase.witness
  caseObjective.textContent = activeCase.objective
  terminalNamespace.textContent = `ns: ${activeCase.namespace}`
  input.placeholder = activeCase.placeholder
  successTitle.textContent = activeCase.successTitle
  successCopy.textContent = activeCase.successText
  caseScore.textContent = `${activeCase.xp} XP`
  renderCaseSelector()
  renderQuickCommands()
  renderTutorial()
}

function selectCase(id: string) {
  if (id === activeCase.id) return
  activeCase = getCaseContent(id)
  session = createMysterySession(activeCase.id)
  evidence.clear()
  tutorialIndex = 0
  successDialog.hidden = true
  output.replaceChildren()
  const line = document.createElement('div')
  line.className = 'system-line'
  line.textContent = `${activeCase.number} carregado — ${activeCase.level}. Digite help ou ative o tutorial.`
  output.append(line)
  applyCaseContent()
  renderEvidence()
  input.focus()
  document.querySelector('.workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function appendEntry(command: string, result: CommandResult) {
  const wrapper = document.createElement('div')
  wrapper.className = `terminal-entry${result.ok ? '' : ' error'}`
  const commandLine = document.createElement('div')
  commandLine.className = 'command'
  commandLine.textContent = command
  const pre = document.createElement('pre')
  pre.textContent = result.output
  wrapper.append(commandLine, pre)
  output.append(wrapper)
  output.scrollTop = output.scrollHeight
}

function renderEvidence() {
  evidenceList.replaceChildren()
  if (evidence.size === 0) {
    const empty = document.createElement('li')
    empty.className = 'empty-evidence'
    empty.textContent = 'Nenhuma pista ainda. Comece pelo primeiro comando do caso.'
    evidenceList.append(empty)
    return
  }
  for (const key of evidence) {
    const label = activeCase.evidenceLabels[key]
    if (!label) continue
    const item = document.createElement('li')
    item.textContent = label
    evidenceList.append(item)
  }
}

function renderTutorial() {
  const steps = activeCase.tutorialSteps
  const step = steps[Math.min(tutorialIndex, steps.length - 1)]
  tutorialTitle.textContent = step.title
  tutorialCopy.textContent = step.copy
  tutorialCommand.querySelector('code')!.textContent = step.command
  tutorialCounter.textContent = `PASSO ${Math.min(tutorialIndex + 1, steps.length)} DE ${steps.length}`
  tutorialProgress.style.width = `${((tutorialIndex + 1) / steps.length) * 100}%`
  tutorialExplanation.textContent = step.explanation
  tutorialExplanation.hidden = true
  tutorialHint.textContent = 'Mostrar explicação'
}

function showHelp() {
  appendEntry('help', {
    ok: true,
    solved: session.isSolved(),
    discovered: [],
    output: ['COMANDOS DESTE CASO', ...activeCase.helpCommands, '', 'Atalhos locais: help, clear, reset'].join('\n'),
  })
}

function runCommand(rawCommand: string) {
  const command = rawCommand.trim()
  if (!command) return
  commandHistory.push(command)
  historyIndex = commandHistory.length

  if (command.toLowerCase() === 'clear') {
    output.replaceChildren()
    return
  }
  if (command.toLowerCase() === 'help') {
    showHelp()
    return
  }
  if (command.toLowerCase() === 'reset') {
    resetCase()
    return
  }

  const result = session.run(command)
  appendEntry(command, result)
  result.discovered.forEach(key => evidence.add(key))
  renderEvidence()

  if (mode === 'tutorial') {
    const step = activeCase.tutorialSteps[tutorialIndex]
    if (step && result.discovered.includes(step.discovery)) {
      tutorialIndex = Math.min(tutorialIndex + 1, activeCase.tutorialSteps.length - 1)
      window.setTimeout(renderTutorial, 220)
    }
  }

  if (result.solved) {
    completedCases.add(activeCase.id)
    saveCompletedCases()
    renderCaseSelector()
    window.setTimeout(() => {
      successDialog.hidden = false
      closeSuccess.focus()
    }, 350)
  }
}

function resetCase() {
  session.reset()
  session = createMysterySession(activeCase.id)
  evidence.clear()
  tutorialIndex = 0
  output.replaceChildren()
  const intro = document.createElement('div')
  intro.className = 'system-line'
  intro.textContent = `${activeCase.number} reiniciado. O ambiente voltou ao estado inicial.`
  output.append(intro)
  successDialog.hidden = true
  renderEvidence()
  renderTutorial()
  input.focus()
}

form.addEventListener('submit', event => {
  event.preventDefault()
  runCommand(input.value)
  input.value = ''
})

input.addEventListener('keydown', event => {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    historyIndex = Math.max(0, historyIndex - 1)
    input.value = commandHistory[historyIndex] ?? ''
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    historyIndex = Math.min(commandHistory.length, historyIndex + 1)
    input.value = commandHistory[historyIndex] ?? ''
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault()
    output.replaceChildren()
  }
})

document.querySelectorAll<HTMLButtonElement>('.mode').forEach(button => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode === 'tutorial' ? 'tutorial' : 'investigation'
    document.querySelectorAll('.mode').forEach(item => item.classList.toggle('active', item === button))
    tutorialPanel.hidden = mode !== 'tutorial'
    if (mode === 'tutorial') renderTutorial()
    input.focus()
  })
})

tutorialCommand.addEventListener('click', () => runCommand(activeCase.tutorialSteps[tutorialIndex].command))
tutorialHint.addEventListener('click', () => {
  tutorialExplanation.hidden = !tutorialExplanation.hidden
  tutorialHint.textContent = tutorialExplanation.hidden ? 'Mostrar explicação' : 'Ocultar explicação'
})
resetButton.addEventListener('click', resetCase)
closeSuccess.addEventListener('click', () => {
  successDialog.hidden = true
  input.focus()
})
successDialog.addEventListener('click', event => {
  if (event.target === successDialog) closeSuccess.click()
})

applyCaseContent()
renderEvidence()
