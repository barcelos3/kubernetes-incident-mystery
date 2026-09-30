import { describe, expect, it } from 'vitest'
import { createMysterySession, listKubectlAliases, listMysteryCases } from '../src/simulator'

describe('Kubernetes mystery simulator', () => {
  it('offers beginner, intermediate, and advanced incident cases', () => {
    const cases = listMysteryCases()

    expect(cases.map(item => item.id)).toEqual(['namespace-ghost', 'poisoned-configmap', 'midnight-lockdown'])
    expect(cases.map(item => item.level)).toEqual(['Iniciante', 'Intermediário', 'Avançado'])
    expect(cases.every(item => item.tutorialSteps.length >= 6)).toBe(true)
  })

  it('requires both ConfigMap repair and rollout restart at intermediate level', () => {
    const session = createMysterySession('poisoned-configmap')

    expect(session.run('kubectl get pods -n staging').output).toContain('CrashLoopBackOff')
    expect(session.run('kubectl logs payments-worker-6b7d8f9c5-j4n2p -n staging').output).toContain('PAYMENT_QUEUE_URL')
    expect(session.run('kubectl get configmap payments-config -n staging -o yaml').output).toContain('PAYMENT_QUEUE_HOST')

    const patch = session.run(`kubectl patch configmap payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`)
    expect(patch.ok).toBe(true)
    expect(session.isSolved()).toBe(false)

    const restart = session.run('kubectl rollout restart deployment payments-worker -n staging')
    expect(restart.output).toContain('deployment.apps/payments-worker restarted')
    expect(session.isSolved()).toBe(true)
    expect(restart.solved).toBe(true)
  })

  it('solves the advanced case by repairing a NetworkPolicy selector', () => {
    const session = createMysterySession('midnight-lockdown')

    expect(session.run('kubectl get pods -n secure-prod').output).toContain('Running')
    expect(session.run('kubectl logs orders-api-5d7f8f6b9-q7w4e -n secure-prod').output).toContain('i/o timeout')
    expect(session.run('kubectl get networkpolicy -n secure-prod').output).toContain('allow-api-db')
    expect(session.run('kubectl describe networkpolicy allow-api-db -n secure-prod').output).toContain('role=api-v2')
    expect(session.run('kubectl get pods -n secure-prod --show-labels').output).toContain('role=api')

    const patch = session.run(`kubectl patch networkpolicy allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`)
    expect(patch.output).toContain('networkpolicy.networking.k8s.io/allow-api-db patched')
    expect(session.isSolved()).toBe(false)

    const verification = session.run('kubectl exec orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432')
    expect(verification.output).toContain('connection succeeded')
    expect(session.isSolved()).toBe(true)
    expect(verification.solved).toBe(true)
  })

  it('shows the failing production pod when the player lists pods', () => {
    const session = createMysterySession()

    const result = session.run('kubectl get pods -n production')

    expect(result.ok).toBe(true)
    expect(result.output).toContain('checkout-api-7d9c8b6f4-x2k9m')
    expect(result.output).toContain('CrashLoopBackOff')
    expect(result.discovered).toContain('failing-pod')
  })

  it('reveals the dependency failure in checkout logs', () => {
    const session = createMysterySession()

    const result = session.run('kubectl logs checkout-api-7d9c8b6f4-x2k9m -n production')

    expect(result.ok).toBe(true)
    expect(result.output).toContain('redis-service:6379')
    expect(result.output).toContain('connection refused')
    expect(result.discovered).toContain('redis-dependency')
  })

  it('exposes the mismatched service selector and empty endpoints', () => {
    const session = createMysterySession()

    const service = session.run('kubectl describe svc redis-service -n production')
    const endpoints = session.run('kubectl get endpoints redis-service -n production')
    const labels = session.run('kubectl get pods -n production --show-labels')

    expect(service.output).toContain('Selector: app=redis-cache')
    expect(endpoints.output).toContain('<none>')
    expect(labels.output).toContain('app=redis')
    expect(service.discovered).toContain('selector-mismatch')
  })

  it('solves the incident after the service selector is patched', () => {
    const session = createMysterySession()

    const patch = session.run(`kubectl patch svc redis-service -n production -p '{"spec":{"selector":{"app":"redis"}}}'`)
    const endpoints = session.run('kubectl get endpoints redis-service -n production')

    expect(patch.ok).toBe(true)
    expect(patch.output).toContain('service/redis-service patched')
    expect(session.isSolved()).toBe(true)
    expect(endpoints.output).toContain('10.244.2.18:6379')
    expect(endpoints.solved).toBe(true)
  })

  it('accepts singular, plural, and every official short name used by the cases', () => {
    const beginner = createMysterySession()
    const intermediate = createMysterySession('poisoned-configmap')
    const advanced = createMysterySession('midnight-lockdown')

    for (const resource of ['namespace', 'namespaces', 'ns']) {
      expect(beginner.run(`kubectl get ${resource}`).output).toContain('production')
    }
    for (const resource of ['pod', 'pods', 'po']) {
      expect(beginner.run(`kubectl get ${resource} -n production`).output).toContain('checkout-api')
    }
    for (const resource of ['service', 'services', 'svc']) {
      expect(beginner.run(`kubectl describe ${resource} redis-service -n production`).output).toContain('app=redis-cache')
    }
    for (const resource of ['endpoint', 'endpoints', 'ep']) {
      expect(beginner.run(`kubectl get ${resource} redis-service -n production`).output).toContain('<none>')
    }
    for (const resource of ['deployment', 'deployments', 'deploy']) {
      expect(intermediate.run(`kubectl describe ${resource} payments-worker -n staging`).output).toContain('payments-config')
    }
    for (const resource of ['configmap', 'configmaps', 'cm']) {
      expect(intermediate.run(`kubectl get ${resource} payments-config -n staging -o yaml`).output).toContain('PAYMENT_QUEUE_HOST')
    }
    for (const resource of ['networkpolicy', 'networkpolicies', 'netpol']) {
      expect(advanced.run(`kubectl get ${resource} -n secure-prod`).output).toContain('allow-api-db')
    }
  })

  it('enables common kubectl aliases by default', () => {
    const beginner = createMysterySession()

    expect(beginner.run('kgns').output).toContain('production')
    expect(beginner.run('kgp -n production').output).toContain('CrashLoopBackOff')
    expect(beginner.run('kdp checkout-api-7d9c8b6f4-x2k9m -n production').output).toContain('Exit Code: 1')
    expect(beginner.run('kl checkout-api-7d9c8b6f4-x2k9m -n production').output).toContain('redis-service:6379')
    expect(beginner.run('kgs -n production').output).toContain('redis-service')
    expect(beginner.run('kds redis-service -n production').output).toContain('Endpoints: <none>')
    expect(beginner.run('k get deployments -n production').output).toContain('checkout-api')
  })

  it('supports case repair and validation through common aliases', () => {
    const intermediate = createMysterySession('poisoned-configmap')
    const advanced = createMysterySession('midnight-lockdown')

    expect(intermediate.run('kgcm payments-config -n staging -o yaml').ok).toBe(true)
    expect(intermediate.run(`k patch cm payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`).ok).toBe(true)
    expect(intermediate.run('krrd payments-worker -n staging').solved).toBe(true)

    expect(advanced.run('kgnetpol -n secure-prod').ok).toBe(true)
    expect(advanced.run(`k patch netpol allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`).ok).toBe(true)
    expect(advanced.run('kex orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432').solved).toBe(true)
  })

  it('publishes the aliases available in the simulator', () => {
    const aliases = listKubectlAliases()

    expect(aliases).toMatchObject({
      k: 'kubectl',
      kgp: 'kubectl get pods',
      kgs: 'kubectl get services',
      kgns: 'kubectl get namespaces',
      kgcm: 'kubectl get configmaps',
      kgd: 'kubectl get deployments',
      krrd: 'kubectl rollout restart deployment',
    })
  })

  it('supports describe and interactive exec aliases exposed by the catalog', () => {
    const beginner = createMysterySession()
    const intermediate = createMysterySession('poisoned-configmap')
    const advanced = createMysterySession('midnight-lockdown')

    expect(beginner.run('kdns production').output).toContain('Status: Active')
    expect(intermediate.run('kdcm payments-config -n staging').output).toContain('PAYMENT_QUEUE_PORT')
    advanced.run(`k patch netpol allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`)
    expect(advanced.run('keti orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432').solved).toBe(true)
  })

  it('reopens kubectl edit with the current object state after a repair', () => {
    const beginner = createMysterySession()
    const intermediate = createMysterySession('poisoned-configmap')
    const advanced = createMysterySession('midnight-lockdown')

    beginner.run(`kubectl patch svc redis-service -n production -p '{"spec":{"selector":{"app":"redis"}}}'`)
    intermediate.run(`kubectl patch cm payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`)
    advanced.run(`kubectl patch netpol allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`)

    expect(beginner.run('kubectl edit svc redis-service -n production').editor?.content).toContain('app: redis\n')
    expect(intermediate.run('kubectl edit cm payments-config -n staging').editor?.content).toContain('PAYMENT_QUEUE_URL: amqp://rabbitmq:5672')
    expect(advanced.run('kubectl edit netpol allow-api-db -n secure-prod').editor?.content).toContain('role: api\n')
  })

  it('creates a YAML file with vi and applies it to solve the Service incident', () => {
    const session = createMysterySession()
    const editor = session.run('vi redis-fix.yaml').editor

    expect(editor).toMatchObject({ filename: 'redis-fix.yaml', applyOnSave: false })
    const yaml = `apiVersion: v1\nkind: Service\nmetadata:\n  name: redis-service\n  namespace: production\nspec:\n  selector:\n    app: redis`
    expect(session.saveFile(editor!.filename, yaml, editor!.applyOnSave).output).toContain('gravado')
    expect(session.run('cat redis-fix.yaml').output).toContain('app: redis')
    expect(session.run('kaf redis-fix.yaml').solved).toBe(true)
  })

  it('preserves filename case when applying a file created with vi', () => {
    const session = createMysterySession()
    const editor = session.run('vi Redis-Fix.yaml').editor
    const yaml = `apiVersion: v1\nkind: Service\nmetadata:\n  name: redis-service\n  namespace: production\nspec:\n  selector:\n    app: redis`

    session.saveFile(editor!.filename, yaml, false)

    expect(session.run('kubectl apply -f Redis-Fix.yaml').solved).toBe(true)
  })

  it('rejects manifest requirements mentioned only in comments or unrelated fields', () => {
    const session = createMysterySession()
    const editor = session.run('vi misleading.yaml').editor
    const yaml = `apiVersion: v1\n# kind: Service\ndescription: "kind: Service"\nmetadata-note: "name: redis-service"\n# namespace: production\nspec:\n  note: "app: redis"`

    session.saveFile(editor!.filename, yaml, false)
    const result = session.run('kubectl apply -f misleading.yaml')

    expect(result.ok).toBe(false)
    expect(session.isSolved()).toBe(false)
  })

  it('requires case-sensitive values at the correct YAML paths', () => {
    const session = createMysterySession()
    const editor = session.run('vi malformed.yaml').editor
    const yaml = `apiVersion: v1\nkind: service\nname: redis-service\nnamespace: production\napp: redis\nmetadata: {}\nspec: {}`

    session.saveFile(editor!.filename, yaml, false)
    const result = session.run('kubectl apply -f malformed.yaml')

    expect(result.ok).toBe(false)
    expect(session.isSolved()).toBe(false)
  })

  it('edits a live simulated object with kubectl edit and applies on :wq', () => {
    const session = createMysterySession('poisoned-configmap')
    const edit = session.run('k edit cm payments-config -n staging').editor

    expect(edit?.content).toContain('PAYMENT_QUEUE_PORT')
    expect(edit?.applyOnSave).toBe(true)
    const fixed = edit!.content.replace('  PAYMENT_QUEUE_PORT: "5672"', '  PAYMENT_QUEUE_URL: amqp://rabbitmq:5672')
    const saved = session.saveFile(edit!.filename, fixed, edit!.applyOnSave)

    expect(saved.output).toContain('configmap/payments-config configured')
    expect(session.isSolved()).toBe(false)
    expect(session.run('krrd payments-worker -n staging').solved).toBe(true)
  })

  it('supports vim, ls, and NetworkPolicy manifests in the virtual workspace', () => {
    const session = createMysterySession('midnight-lockdown')
    const editor = session.run('vim allow-api-db.yaml').editor
    const yaml = `apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-api-db\n  namespace: secure-prod\nspec:\n  podSelector:\n    matchLabels:\n      role: api`

    session.saveFile(editor!.filename, yaml, false)
    expect(session.run('ls').output).toContain('allow-api-db.yaml')
    expect(session.run('kubectl apply --filename allow-api-db.yaml').output).toContain('networkpolicy.networking.k8s.io/allow-api-db configured')
    expect(session.run('kex orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432').solved).toBe(true)
  })

  it('accepts kubectl get pods across all namespaces with kubectl or k', () => {
    const session = createMysterySession()
    const kubectl = session.run('kubectl get po -A')
    const alias = session.run('k get po -A')

    for (const result of [kubectl, alias]) {
      expect(result.ok).toBe(true)
      expect(result.output).toContain('NAMESPACE')
      expect(result.output).toContain('production')
      expect(result.output).toContain('staging')
      expect(result.output).toContain('secure-prod')
      expect(result.output).not.toContain('comando não reconhecido')
    }
    expect(alias.output).toBe(kubectl.output)
  })

  it('preserves uppercase -A semantics and rejects lowercase -a', () => {
    const session = createMysterySession()

    expect(session.run('kubectl get po -A').output).toContain('NAMESPACE')
    const lowercase = session.run('kubectl get po -a')
    expect(lowercase.ok).toBe(false)
    expect(lowercase.output).toContain("unknown shorthand flag: 'a'")
  })

  it('keeps all-namespace output synchronized with the active case state', () => {
    const session = createMysterySession('poisoned-configmap')

    session.run(`kubectl patch cm payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`)
    session.run('kubectl rollout restart deploy payments-worker -n staging')

    const output = session.run('kubectl get po -A').output
    const workerLine = output.split('\n').find(line => line.includes('payments-worker'))
    expect(workerLine).toContain('1/1')
    expect(workerLine).toContain('Running')
    expect(workerLine).not.toContain('CrashLoopBackOff')
  })

  it('returns Kubernetes-style NotFound for unavailable object targets', () => {
    const session = createMysterySession()

    for (const command of [
      'kubectl edit secret missing -n production',
      'kubectl describe daemonset missing -n production',
      'kubectl delete job missing -n production',
      `kubectl patch deployment missing -n production -p '{"spec":{}}'`,
    ]) {
      const result = session.run(command)
      expect(result.ok, command).toBe(false)
      expect(result.output, command).toContain('NotFound')
      expect(result.output, command).not.toContain('comando não reconhecido')
    }
  })

  it('honors object names in generic get requests', () => {
    const session = createMysterySession()
    const existing = session.run('kubectl get pod checkout-api-7d9c8b6f4-x2k9m -n production')

    expect(existing.ok).toBe(true)
    expect(existing.output).toContain('checkout-api-7d9c8b6f4-x2k9m')
    expect(existing.output).not.toContain('web-frontend')

    for (const command of [
      'kubectl get pod missing -n production',
      'kubectl get secret missing -n production',
      'kubectl get pod/missing -A',
    ]) {
      const result = session.run(command)
      expect(result.ok, command).toBe(false)
      expect(result.output, command).toContain('NotFound')
    }
  })

  it('supports global kubectl flags placed before or after the operation', () => {
    const session = createMysterySession()
    const commands = [
      'kubectl -n production get po',
      'kubectl --context cluster-city get po',
      'kubectl get po --context cluster-city -n production',
    ]

    for (const command of commands) {
      const result = session.run(command)
      expect(result.ok, command).toBe(true)
      expect(result.output, command).toContain('checkout-api')
      expect(result.output, command).not.toContain('unknown command')
    }
  })

  it('honors JSON output formatting for pod queries', () => {
    const session = createMysterySession()

    for (const command of ['kubectl get pods -A -o json', 'kubectl get pods -A -o=json']) {
      const result = session.run(command)
      const payload = JSON.parse(result.output)
      expect(result.ok, command).toBe(true)
      expect(payload.kind, command).toBe('List')
      expect(payload.items.some((item: { metadata: { namespace: string } }) => item.metadata.namespace === 'production'), command).toBe(true)
    }
  })

  it('returns simulated non-pod resources when output flags use the generic parser', () => {
    const session = createMysterySession()
    const result = session.run('kubectl get svc -n production -o json')
    const payload = JSON.parse(result.output)

    expect(result.ok).toBe(true)
    expect(payload.items.map((item: { metadata: { name: string } }) => item.metadata.name)).toContain('redis-service')
  })

  it('keeps detailed outputs synchronized after the beginner case is solved', () => {
    const session = createMysterySession()
    session.run(`kubectl patch svc redis-service -n production -p '{"spec":{"selector":{"app":"redis"}}}'`)

    expect(session.run('kubectl describe pod checkout-api-7d9c8b6f4-x2k9m -n production').output).toContain('State: Running')
    expect(session.run('kubectl describe svc redis-service -n production').output).toContain('Selector: app=redis')
    expect(session.run('kubectl get deployment -n production').output).toContain('checkout-api    2/2')
  })

  it('accepts get for unavailable Kubernetes resource types', () => {
    const session = createMysterySession()
    const commands = [
      'kubectl get daemonsets -A',
      'k get secrets --all-namespaces',
      'kubectl get widgets.example.io -n production',
      'kubectl get -A statefulsets -o wide',
    ]

    for (const command of commands) {
      const result = session.run(command)
      expect(result.ok).toBe(true)
      expect(result.output).toContain('No resources found')
      expect(result.output).not.toContain('comando não reconhecido')
    }
  })

  it('parses every official kubectl operation without a simulator-specific rejection', () => {
    const session = createMysterySession()
    const commands = [
      'kubectl alpha',
      'kubectl annotate pod missing owner=sre',
      'kubectl api-resources',
      'kubectl api-versions',
      'kubectl apply -f missing.yaml',
      'kubectl attach missing',
      'kubectl auth can-i get pods',
      'kubectl autoscale deployment missing --max=3',
      'kubectl certificate approve missing',
      'kubectl cluster-info',
      'kubectl completion bash',
      'kubectl config current-context',
      'kubectl cordon missing-node',
      'kubectl cp missing:/tmp/a ./a',
      'kubectl create deployment demo --image=nginx',
      'kubectl debug pod/missing --image=busybox',
      'kubectl delete job missing',
      'kubectl describe daemonset missing',
      'kubectl diff -f missing.yaml',
      'kubectl drain missing-node',
      'kubectl edit secret missing',
      'kubectl events',
      'kubectl exec missing -- true',
      'kubectl explain deployment.spec',
      'kubectl expose deployment missing --port=80',
      'kubectl get secrets -A',
      'kubectl kustomize .',
      'kubectl label pod missing app=test',
      'kubectl logs missing',
      'kubectl options',
      `kubectl patch deployment missing -p '{"spec":{}}'`,
      'kubectl plugin list',
      'kubectl port-forward pod/missing 8080:80',
      'kubectl proxy',
      'kubectl replace -f missing.yaml',
      'kubectl rollout status deployment/missing',
      'kubectl run demo --image=nginx',
      'kubectl scale deployment missing --replicas=2',
      'kubectl set image deployment/missing app=nginx',
      'kubectl taint nodes missing dedicated=test:NoSchedule',
      'kubectl top pod',
      'kubectl uncordon missing-node',
      'kubectl version --client',
      'kubectl wait --for=condition=ready pod/missing',
    ]

    for (const command of commands) {
      const result = session.run(command)
      expect(result.output, command).not.toContain('comando não reconhecido no simulador')
      expect(result.output, command).not.toContain('unknown command')
    }
  })

  it('supports the tutorial discovery commands and reset', () => {
    const session = createMysterySession()

    expect(session.run('kubectl get namespaces').output).toContain('production')
    expect(session.run('kubectl describe pod checkout-api-7d9c8b6f4-x2k9m -n production').output).toContain('CrashLoopBackOff')
    expect(session.run('kubectl get svc -n production').output).toContain('redis-service')
    expect(session.run('kubectl get deployments -n production').output).toContain('checkout-api')

    session.run(`kubectl patch svc redis-service -n production -p '{"spec":{"selector":{"app":"redis"}}}'`)
    session.reset()
    expect(session.isSolved()).toBe(false)
    expect(session.run('kubectl get endpoints redis-service -n production').output).toContain('<none>')
  })
})
