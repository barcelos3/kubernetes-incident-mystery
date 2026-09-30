import { describe, expect, it } from 'vitest'
import { createMysterySession, listMysteryCases } from '../src/simulator'

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
