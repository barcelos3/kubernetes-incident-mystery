import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--disable-dev-shm-usage'],
})

const errors = []
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4174/'
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto(baseURL, { waitUntil: 'networkidle' })
assert.equal(await page.title(), 'Kubernetes Incident Mystery')
assert.equal(await page.locator('h1').getAttribute('aria-label'), 'O INCIDENTE DO NAMESPACE FANTASMA')
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false)

const submit = async command => {
  await page.locator('#terminal-input').fill(command)
  await page.locator('#terminal-form').evaluate(form => form.requestSubmit())
  await page.waitForTimeout(30)
}

await page.getByRole('button', { name: 'Modo tutorial' }).click()
assert.equal(await page.locator('#tutorial-panel').isVisible(), true)
assert.match(await page.locator('#tutorial-title').innerText(), /Encontre o namespace/)

const commands = [
  'kgns',
  'kgp -n production',
  'kdp checkout-api-7d9c8b6f4-x2k9m -n production',
  'kl checkout-api-7d9c8b6f4-x2k9m -n production',
  'kgs -n production',
  'kds redis-service -n production',
  'kgpsl -n production',
  'kgep redis-service -n production',
]

for (const command of commands) {
  await submit(command)
}

await submit('vi redis-fix.yaml')
await page.locator('#vim-editor').waitFor({ state: 'visible' })
await page.locator('#vim-content').fill(`apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: production
spec:
  selector:
    app: redis`)
await page.locator('#vim-save').click()
await page.locator('#vim-editor').waitFor({ state: 'hidden' })
await submit('kaf redis-fix.yaml')

assert.match(await page.locator('#terminal-output').innerText(), /service\/redis-service configured/)
assert.match(await page.locator('#evidence-list').innerText(), /Causa raiz corrigida/)
await page.locator('#success-dialog').waitFor({ state: 'visible', timeout: 2000 })
assert.equal(await page.locator('#success-dialog').isVisible(), true)
await page.getByRole('button', { name: 'Revisar evidências' }).click()

const runCase = async (caseId, expectedTitle, commandsForCase) => {
  await page.locator(`[data-case="${caseId}"]`).click()
  await page.waitForTimeout(250)
  assert.match(await page.locator('#case-title').getAttribute('aria-label'), expectedTitle)
  for (const command of commandsForCase) {
    await submit(command)
  }
  await page.locator('#success-dialog').waitFor({ state: 'visible', timeout: 2000 })
  await page.getByRole('button', { name: 'Revisar evidências' }).click()
}

await runCase('poisoned-configmap', /CONFIGMAP ENVENENADO/, [
  'kubectl get pods -n staging',
  'kubectl logs payments-worker-6b7d8f9c5-j4n2p -n staging',
  'kubectl describe deployment payments-worker -n staging',
  'kubectl get configmap payments-config -n staging -o yaml',
  `kubectl patch configmap payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`,
  'kubectl rollout restart deployment payments-worker -n staging',
])

await runCase('midnight-lockdown', /BLOQUEIO DA MEIA-NOITE/, [
  'kubectl get pods -n secure-prod',
  'kubectl logs orders-api-5d7f8f6b9-q7w4e -n secure-prod',
  'kubectl get networkpolicy -n secure-prod',
  'kubectl describe networkpolicy allow-api-db -n secure-prod',
  'kubectl get pods -n secure-prod --show-labels',
  `kubectl patch networkpolicy allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`,
  'kubectl exec orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432',
])

assert.equal(await page.locator('.case-option em').count(), 3)
await page.screenshot({ path: '/home/comitre/kubernetes-incident-mystery/kubernetes-mystery-preview.png', fullPage: true })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.goto(baseURL, { waitUntil: 'networkidle' })
assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false)
assert.equal(await mobile.locator('#terminal-input').isVisible(), true)
await mobile.screenshot({ path: '/home/comitre/kubernetes-incident-mystery/kubernetes-mystery-mobile.png', fullPage: true })

assert.deepEqual(errors, [])
console.log(JSON.stringify({
  title: await page.title(),
  tutorial: true,
  casesVerified: 3,
  commandsExecuted: 23,
  aliasesVerified: true,
  vimWorkspaceVerified: true,
  solved: true,
  desktopOverflow: false,
  mobileOverflow: false,
  errors,
}, null, 2))
await browser.close()
