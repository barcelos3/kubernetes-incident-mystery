import { parseDocument } from 'yaml'

export type MysteryCaseSummary = {
  id: string
  level: 'Iniciante' | 'Intermediário' | 'Avançado'
  title: string
  tutorialSteps: string[]
}

const CASE_CATALOG: MysteryCaseSummary[] = [
  { id: 'namespace-ghost', level: 'Iniciante', title: 'O Incidente do Namespace Fantasma', tutorialSteps: ['namespace', 'pods', 'describe', 'logs', 'service', 'fix'] },
  { id: 'poisoned-configmap', level: 'Intermediário', title: 'O ConfigMap Envenenado', tutorialSteps: ['pods', 'logs', 'deployment', 'configmap', 'patch', 'rollout'] },
  { id: 'midnight-lockdown', level: 'Avançado', title: 'O Bloqueio da Meia-Noite', tutorialSteps: ['pods', 'logs', 'policies', 'describe', 'labels', 'patch'] },
]

export function listMysteryCases(): MysteryCaseSummary[] {
  return CASE_CATALOG.map(item => ({ ...item, tutorialSteps: [...item.tutorialSteps] }))
}

export type EditorRequest = {
  filename: string
  content: string
  applyOnSave: boolean
}

export type CommandResult = {
  ok: boolean
  output: string
  discovered: string[]
  solved: boolean
  editor?: EditorRequest
}

export type MysterySession = {
  run(command: string): CommandResult
  saveFile(filename: string, content: string, applyOnSave?: boolean): CommandResult
  reset(): void
  isSolved(): boolean
}

const PODS_OUTPUT = `NAME                              READY   STATUS             RESTARTS   AGE
web-frontend-64c8d7b5db-p8r2f    1/1     Running            0          43m
checkout-api-7d9c8b6f4-x2k9m    0/1     CrashLoopBackOff   8          39m
redis-6f88c74d8f-m4tq7            1/1     Running            0          2h`

const KUBECTL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  k: 'kubectl',
  kaf: 'kubectl apply -f',
  kg: 'kubectl get',
  kd: 'kubectl describe',
  kgp: 'kubectl get pods',
  kgpn: 'kubectl get pods -n',
  kgpsl: 'kubectl get pods --show-labels',
  kdp: 'kubectl describe pods',
  kgs: 'kubectl get services',
  kds: 'kubectl describe services',
  kgns: 'kubectl get namespaces',
  kdns: 'kubectl describe namespaces',
  kgd: 'kubectl get deployments',
  kdd: 'kubectl describe deployments',
  kgcm: 'kubectl get configmaps',
  kdcm: 'kubectl describe configmaps',
  kgep: 'kubectl get endpoints',
  kgnetpol: 'kubectl get networkpolicies',
  kdnetpol: 'kubectl describe networkpolicies',
  kl: 'kubectl logs',
  kex: 'kubectl exec',
  keti: 'kubectl exec -t -i',
  krrd: 'kubectl rollout restart deployment',
})

const RESOURCE_TYPE_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  namespaces: ['namespace', 'namespaces', 'ns'],
  pods: ['pod', 'pods', 'po'],
  svc: ['service', 'services', 'svc'],
  endpoints: ['endpoint', 'endpoints', 'ep'],
  deployment: ['deployment', 'deployments', 'deploy'],
  configmap: ['configmap', 'configmaps', 'cm'],
  networkpolicy: ['networkpolicy', 'networkpolicies', 'netpol'],
})

const RESOURCE_CANONICAL = new Map(
  Object.entries(RESOURCE_TYPE_ALIASES).flatMap(([canonical, forms]) => forms.map(form => [form, canonical] as const)),
)

export function listKubectlAliases(): Record<string, string> {
  return { ...KUBECTL_ALIASES }
}

export function listResourceTypeAliases(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(RESOURCE_TYPE_ALIASES).map(([resource, forms]) => [resource, [...forms]]))
}

function normalize(command: string): string {
  let normalized = command.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!normalized) return normalized

  const [head, ...tail] = normalized.split(' ')
  const expanded = KUBECTL_ALIASES[head]
  if (expanded) normalized = [expanded, ...tail].join(' ')

  normalized = normalized
    .replace(/--namespace=([^ ]+)/g, '-n $1')
    .replace(/--namespace /g, '-n ')

  const tokens = normalized.split(' ')
  const resourceIndex = tokens[0] === 'kubectl' && ['get', 'describe', 'edit', 'patch'].includes(tokens[1])
    ? 2
    : tokens[0] === 'kubectl' && tokens[1] === 'rollout' && tokens[2] === 'restart'
      ? 3
      : -1
  if (resourceIndex >= 0) {
    tokens[resourceIndex] = RESOURCE_CANONICAL.get(tokens[resourceIndex]) ?? tokens[resourceIndex]
  }

  if (tokens[0] === 'kubectl' && tokens[1] === 'exec') {
    while (['-i', '-t', '-it', '-ti'].includes(tokens[2])) tokens.splice(2, 1)
  }

  const showLabelsIndex = tokens.indexOf('--show-labels')
  if (showLabelsIndex >= 0 && showLabelsIndex !== tokens.length - 1) {
    tokens.splice(showLabelsIndex, 1)
    tokens.push('--show-labels')
  }
  return tokens.join(' ')
}

type ManifestObject = Record<string, unknown>

function isRecord(value: unknown): value is ManifestObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseManifest(content: string): ManifestObject | undefined {
  if (content.length > 64 * 1024) return undefined
  try {
    const document = parseDocument(content, { uniqueKeys: true })
    if (document.errors.length > 0) return undefined
    const value: unknown = document.toJS({ maxAliasCount: 0 })
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

function manifestValue(manifest: ManifestObject, path: string[]): unknown {
  let current: unknown = manifest
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

type VirtualWorkspaceHooks = {
  getSolved(): boolean
  edit(command: string): EditorRequest | undefined
  apply(filename: string, content: string): CommandResult
}

function createVirtualWorkspace(hooks: VirtualWorkspaceHooks) {
  const files = new Map<string, string>()
  const validFilename = /^[a-z0-9][a-z0-9._-]{0,80}\.(?:ya?ml|txt)$/i

  return {
    run(command: string, normalized: string): CommandResult | undefined {
      const editorMatch = command.trim().match(/^(?:vi|vim)\s+([^\s]+)$/i)
      if (editorMatch) {
        const filename = editorMatch[1]
        if (!validFilename.test(filename)) {
          return { ok: false, output: 'vi: use um nome local terminado em .yaml, .yml ou .txt', discovered: [], solved: hooks.getSolved() }
        }
        return {
          ok: true,
          output: `abrindo ${filename} no editor vi simulado`,
          discovered: ['virtual-editor-opened'],
          solved: hooks.getSolved(),
          editor: { filename, content: files.get(filename) ?? '', applyOnSave: false },
        }
      }

      const editRequest = hooks.edit(normalized)
      if (editRequest) {
        return {
          ok: true,
          output: `abrindo ${editRequest.filename} para edição; :wq salva e aplica, :q! cancela`,
          discovered: ['live-object-editor-opened'],
          solved: hooks.getSolved(),
          editor: editRequest,
        }
      }

      const catMatch = command.trim().match(/^cat\s+([^\s]+)$/i)
      if (catMatch) {
        const content = files.get(catMatch[1])
        return content === undefined
          ? { ok: false, output: `cat: ${catMatch[1]}: arquivo não encontrado`, discovered: [], solved: hooks.getSolved() }
          : { ok: true, output: content, discovered: ['virtual-file-read'], solved: hooks.getSolved() }
      }

      if (normalized === 'ls' || normalized === 'ls -la') {
        return {
          ok: true,
          output: [...files.keys()].sort().join('\n') || '(nenhum arquivo criado)',
          discovered: [],
          solved: hooks.getSolved(),
        }
      }

      const applyMatch = normalized.match(/^kubectl apply (?:-f|--filename)(?:=| )([^ ]+)$/)
      if (applyMatch) {
        const filename = command.trim().match(/(?:=|\s)([^\s]+)$/)?.[1] ?? applyMatch[1]
        const content = files.get(filename)
        if (content === undefined) {
          return { ok: false, output: `error: arquivo ${filename} não encontrado no workspace simulado`, discovered: [], solved: hooks.getSolved() }
        }
        return hooks.apply(filename, content)
      }
      return undefined
    },
    saveFile(filename: string, content: string, applyOnSave = false): CommandResult {
      if (!validFilename.test(filename)) {
        return { ok: false, output: 'erro: nome de arquivo inválido', discovered: [], solved: hooks.getSolved() }
      }
      files.set(filename, content)
      if (applyOnSave) return hooks.apply(filename, content)
      return {
        ok: true,
        output: `"${filename}" gravado (${content.split('\n').length} linhas)`,
        discovered: ['virtual-file-created'],
        solved: hooks.getSolved(),
      }
    },
    reset() {
      files.clear()
    },
  }
}

function createPoisonedConfigSession(): MysterySession {
  let patched = false
  let solved = false
  const workspace = createVirtualWorkspace({
    getSolved: () => solved,
    edit: command => command === 'kubectl edit configmap payments-config -n staging'
      ? {
          filename: 'payments-config.edit.yaml',
          content: patched
            ? 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: payments-config\n  namespace: staging\ndata:\n  PAYMENT_QUEUE_HOST: rabbitmq\n  PAYMENT_QUEUE_URL: amqp://rabbitmq:5672'
            : 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: payments-config\n  namespace: staging\ndata:\n  PAYMENT_QUEUE_HOST: rabbitmq\n  PAYMENT_QUEUE_PORT: "5672"',
          applyOnSave: true,
        }
      : undefined,
    apply: (_filename, content) => {
      const manifest = parseManifest(content)
      const valid = manifest?.kind === 'ConfigMap'
        && manifestValue(manifest, ['metadata', 'name']) === 'payments-config'
        && manifestValue(manifest, ['metadata', 'namespace']) === 'staging'
        && manifestValue(manifest, ['data', 'PAYMENT_QUEUE_URL']) === 'amqp://rabbitmq:5672'
      if (!valid) {
        return { ok: false, output: 'error: o manifesto não configura PAYMENT_QUEUE_URL em payments-config/staging', discovered: ['invalid-manifest'], solved }
      }
      patched = true
      return { ok: true, output: 'configmap/payments-config configured\nchange pending: restart the Deployment to reload environment variables', discovered: ['configmap-repaired'], solved }
    },
  })

  return {
    run(command: string): CommandResult {
      const normalized = normalize(command)
      const workspaceResult = workspace.run(command, normalized)
      if (workspaceResult) return workspaceResult
      if (normalized === 'kubectl get pods -n staging' || normalized === 'kubectl get po -n staging') {
        const status = solved ? 'Running' : 'CrashLoopBackOff'
        return {
          ok: true,
          output: `NAME                                  READY   STATUS             RESTARTS   AGE\npayments-worker-6b7d8f9c5-j4n2p      ${solved ? '1/1' : '0/1'}     ${status}   ${solved ? '0' : '11'}         48m\nrabbitmq-0                             1/1     Running            0          9d`,
          discovered: ['payments-failing'],
          solved,
        }
      }
      if (normalized === 'kubectl logs payments-worker-6b7d8f9c5-j4n2p -n staging') {
        return {
          ok: true,
          output: '[payments-worker] configuration error: required environment variable PAYMENT_QUEUE_URL is empty\n[payments-worker] shutting down with exit code 1',
          discovered: ['missing-queue-url'],
          solved,
        }
      }
      if (normalized === 'kubectl describe deployment payments-worker -n staging' || normalized === 'kubectl describe deploy payments-worker -n staging') {
        return {
          ok: true,
          output: 'Name: payments-worker\nNamespace: staging\nReplicas: 1 desired | 0 available\nEnvironment Variables from:\n  payments-config  ConfigMap  Optional: false\nConditions:\n  Available: False\n  Progressing: True',
          discovered: ['configmap-source'],
          solved,
        }
      }
      if (normalized === 'kubectl get configmap payments-config -n staging -o yaml' || normalized === 'kubectl get cm payments-config -n staging -o yaml') {
        return {
          ok: true,
          output: patched
            ? 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: payments-config\n  namespace: staging\ndata:\n  PAYMENT_QUEUE_HOST: rabbitmq\n  PAYMENT_QUEUE_URL: amqp://rabbitmq:5672'
            : 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: payments-config\n  namespace: staging\ndata:\n  PAYMENT_QUEUE_HOST: rabbitmq\n  PAYMENT_QUEUE_PORT: "5672"',
          discovered: ['poisoned-configmap'],
          solved,
        }
      }
      if (normalized === 'kubectl describe configmap payments-config -n staging') {
        return {
          ok: true,
          output: patched
            ? 'Name: payments-config\nNamespace: staging\nData\n====\nPAYMENT_QUEUE_HOST: rabbitmq\nPAYMENT_QUEUE_URL: amqp://rabbitmq:5672'
            : 'Name: payments-config\nNamespace: staging\nData\n====\nPAYMENT_QUEUE_HOST: rabbitmq\nPAYMENT_QUEUE_PORT: 5672',
          discovered: ['poisoned-configmap'],
          solved,
        }
      }
      if (/^kubectl patch (configmap|cm) payments-config -n staging -p /.test(normalized) && normalized.includes('payment_queue_url') && normalized.includes('amqp://rabbitmq:5672')) {
        patched = true
        return {
          ok: true,
          output: 'configmap/payments-config patched\nchange pending: restart the Deployment to reload environment variables',
          discovered: ['configmap-repaired'],
          solved,
        }
      }
      if (normalized === 'kubectl rollout restart deployment payments-worker -n staging' || normalized === 'kubectl rollout restart deploy payments-worker -n staging') {
        if (!patched) {
          return {
            ok: false,
            output: 'deployment.apps/payments-worker restarted, but the configuration is still invalid',
            discovered: ['premature-restart'],
            solved,
          }
        }
        solved = true
        return {
          ok: true,
          output: 'deployment.apps/payments-worker restarted\nrollout complete: 1 new replica is available',
          discovered: ['worker-restored', 'case-solved'],
          solved,
        }
      }
      return unknownCommand(command, solved)
    },
    saveFile(filename, content, applyOnSave = false) {
      return workspace.saveFile(filename, content, applyOnSave)
    },
    reset() {
      patched = false
      solved = false
      workspace.reset()
    },
    isSolved() {
      return solved
    },
  }
}

function createLockdownSession(): MysterySession {
  let patched = false
  let solved = false
  const workspace = createVirtualWorkspace({
    getSolved: () => solved,
    edit: command => command === 'kubectl edit networkpolicy allow-api-db -n secure-prod'
      ? {
          filename: 'allow-api-db.edit.yaml',
          content: `apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-api-db\n  namespace: secure-prod\nspec:\n  podSelector:\n    matchLabels:\n      role: ${patched ? 'api' : 'api-v2'}\n  policyTypes:\n    - Egress`,
          applyOnSave: true,
        }
      : undefined,
    apply: (_filename, content) => {
      const manifest = parseManifest(content)
      const valid = manifest?.kind === 'NetworkPolicy'
        && manifestValue(manifest, ['metadata', 'name']) === 'allow-api-db'
        && manifestValue(manifest, ['metadata', 'namespace']) === 'secure-prod'
        && manifestValue(manifest, ['spec', 'podSelector', 'matchLabels', 'role']) === 'api'
      if (!valid) {
        return { ok: false, output: 'error: o manifesto não seleciona role=api em allow-api-db/secure-prod', discovered: ['invalid-manifest'], solved }
      }
      patched = true
      return { ok: true, output: 'networkpolicy.networking.k8s.io/allow-api-db configured\npolicy reconciled; verify connectivity from orders-api', discovered: ['policy-restored'], solved }
    },
  })

  return {
    run(command: string): CommandResult {
      const normalized = normalize(command)
      const workspaceResult = workspace.run(command, normalized)
      if (workspaceResult) return workspaceResult
      if (normalized === 'kubectl get pods -n secure-prod' || normalized === 'kubectl get po -n secure-prod') {
        return {
          ok: true,
          output: 'NAME                              READY   STATUS    RESTARTS   AGE\norders-api-5d7f8f6b9-q7w4e      1/1     Running   0          34m\npostgres-0                        1/1     Running   0          28d',
          discovered: ['healthy-looking-pods'],
          solved,
        }
      }
      if (normalized === 'kubectl logs orders-api-5d7f8f6b9-q7w4e -n secure-prod') {
        return {
          ok: true,
          output: '[orders-api] database health check failed: dial tcp 10.244.7.21:5432: i/o timeout\n[orders-api] requests degraded; retrying in 5s',
          discovered: ['database-timeout'],
          solved,
        }
      }
      if (normalized === 'kubectl get networkpolicy -n secure-prod' || normalized === 'kubectl get networkpolicies -n secure-prod' || normalized === 'kubectl get netpol -n secure-prod') {
        return {
          ok: true,
          output: 'NAME                  POD-SELECTOR    AGE\ndefault-deny-egress   <none>          28d\nallow-dns             <none>          28d\nallow-api-db          role=api-v2     34m',
          discovered: ['network-policies'],
          solved,
        }
      }
      if (normalized === 'kubectl describe networkpolicy allow-api-db -n secure-prod' || normalized === 'kubectl describe netpol allow-api-db -n secure-prod') {
        return {
          ok: true,
          output: 'Name: allow-api-db\nNamespace: secure-prod\nPodSelector: role=api-v2\nPolicy Types: Egress\nEgress:\n  To: role=db\n  Ports: TCP/5432\nAffected Pods: <none>',
          discovered: ['policy-selector-mismatch'],
          solved,
        }
      }
      if (normalized === 'kubectl get pods -n secure-prod --show-labels' || normalized === 'kubectl get po -n secure-prod --show-labels') {
        return {
          ok: true,
          output: 'NAME                              READY   STATUS    LABELS\norders-api-5d7f8f6b9-q7w4e      1/1     Running   app=orders-api,role=api\npostgres-0                        1/1     Running   app=postgres,role=db',
          discovered: ['api-role-label'],
          solved,
        }
      }
      if (/^kubectl patch (networkpolicy|netpol) allow-api-db -n secure-prod -p /.test(normalized) && normalized.includes('"role":"api"')) {
        patched = true
        return {
          ok: true,
          output: 'networkpolicy.networking.k8s.io/allow-api-db patched\npolicy reconciled; verify connectivity from orders-api',
          discovered: ['policy-restored'],
          solved,
        }
      }
      if (normalized === 'kubectl exec orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432') {
        if (patched) solved = true
        return {
          ok: patched,
          output: patched ? 'postgres (10.244.7.21:5432) open\nconnection succeeded' : 'nc: connect to postgres port 5432 (tcp) timed out',
          discovered: patched ? ['connectivity-verified', 'case-solved'] : ['connectivity-blocked'],
          solved,
        }
      }
      return unknownCommand(command, solved)
    },
    saveFile(filename, content, applyOnSave = false) {
      return workspace.saveFile(filename, content, applyOnSave)
    },
    reset() {
      patched = false
      solved = false
      workspace.reset()
    },
    isSolved() {
      return solved
    },
  }
}

function unknownCommand(command: string, solved: boolean): CommandResult {
  return {
    ok: false,
    output: `error: comando não reconhecido no simulador: ${command.trim() || '(vazio)'}`,
    discovered: [],
    solved,
  }
}

export function createMysterySession(caseId = 'namespace-ghost'): MysterySession {
  if (caseId === 'poisoned-configmap') return createPoisonedConfigSession()
  if (caseId === 'midnight-lockdown') return createLockdownSession()
  let solved = false
  const workspace = createVirtualWorkspace({
    getSolved: () => solved,
    edit: command => command === 'kubectl edit svc redis-service -n production'
      ? {
          filename: 'redis-service.edit.yaml',
          content: `apiVersion: v1\nkind: Service\nmetadata:\n  name: redis-service\n  namespace: production\nspec:\n  selector:\n    app: ${solved ? 'redis' : 'redis-cache'}\n  ports:\n    - name: redis\n      port: 6379`,
          applyOnSave: true,
        }
      : undefined,
    apply: (_filename, content) => {
      const manifest = parseManifest(content)
      const valid = manifest?.kind === 'Service'
        && manifestValue(manifest, ['metadata', 'name']) === 'redis-service'
        && manifestValue(manifest, ['metadata', 'namespace']) === 'production'
        && manifestValue(manifest, ['spec', 'selector', 'app']) === 'redis'
      if (!valid) {
        return { ok: false, output: 'error: o manifesto não configura app=redis em redis-service/production', discovered: ['invalid-manifest'], solved }
      }
      solved = true
      return { ok: true, output: 'service/redis-service configured\nendpoints reconciled: 10.244.2.18:6379', discovered: ['service-restored', 'case-solved'], solved }
    },
  })

  return {
    run(command: string): CommandResult {
      const normalized = normalize(command)
      const workspaceResult = workspace.run(command, normalized)
      if (workspaceResult) return workspaceResult
      if (normalized === 'kubectl get namespaces' || normalized === 'kubectl get ns') {
        return {
          ok: true,
          output: 'NAME              STATUS   AGE\ndefault           Active   184d\nkube-system       Active   184d\nmonitoring        Active   92d\nproduction        Active   178d',
          discovered: ['production-namespace'],
          solved,
        }
      }
      if (normalized === 'kubectl describe namespaces production') {
        return {
          ok: true,
          output: 'Name: production\nStatus: Active\nResource Quotas: <none>\nLimit Ranges: <none>',
          discovered: ['production-namespace'],
          solved,
        }
      }
      if (normalized === 'kubectl get pods -n production' || normalized === 'kubectl get po -n production') {
        return { ok: true, output: PODS_OUTPUT, discovered: ['failing-pod'], solved }
      }
      if (normalized === 'kubectl describe pods checkout-api-7d9c8b6f4-x2k9m -n production') {
        return {
          ok: true,
          output: 'Name: checkout-api-7d9c8b6f4-x2k9m\nNamespace: production\nLabels: app=checkout-api\nStatus: Running\nContainers:\n  checkout-api:\n    State: Waiting\n      Reason: CrashLoopBackOff\n    Last State: Terminated\n      Reason: Error\n      Exit Code: 1\n    Restarts: 8\nEvents:\n  Warning BackOff  kubelet  Back-off restarting failed container',
          discovered: ['crashloop-details'],
          solved,
        }
      }
      if (normalized === 'kubectl get svc -n production' || normalized === 'kubectl get services -n production' || normalized === 'kubectl get service -n production') {
        return {
          ok: true,
          output: 'NAME             TYPE        CLUSTER-IP     PORT(S)    AGE\nweb-frontend     ClusterIP   10.96.10.14    80/TCP     178d\ncheckout-api    ClusterIP   10.96.20.31    8080/TCP   178d\nredis-service    ClusterIP   10.96.41.22    6379/TCP   61m',
          discovered: ['redis-service'],
          solved,
        }
      }
      if (normalized === 'kubectl get deployment -n production') {
        return {
          ok: true,
          output: 'NAME            READY   UP-TO-DATE   AVAILABLE   AGE\nweb-frontend    2/2     2            2           178d\ncheckout-api    0/2     2            0           178d\nredis           1/1     1            1           61m',
          discovered: ['checkout-deployment'],
          solved,
        }
      }
      if (normalized === 'kubectl logs checkout-api-7d9c8b6f4-x2k9m -n production') {
        return {
          ok: true,
          output: '[checkout-api] ERROR dial tcp redis-service:6379: connect: connection refused\n[checkout-api] FATAL dependency health check failed; shutting down',
          discovered: ['redis-dependency'],
          solved,
        }
      }
      if (normalized === 'kubectl describe svc redis-service -n production' || normalized === 'kubectl describe service redis-service -n production') {
        return {
          ok: true,
          output: 'Name: redis-service\nNamespace: production\nSelector: app=redis-cache\nType: ClusterIP\nIP: 10.96.41.22\nPort: redis 6379/TCP\nEndpoints: <none>\nEvents: <none>',
          discovered: ['selector-mismatch'],
          solved,
        }
      }
      if (/^kubectl patch (svc|service) redis-service -n production -p /.test(normalized) && normalized.includes('"app":"redis"')) {
        solved = true
        return {
          ok: true,
          output: 'service/redis-service patched\nendpoints reconciled: 10.244.2.18:6379',
          discovered: ['service-restored', 'case-solved'],
          solved,
        }
      }
      if (normalized === 'kubectl get endpoints redis-service -n production' || normalized === 'kubectl get ep redis-service -n production') {
        return {
          ok: true,
          output: solved ? 'NAME            ENDPOINTS         AGE\nredis-service   10.244.2.18:6379  61m' : 'NAME            ENDPOINTS   AGE\nredis-service   <none>      61m',
          discovered: solved ? ['service-restored'] : ['empty-endpoints'],
          solved,
        }
      }
      if (normalized === 'kubectl get pods -n production --show-labels' || normalized === 'kubectl get po -n production --show-labels') {
        return {
          ok: true,
          output: `${PODS_OUTPUT}\n\nLABELS\nweb-frontend: app=web\ncheckout-api: app=checkout-api\nredis: app=redis`,
          discovered: ['redis-label'],
          solved,
        }
      }
      return {
        ok: false,
        output: `error: comando não reconhecido no simulador: ${command.trim() || '(vazio)'}`,
        discovered: [],
        solved,
      }
    },
    saveFile(filename, content, applyOnSave = false) {
      return workspace.saveFile(filename, content, applyOnSave)
    },
    reset() {
      solved = false
      workspace.reset()
    },
    isSolved() {
      return solved
    },
  }
}
