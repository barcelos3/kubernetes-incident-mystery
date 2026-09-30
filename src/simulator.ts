import { parseDocument, stringify } from 'yaml'

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

const ALL_NAMESPACES_PODS_OUTPUT = `NAMESPACE     NAME                                  READY   STATUS             RESTARTS   AGE
kube-system   coredns-7db6d8ff4d-v8r6m              1/1     Running            0          184d
production    web-frontend-64c8d7b5db-p8r2f         1/1     Running            0          43m
production    checkout-api-7d9c8b6f4-x2k9m         0/1     CrashLoopBackOff   8          39m
production    redis-6f88c74d8f-m4tq7                 1/1     Running            0          2h
staging       payments-worker-6b7d8f9c5-j4n2p       0/1     CrashLoopBackOff   11         48m
staging       rabbitmq-0                              1/1     Running            0          9d
secure-prod   orders-api-5d7f8f6b9-q7w4e            1/1     Running            0          34m
secure-prod   postgres-0                              1/1     Running            0          28d`

const KUBECTL_OPERATIONS = new Set([
  'alpha', 'annotate', 'api-resources', 'api-versions', 'apply', 'attach', 'auth', 'autoscale',
  'certificate', 'cluster-info', 'completion', 'config', 'convert', 'cordon', 'cp', 'create',
  'delete', 'debug', 'describe', 'diff', 'drain', 'edit', 'events', 'exec', 'explain', 'expose', 'get',
  'help', 'kustomize', 'label', 'logs', 'options', 'patch', 'plugin', 'port-forward', 'proxy',
  'replace', 'rollout', 'run', 'scale', 'set', 'taint', 'top', 'uncordon', 'version', 'wait',
])

const TARGET_REQUIRED_OPERATIONS = new Set([
  'annotate', 'attach', 'autoscale', 'certificate', 'cordon', 'cp', 'delete', 'describe', 'drain',
  'edit', 'exec', 'expose', 'label', 'logs', 'patch', 'port-forward', 'rollout', 'scale', 'set',
  'taint', 'uncordon', 'wait',
])

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
  let normalized = command
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)-A(?=\s|$)/g, '$1--all-namespaces')
    .toLowerCase()
  if (!normalized) return normalized

  const [head, ...tail] = normalized.split(' ')
  const expanded = KUBECTL_ALIASES[head]
  if (expanded) normalized = [expanded, ...tail].join(' ')

  normalized = normalized
    .replace(/--namespace=([^ ]+)/g, '-n $1')
    .replace(/--namespace /g, '-n ')

  const tokens = normalized.split(' ')
  moveLeadingGlobalFlags(tokens)
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

const GET_FLAGS_WITH_VALUES = new Set([
  '-n', '-o', '-l', '-f', '-k', '-l',
  '--output', '--selector', '--field-selector', '--sort-by', '--filename', '--kustomize',
  '--template', '--subresource', '--chunk-size', '--request-timeout',
])

const GLOBAL_FLAGS_WITH_VALUES = new Set([
  '-n', '-s', '--namespace', '--server', '--as', '--as-group', '--as-uid', '--cluster', '--context',
  '--kubeconfig', '--request-timeout', '--token', '--user', '--username', '--password',
  '--certificate-authority', '--client-certificate', '--client-key', '--tls-server-name',
])

const GLOBAL_BOOLEAN_FLAGS = new Set([
  '--disable-compression', '--insecure-skip-tls-verify', '--match-server-version', '--warnings-as-errors',
])

function moveLeadingGlobalFlags(tokens: string[]): void {
  if (tokens[0] !== 'kubectl') return
  const moved: string[] = []
  while (tokens.length > 1) {
    const token = tokens[1]
    const flag = token.split('=')[0]
    if (!GLOBAL_FLAGS_WITH_VALUES.has(flag) && !GLOBAL_BOOLEAN_FLAGS.has(flag)) break
    moved.push(tokens.splice(1, 1)[0])
    if (GLOBAL_FLAGS_WITH_VALUES.has(flag) && !token.includes('=') && tokens[1]) {
      moved.push(tokens.splice(1, 1)[0])
    }
  }
  tokens.push(...moved)
}

function readFlag(tokens: string[], flag: string): string | undefined {
  const index = tokens.indexOf(flag)
  return index >= 0 ? tokens[index + 1] : undefined
}

function getPositionals(tokens: string[]): string[] {
  const positionals: string[] = []
  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.startsWith('-')) {
      const flag = token.split('=')[0]
      const takesValue = GET_FLAGS_WITH_VALUES.has(flag) || GLOBAL_FLAGS_WITH_VALUES.has(flag)
      if (!token.includes('=') && takesValue) index += 1
      continue
    }
    positionals.push(token)
  }
  return positionals
}

function canonicalResource(resource: string): string {
  const type = resource.split(',')[0].split('/')[0].split('.')[0]
  return RESOURCE_CANONICAL.get(type) ?? type
}

function podsForCase(caseId: string, solved: boolean): string {
  if (caseId === 'poisoned-configmap') {
    return `NAME                                  READY   STATUS             RESTARTS   AGE\npayments-worker-6b7d8f9c5-j4n2p      ${solved ? '1/1' : '0/1'}     ${solved ? 'Running' : 'CrashLoopBackOff'}   ${solved ? '0' : '11'}         48m\nrabbitmq-0                             1/1     Running            0          9d`
  }
  if (caseId === 'midnight-lockdown') {
    return 'NAME                              READY   STATUS    RESTARTS   AGE\norders-api-5d7f8f6b9-q7w4e      1/1     Running   0          34m\npostgres-0                        1/1     Running   0          28d'
  }
  return solved
    ? PODS_OUTPUT.replace('checkout-api-7d9c8b6f4-x2k9m    0/1     CrashLoopBackOff   8', 'checkout-api-7d9c8b6f4-x2k9m    1/1     Running            0')
    : PODS_OUTPUT
}

function allNamespacesPodsForCase(caseId: string, solved: boolean): string {
  if (caseId === 'poisoned-configmap' && solved) {
    return ALL_NAMESPACES_PODS_OUTPUT.replace(
      'staging       payments-worker-6b7d8f9c5-j4n2p       0/1     CrashLoopBackOff   11',
      'staging       payments-worker-6b7d8f9c5-j4n2p       1/1     Running            0',
    )
  }
  if (caseId === 'namespace-ghost' && solved) {
    return ALL_NAMESPACES_PODS_OUTPUT.replace(
      'production    checkout-api-7d9c8b6f4-x2k9m         0/1     CrashLoopBackOff   8',
      'production    checkout-api-7d9c8b6f4-x2k9m         1/1     Running            0',
    )
  }
  return ALL_NAMESPACES_PODS_OUTPUT
}

type SimulatedPod = {
  apiVersion: 'v1'
  kind: 'Pod'
  metadata: { name: string; namespace: string }
  status: { phase: string; ready: string; restarts: number; age: string }
}

function formatPodOutput(table: string, allNamespaces: boolean, namespace: string, outputFormat: string | undefined, single: boolean): string {
  if (!outputFormat || outputFormat === 'wide') return table
  const pods: SimulatedPod[] = table.split('\n').slice(1).map(line => {
    const columns = line.trim().split(/\s+/)
    const offset = allNamespaces ? 1 : 0
    return {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: columns[offset], namespace: allNamespaces ? columns[0] : namespace },
      status: {
        phase: columns[offset + 2],
        ready: columns[offset + 1],
        restarts: Number(columns[offset + 3]),
        age: columns[offset + 4],
      },
    }
  })

  if (outputFormat === 'name') return pods.map(pod => `pod/${pod.metadata.name}`).join('\n')
  const payload = single ? pods[0] : { apiVersion: 'v1', items: pods, kind: 'List', metadata: {} }
  if (outputFormat === 'json') return JSON.stringify(payload, null, 2)
  if (outputFormat === 'yaml' || outputFormat === 'kyaml') return stringify(payload).trimEnd()
  return table
}

function resourcesForCase(resource: string, caseId: string, changed: boolean): Record<string, unknown>[] {
  const metadata = (name: string, namespace?: string) => ({ name, ...(namespace ? { namespace } : {}) })
  if (resource === 'namespaces') {
    return ['default', 'kube-system', 'monitoring', 'production', 'staging', 'secure-prod'].map(name => ({ apiVersion: 'v1', kind: 'Namespace', metadata: metadata(name), status: { phase: 'Active' } }))
  }
  if (resource === 'svc' && caseId === 'namespace-ghost') {
    return [
      { apiVersion: 'v1', kind: 'Service', metadata: metadata('web-frontend', 'production'), spec: { type: 'ClusterIP', clusterIP: '10.96.10.14', ports: [{ port: 80 }] } },
      { apiVersion: 'v1', kind: 'Service', metadata: metadata('checkout-api', 'production'), spec: { type: 'ClusterIP', clusterIP: '10.96.20.31', ports: [{ port: 8080 }] } },
      { apiVersion: 'v1', kind: 'Service', metadata: metadata('redis-service', 'production'), spec: { type: 'ClusterIP', clusterIP: '10.96.41.22', selector: { app: changed ? 'redis' : 'redis-cache' }, ports: [{ port: 6379 }] } },
    ]
  }
  if (resource === 'deployment') {
    if (caseId === 'namespace-ghost') {
      return ['web-frontend', 'checkout-api', 'redis'].map(name => ({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: metadata(name, 'production'), status: { availableReplicas: name === 'checkout-api' && !changed ? 0 : name === 'redis' ? 1 : 2 } }))
    }
    if (caseId === 'poisoned-configmap') return [{ apiVersion: 'apps/v1', kind: 'Deployment', metadata: metadata('payments-worker', 'staging'), status: { availableReplicas: changed ? 1 : 0 } }]
  }
  if (resource === 'configmap' && caseId === 'poisoned-configmap') {
    return [{ apiVersion: 'v1', kind: 'ConfigMap', metadata: metadata('payments-config', 'staging'), data: changed ? { PAYMENT_QUEUE_HOST: 'rabbitmq', PAYMENT_QUEUE_URL: 'amqp://rabbitmq:5672' } : { PAYMENT_QUEUE_HOST: 'rabbitmq', PAYMENT_QUEUE_PORT: '5672' } }]
  }
  if (resource === 'networkpolicy' && caseId === 'midnight-lockdown') {
    return [{ apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy', metadata: metadata('allow-api-db', 'secure-prod'), spec: { podSelector: { matchLabels: { role: changed ? 'api' : 'api-v2' } }, policyTypes: ['Egress'] } }]
  }
  if (resource === 'endpoints' && caseId === 'namespace-ghost') {
    return [{ apiVersion: 'v1', kind: 'Endpoints', metadata: metadata('redis-service', 'production'), subsets: changed ? [{ addresses: [{ ip: '10.244.2.18' }], ports: [{ port: 6379 }] }] : [] }]
  }
  return []
}

function formatResourceOutput(items: Record<string, unknown>[], resource: string, outputFormat: string | undefined, single: boolean): string {
  if (outputFormat === 'name') {
    return items.map(item => `${resource}/${(item.metadata as { name: string }).name}`).join('\n')
  }
  const payload = single ? items[0] : { apiVersion: 'v1', items, kind: 'List', metadata: {} }
  if (outputFormat === 'json') return JSON.stringify(payload, null, 2)
  if (outputFormat === 'yaml' || outputFormat === 'kyaml') return stringify(payload).trimEnd()
  return ['NAME', ...items.map(item => (item.metadata as { name: string }).name)].join('\n')
}

function genericGet(tokens: string[], caseId: string, solved: boolean, changed: boolean): CommandResult {
  if (tokens.includes('--help') || tokens.includes('-h')) {
    return { ok: true, output: 'Display one or many resources.\nUsage: kubectl get TYPE [NAME] [flags]', discovered: [], solved }
  }

  const positionals = getPositionals(tokens)
  const resourceToken = positionals[0]
  if (!resourceToken) {
    return { ok: false, output: 'error: You must specify the type of resource to get.', discovered: [], solved }
  }

  const resourceAndName = resourceToken.split('/')
  const resource = canonicalResource(resourceToken)
  const requestedName = resourceAndName[1] ?? positionals[1]
  if (tokens.includes('-a')) {
    return { ok: false, output: "error: unknown shorthand flag: 'a' in -a", discovered: [], solved }
  }
  const allNamespaces = tokens.includes('--all-namespaces')
  const namespace = readFlag(tokens, '-n')
  const outputFormat = readFlag(tokens, '-o')
    ?? readFlag(tokens, '--output')
    ?? tokens.find(token => token.startsWith('-o='))?.split('=')[1]
    ?? tokens.find(token => token.startsWith('--output='))?.split('=')[1]
  if (resource === 'pods') {
    const expectedNamespace = caseId === 'poisoned-configmap' ? 'staging' : caseId === 'midnight-lockdown' ? 'secure-prod' : 'production'
    const podOutput = allNamespaces
      ? allNamespacesPodsForCase(caseId, solved)
      : !namespace || namespace === expectedNamespace
        ? podsForCase(caseId, solved)
        : undefined

    if (podOutput && requestedName) {
      const lines = podOutput.split('\n')
      const nameColumn = allNamespaces ? 1 : 0
      const matchingLine = lines.slice(1).find(line => line.trim().split(/\s+/)[nameColumn] === requestedName)
      if (matchingLine) {
        const table = `${lines[0]}\n${matchingLine}`
        return { ok: true, output: formatPodOutput(table, allNamespaces, namespace ?? expectedNamespace, outputFormat, true), discovered: [], solved }
      }
      return { ok: false, output: `Error from server (NotFound): pods "${requestedName}" not found`, discovered: [], solved }
    }
    if (podOutput) {
      return { ok: true, output: formatPodOutput(podOutput, allNamespaces, namespace ?? expectedNamespace, outputFormat, false), discovered: [], solved }
    }
  }

  let resources = resourcesForCase(resource, caseId, changed)
  if (!allNamespaces && namespace) {
    resources = resources.filter(item => {
      const itemNamespace = (item.metadata as { namespace?: string }).namespace
      return !itemNamespace || itemNamespace === namespace
    })
  }
  if (requestedName) {
    const matched = resources.filter(item => (item.metadata as { name: string }).name === requestedName)
    if (matched.length > 0) {
      return { ok: true, output: formatResourceOutput(matched, resource, outputFormat, true), discovered: [], solved }
    }
    return { ok: false, output: `Error from server (NotFound): ${resource} "${requestedName}" not found`, discovered: [], solved }
  }
  if (resources.length > 0) {
    return { ok: true, output: formatResourceOutput(resources, resource, outputFormat, false), discovered: [], solved }
  }

  const scope = allNamespaces
    ? 'in all namespaces.'
    : namespace
      ? `in ${namespace} namespace.`
      : 'in the current namespace.'
  if (outputFormat === 'json') {
    return { ok: true, output: '{\n  "apiVersion": "v1",\n  "items": [],\n  "kind": "List",\n  "metadata": {}\n}', discovered: [], solved }
  }
  if (outputFormat === 'yaml' || outputFormat === 'kyaml') {
    return { ok: true, output: 'apiVersion: v1\nitems: []\nkind: List\nmetadata: {}', discovered: [], solved }
  }
  return { ok: true, output: `No resources found ${scope}`, discovered: [], solved }
}

function genericKubectlCommand(command: string, caseId: string, solved: boolean, changed = solved): CommandResult {
  const tokens = command.split(' ')
  if (tokens[0] !== 'kubectl') return unknownCommand(command, solved)
  const operation = tokens[1]

  if (!operation || operation === '--help' || operation === '-h' || operation === 'help') {
    return {
      ok: true,
      output: 'kubectl controls the Kubernetes cluster manager.\nUsage: kubectl [command] [TYPE] [NAME] [flags]\nEste terminal usa um cluster totalmente simulado.',
      discovered: [],
      solved,
    }
  }
  if (operation === 'get') return genericGet(tokens, caseId, solved, changed)
  if (!KUBECTL_OPERATIONS.has(operation)) {
    return { ok: false, output: `error: unknown command "${operation}" for "kubectl"`, discovered: [], solved }
  }

  if (operation === 'api-resources') {
    return {
      ok: true,
      output: 'NAME                 SHORTNAMES   APIVERSION             NAMESPACED   KIND\npods                 po           v1                     true         Pod\nservices             svc          v1                     true         Service\nconfigmaps           cm           v1                     true         ConfigMap\ndeployments          deploy       apps/v1                true         Deployment\nnetworkpolicies      netpol       networking.k8s.io/v1   true         NetworkPolicy\nnamespaces           ns           v1                     false        Namespace',
      discovered: [],
      solved,
    }
  }
  if (operation === 'api-versions') return { ok: true, output: 'v1\napps/v1\nbatch/v1\nnetworking.k8s.io/v1\nrbac.authorization.k8s.io/v1', discovered: [], solved }
  if (operation === 'version') return { ok: true, output: 'Client Version: v1.34.0-simulated\nKustomize Version: v5.7.1-simulated', discovered: [], solved }
  if (operation === 'cluster-info') return { ok: true, output: 'Kubernetes control plane is running at https://cluster-city.simulated\nCoreDNS is running at https://cluster-city.simulated/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy', discovered: [], solved }
  if (operation === 'auth' && tokens[2] === 'can-i') return { ok: true, output: 'yes', discovered: [], solved }
  if (operation === 'config') {
    const subcommand = tokens[2]
    const output = subcommand === 'current-context'
      ? 'cluster-city'
      : subcommand === 'get-contexts'
        ? 'CURRENT   NAME           CLUSTER        AUTHINFO    NAMESPACE\n*         cluster-city   cluster-city   detective   production'
        : 'apiVersion: v1\ncurrent-context: cluster-city\nkind: Config'
    return { ok: true, output, discovered: [], solved }
  }
  if (operation === 'explain') return { ok: true, output: `KIND: ${tokens[2] ?? 'RESOURCE'}\nVERSION: simulated/v1\nDESCRIPTION:\n  Recurso reconhecido pelo terminal Kubernetes simulado.`, discovered: [], solved }
  if (operation === 'options') return { ok: true, output: '-A, --all-namespaces   list across all namespaces\n-n, --namespace string  namespace scope\n-o, --output string     output format', discovered: [], solved }
  if (operation === 'events' || operation === 'top') return { ok: true, output: 'No resources found in the simulated cluster.', discovered: [], solved }
  if (operation === 'completion') return { ok: true, output: `# completion ${tokens[2] ?? 'shell'} generated by the simulated kubectl`, discovered: [], solved }
  if (TARGET_REQUIRED_OPERATIONS.has(operation)) {
    return { ok: false, output: 'Error from server (NotFound): the requested object was not found in the simulated cluster', discovered: [], solved }
  }

  return {
    ok: true,
    output: `kubectl ${operation}: comando aceito pelo cluster simulado; nenhum objeto compatível está disponível e nenhuma alteração foi realizada.`,
    discovered: [],
    solved,
  }
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
      return genericKubectlCommand(normalized, 'poisoned-configmap', solved, patched)
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
      return genericKubectlCommand(normalized, 'midnight-lockdown', solved, patched)
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
        return { ok: true, output: podsForCase('namespace-ghost', solved), discovered: ['failing-pod'], solved }
      }
      if (normalized === 'kubectl describe pods checkout-api-7d9c8b6f4-x2k9m -n production') {
        return {
          ok: true,
          output: solved
            ? 'Name: checkout-api-7d9c8b6f4-x2k9m\nNamespace: production\nLabels: app=checkout-api\nStatus: Running\nContainers:\n  checkout-api:\n    State: Running\n    Ready: True\n    Restarts: 0\nEvents:\n  Normal Ready kubelet Container became ready'
            : 'Name: checkout-api-7d9c8b6f4-x2k9m\nNamespace: production\nLabels: app=checkout-api\nStatus: Running\nContainers:\n  checkout-api:\n    State: Waiting\n      Reason: CrashLoopBackOff\n    Last State: Terminated\n      Reason: Error\n      Exit Code: 1\n    Restarts: 8\nEvents:\n  Warning BackOff  kubelet  Back-off restarting failed container',
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
          output: solved
            ? 'NAME            READY   UP-TO-DATE   AVAILABLE   AGE\nweb-frontend    2/2     2            2           178d\ncheckout-api    2/2     2            2           178d\nredis           1/1     1            1           61m'
            : 'NAME            READY   UP-TO-DATE   AVAILABLE   AGE\nweb-frontend    2/2     2            2           178d\ncheckout-api    0/2     2            0           178d\nredis           1/1     1            1           61m',
          discovered: ['checkout-deployment'],
          solved,
        }
      }
      if (normalized === 'kubectl logs checkout-api-7d9c8b6f4-x2k9m -n production') {
        return {
          ok: true,
          output: solved
            ? '[checkout-api] INFO connected to redis-service:6379\n[checkout-api] INFO dependency health check passed'
            : '[checkout-api] ERROR dial tcp redis-service:6379: connect: connection refused\n[checkout-api] FATAL dependency health check failed; shutting down',
          discovered: ['redis-dependency'],
          solved,
        }
      }
      if (normalized === 'kubectl describe svc redis-service -n production' || normalized === 'kubectl describe service redis-service -n production') {
        return {
          ok: true,
          output: solved
            ? 'Name: redis-service\nNamespace: production\nSelector: app=redis\nType: ClusterIP\nIP: 10.96.41.22\nPort: redis 6379/TCP\nEndpoints: 10.244.2.18:6379\nEvents: <none>'
            : 'Name: redis-service\nNamespace: production\nSelector: app=redis-cache\nType: ClusterIP\nIP: 10.96.41.22\nPort: redis 6379/TCP\nEndpoints: <none>\nEvents: <none>',
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
          output: `${podsForCase('namespace-ghost', solved)}\n\nLABELS\nweb-frontend: app=web\ncheckout-api: app=checkout-api\nredis: app=redis`,
          discovered: ['redis-label'],
          solved,
        }
      }
      return genericKubectlCommand(normalized, 'namespace-ghost', solved)
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
