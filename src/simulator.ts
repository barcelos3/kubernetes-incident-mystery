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

export type CommandResult = {
  ok: boolean
  output: string
  discovered: string[]
  solved: boolean
}

export type MysterySession = {
  run(command: string): CommandResult
  reset(): void
  isSolved(): boolean
}

const PODS_OUTPUT = `NAME                              READY   STATUS             RESTARTS   AGE
web-frontend-64c8d7b5db-p8r2f    1/1     Running            0          43m
checkout-api-7d9c8b6f4-x2k9m    0/1     CrashLoopBackOff   8          39m
redis-6f88c74d8f-m4tq7            1/1     Running            0          2h`

function normalize(command: string): string {
  return command.trim().replace(/\s+/g, ' ').toLowerCase()
}

function createPoisonedConfigSession(): MysterySession {
  let patched = false
  let solved = false

  return {
    run(command: string): CommandResult {
      const normalized = normalize(command)
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
    reset() {
      patched = false
      solved = false
    },
    isSolved() {
      return solved
    },
  }
}

function createLockdownSession(): MysterySession {
  let patched = false
  let solved = false

  return {
    run(command: string): CommandResult {
      const normalized = normalize(command)
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
    reset() {
      patched = false
      solved = false
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

  return {
    run(command: string): CommandResult {
      const normalized = normalize(command)
      if (normalized === 'kubectl get namespaces' || normalized === 'kubectl get ns') {
        return {
          ok: true,
          output: 'NAME              STATUS   AGE\ndefault           Active   184d\nkube-system       Active   184d\nmonitoring        Active   92d\nproduction        Active   178d',
          discovered: ['production-namespace'],
          solved,
        }
      }
      if (normalized === 'kubectl get pods -n production' || normalized === 'kubectl get po -n production') {
        return { ok: true, output: PODS_OUTPUT, discovered: ['failing-pod'], solved }
      }
      if (normalized === 'kubectl describe pod checkout-api-7d9c8b6f4-x2k9m -n production' || normalized === 'kubectl describe po checkout-api-7d9c8b6f4-x2k9m -n production') {
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
      if (normalized === 'kubectl get deployments -n production' || normalized === 'kubectl get deploy -n production') {
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
    reset() {
      solved = false
    },
    isSolved() {
      return solved
    },
  }
}
