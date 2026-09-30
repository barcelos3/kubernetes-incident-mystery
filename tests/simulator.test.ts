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
