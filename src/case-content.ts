export type TutorialStep = {
  title: string
  copy: string
  command: string
  explanation: string
  discovery: string
}

export type CaseContent = {
  id: 'namespace-ghost' | 'poisoned-configmap' | 'midnight-lockdown'
  number: string
  level: 'Iniciante' | 'Intermediário' | 'Avançado'
  difficulty: 1 | 2 | 3
  xp: number
  severity: string
  titleMain: string
  titleEmphasis: string
  summary: string
  fileTitle: string
  cluster: string
  namespace: string
  start: string
  impact: string
  testimony: string
  witness: string
  objective: string
  placeholder: string
  quickCommands: string[]
  helpCommands: string[]
  tutorialSteps: TutorialStep[]
  evidenceLabels: Record<string, string>
  successTitle: string
  successText: string
}

export const cases: CaseContent[] = [
  {
    id: 'namespace-ghost',
    number: 'CASE #404',
    level: 'Iniciante',
    difficulty: 1,
    xp: 1000,
    severity: 'SEV-1',
    titleMain: 'O INCIDENTE DO',
    titleEmphasis: 'NAMESPACE FANTASMA',
    summary: 'Às 02:13, o checkout da Cluster City parou. Um Pod reinicia sem parar, um serviço perdeu seus endpoints e alguém alterou uma configuração crítica. Sua missão: investigar com kubectl, encontrar a causa raiz e restaurar a produção.',
    fileTitle: 'Checkout indisponível',
    cluster: 'cluster-city',
    namespace: 'production',
    start: '02:13 UTC',
    impact: '100% das compras',
    testimony: '“A aplicação estava saudável. Depois da última mudança, o checkout começou a reiniciar.”',
    witness: '— Plantonista SRE',
    objective: 'Descubra por que o checkout-api não alcança sua dependência e aplique a correção.',
    placeholder: 'kubectl get pods -n production',
    quickCommands: ['kubectl get pods -n production', 'kubectl get svc -n production', 'kubectl get endpoints redis-service -n production'],
    helpCommands: [
      'kubectl get namespaces',
      'kubectl get pods -n production',
      'kubectl describe pod checkout-api-7d9c8b6f4-x2k9m -n production',
      'kubectl logs checkout-api-7d9c8b6f4-x2k9m -n production',
      'kubectl get svc -n production',
      'kubectl describe svc redis-service -n production',
      'kubectl get pods -n production --show-labels',
      'kubectl get endpoints redis-service -n production',
      `kubectl patch svc redis-service -n production -p '{"spec":{"selector":{"app":"redis"}}}'`,
    ],
    tutorialSteps: [
      { title: 'Encontre o namespace', copy: 'Liste os namespaces disponíveis para confirmar onde o incidente aconteceu.', command: 'kubectl get namespaces', explanation: 'Namespaces separam recursos dentro do cluster. Confirme o contexto antes de agir.', discovery: 'production-namespace' },
      { title: 'Localize o workload quebrado', copy: 'Liste os Pods do namespace production e procure estados anormais.', command: 'kubectl get pods -n production', explanation: 'CrashLoopBackOff indica que o contêiner inicia, falha e é reiniciado repetidamente.', discovery: 'failing-pod' },
      { title: 'Inspecione o Pod', copy: 'Veja detalhes, estado anterior e eventos do Pod.', command: 'kubectl describe pod checkout-api-7d9c8b6f4-x2k9m -n production', explanation: 'O describe confirma código de saída e back-off, mas a causa da aplicação costuma estar nos logs.', discovery: 'crashloop-details' },
      { title: 'Leia os logs', copy: 'Pergunte à aplicação o que aconteceu antes de encerrar.', command: 'kubectl logs checkout-api-7d9c8b6f4-x2k9m -n production', explanation: 'Os logs mostram que checkout-api não alcança redis-service:6379.', discovery: 'redis-dependency' },
      { title: 'Mapeie os Services', copy: 'Confirme se redis-service existe no namespace.', command: 'kubectl get svc -n production', explanation: 'Um ClusterIP existente ainda pode estar sem Pods de destino.', discovery: 'redis-service' },
      { title: 'Inspecione o Service', copy: 'Observe o selector e os endpoints.', command: 'kubectl describe svc redis-service -n production', explanation: 'O selector procura app=redis-cache e não encontra endpoints.', discovery: 'selector-mismatch' },
      { title: 'Compare os labels', copy: 'Liste os Pods com seus labels.', command: 'kubectl get pods -n production --show-labels', explanation: 'O Pod Redis usa app=redis. A divergência é a causa raiz.', discovery: 'redis-label' },
      { title: 'Confirme endpoints vazios', copy: 'Valide a ausência de destinos antes da correção.', command: 'kubectl get endpoints redis-service -n production', explanation: 'Endpoints <none> confirma a quebra de roteamento.', discovery: 'empty-endpoints' },
      { title: 'Restaure o selector', copy: 'Faça o Service selecionar app=redis.', command: `kubectl patch svc redis-service -n production -p '{"spec":{"selector":{"app":"redis"}}}'`, explanation: 'O patch reconcilia os endpoints automaticamente.', discovery: 'case-solved' },
    ],
    evidenceLabels: {
      'production-namespace': 'O incidente está no namespace production.',
      'failing-pod': 'checkout-api está em CrashLoopBackOff.',
      'crashloop-details': 'O contêiner encerra com código 1.',
      'redis-dependency': 'Os logs apontam redis-service:6379.',
      'redis-service': 'redis-service existe e expõe TCP 6379.',
      'selector-mismatch': 'O Service procura app=redis-cache e não tem endpoints.',
      'redis-label': 'O Pod Redis usa app=redis.',
      'empty-endpoints': 'A ausência de endpoints confirma a quebra.',
      'service-restored': 'O endpoint do Redis foi reconciliado.',
      'case-solved': 'Causa raiz corrigida: selector restaurado.',
    },
    successTitle: 'Produção restaurada.',
    successText: 'O selector do Service apontava para app=redis-cache, mas o Pod usava app=redis. Você corrigiu a rota e recuperou os endpoints.',
  },
  {
    id: 'poisoned-configmap',
    number: 'CASE #502',
    level: 'Intermediário',
    difficulty: 2,
    xp: 1600,
    severity: 'SEV-2',
    titleMain: 'O CASO DO',
    titleEmphasis: 'CONFIGMAP ENVENENADO',
    summary: 'O processamento de pagamentos em staging parou logo após uma alteração de configuração. O broker está saudável, mas o worker reinicia e não recebe novas mensagens.',
    fileTitle: 'Fila de pagamentos parada',
    cluster: 'cluster-city',
    namespace: 'staging',
    start: '07:42 UTC',
    impact: 'Fila acumulando',
    testimony: '“A mudança parecia simples: apenas dividimos a URL do broker em host e porta.”',
    witness: '— Desenvolvedor de pagamentos',
    objective: 'Encontre a chave ausente no ConfigMap, restaure a URL esperada e reinicie o Deployment.',
    placeholder: 'kubectl get pods -n staging',
    quickCommands: ['kubectl get pods -n staging', 'kubectl describe deployment payments-worker -n staging', 'kubectl get configmap payments-config -n staging -o yaml'],
    helpCommands: [
      'kubectl get pods -n staging',
      'kubectl logs payments-worker-6b7d8f9c5-j4n2p -n staging',
      'kubectl describe deployment payments-worker -n staging',
      'kubectl get configmap payments-config -n staging -o yaml',
      `kubectl patch configmap payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`,
      'kubectl rollout restart deployment payments-worker -n staging',
    ],
    tutorialSteps: [
      { title: 'Encontre o worker', copy: 'Liste os Pods de staging e identifique o componente instável.', command: 'kubectl get pods -n staging', explanation: 'O payments-worker reinicia, enquanto o RabbitMQ permanece saudável.', discovery: 'payments-failing' },
      { title: 'Leia o erro da aplicação', copy: 'Consulte os logs do worker.', command: 'kubectl logs payments-worker-6b7d8f9c5-j4n2p -n staging', explanation: 'A aplicação exige PAYMENT_QUEUE_URL, mas recebeu uma configuração incompleta.', discovery: 'missing-queue-url' },
      { title: 'Descubra a origem', copy: 'Inspecione o Deployment e suas fontes de ambiente.', command: 'kubectl describe deployment payments-worker -n staging', explanation: 'O Deployment carrega todas as variáveis do ConfigMap payments-config.', discovery: 'configmap-source' },
      { title: 'Leia o ConfigMap', copy: 'Visualize as chaves de configuração em YAML.', command: 'kubectl get configmap payments-config -n staging -o yaml', explanation: 'Existem HOST e PORT, mas a aplicação espera uma URL completa.', discovery: 'poisoned-configmap' },
      { title: 'Restaure a chave', copy: 'Adicione PAYMENT_QUEUE_URL ao ConfigMap.', command: `kubectl patch configmap payments-config -n staging -p '{"data":{"PAYMENT_QUEUE_URL":"amqp://rabbitmq:5672"}}'`, explanation: 'Variáveis de ambiente já carregadas não mudam no Pod existente.', discovery: 'configmap-repaired' },
      { title: 'Reinicie o rollout', copy: 'Crie um novo Pod para carregar a configuração corrigida.', command: 'kubectl rollout restart deployment payments-worker -n staging', explanation: 'O novo Pod recebe PAYMENT_QUEUE_URL e o worker volta a consumir a fila.', discovery: 'case-solved' },
    ],
    evidenceLabels: {
      'payments-failing': 'payments-worker está em CrashLoopBackOff.',
      'missing-queue-url': 'A variável PAYMENT_QUEUE_URL está vazia.',
      'configmap-source': 'O Deployment importa payments-config.',
      'poisoned-configmap': 'O ConfigMap contém HOST e PORT, mas não a URL.',
      'configmap-repaired': 'PAYMENT_QUEUE_URL foi restaurada.',
      'worker-restored': 'O Deployment foi reiniciado com a nova configuração.',
      'case-solved': 'Worker saudável e fila de pagamentos retomada.',
    },
    successTitle: 'Fila de pagamentos retomada.',
    successText: 'Você restaurou PAYMENT_QUEUE_URL no ConfigMap e reiniciou o Deployment para carregar a variável corrigida.',
  },
  {
    id: 'midnight-lockdown',
    number: 'CASE #403',
    level: 'Avançado',
    difficulty: 3,
    xp: 2500,
    severity: 'SEV-1',
    titleMain: 'O BLOQUEIO DA',
    titleEmphasis: 'MEIA-NOITE',
    summary: 'Todos os Pods aparecem como Running, mas a API de pedidos não alcança o PostgreSQL. O incidente começou quando a política zero-trust entrou em vigor.',
    fileTitle: 'Pedidos sem banco de dados',
    cluster: 'cluster-city-secure',
    namespace: 'secure-prod',
    start: '00:01 UTC',
    impact: 'Pedidos degradados',
    testimony: '“Nada caiu. Os probes estão verdes, mas toda consulta ao banco expira.”',
    witness: '— Equipe de plataforma',
    objective: 'Audite as NetworkPolicies, corrija o selector da regra de egress e valide a conexão TCP.',
    placeholder: 'kubectl get networkpolicy -n secure-prod',
    quickCommands: ['kubectl get pods -n secure-prod', 'kubectl get networkpolicy -n secure-prod', 'kubectl describe networkpolicy allow-api-db -n secure-prod'],
    helpCommands: [
      'kubectl get pods -n secure-prod',
      'kubectl logs orders-api-5d7f8f6b9-q7w4e -n secure-prod',
      'kubectl get networkpolicy -n secure-prod',
      'kubectl describe networkpolicy allow-api-db -n secure-prod',
      'kubectl get pods -n secure-prod --show-labels',
      `kubectl patch networkpolicy allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`,
      'kubectl exec orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432',
    ],
    tutorialSteps: [
      { title: 'Não confie apenas no status', copy: 'Liste os Pods de secure-prod.', command: 'kubectl get pods -n secure-prod', explanation: 'Running significa processo ativo, não que todas as dependências estejam acessíveis.', discovery: 'healthy-looking-pods' },
      { title: 'Observe o timeout', copy: 'Leia os logs da API de pedidos.', command: 'kubectl logs orders-api-5d7f8f6b9-q7w4e -n secure-prod', explanation: 'i/o timeout sugere bloqueio de rede, diferente de connection refused.', discovery: 'database-timeout' },
      { title: 'Liste as políticas', copy: 'Descubra quais NetworkPolicies controlam o namespace.', command: 'kubectl get networkpolicy -n secure-prod', explanation: 'Com default-deny-egress, apenas tráfego explicitamente permitido pode sair.', discovery: 'network-policies' },
      { title: 'Inspecione a permissão', copy: 'Veja quem a política allow-api-db seleciona.', command: 'kubectl describe networkpolicy allow-api-db -n secure-prod', explanation: 'A regra permite PostgreSQL, mas seleciona role=api-v2 e não afeta nenhum Pod.', discovery: 'policy-selector-mismatch' },
      { title: 'Compare os labels', copy: 'Liste labels dos Pods de secure-prod.', command: 'kubectl get pods -n secure-prod --show-labels', explanation: 'orders-api usa role=api. A política está presa a um label antigo.', discovery: 'api-role-label' },
      { title: 'Corrija a política', copy: 'Atualize o podSelector para role=api.', command: `kubectl patch networkpolicy allow-api-db -n secure-prod -p '{"spec":{"podSelector":{"matchLabels":{"role":"api"}}}}'`, explanation: 'O patch faz a política selecionar a API atual, mas ainda é necessário testar.', discovery: 'policy-restored' },
      { title: 'Valide a conexão', copy: 'Teste TCP da API até o PostgreSQL.', command: 'kubectl exec orders-api-5d7f8f6b9-q7w4e -n secure-prod -- nc -zvw3 postgres 5432', explanation: 'A conexão bem-sucedida comprova que o caminho de rede foi restaurado.', discovery: 'case-solved' },
    ],
    evidenceLabels: {
      'healthy-looking-pods': 'Todos os Pods parecem Running.',
      'database-timeout': 'A API sofre timeout ao acessar PostgreSQL:5432.',
      'network-policies': 'O namespace usa default-deny-egress.',
      'policy-selector-mismatch': 'allow-api-db seleciona role=api-v2 e não afeta Pods.',
      'api-role-label': 'orders-api usa o label role=api.',
      'policy-restored': 'A NetworkPolicy agora seleciona a API atual.',
      'connectivity-blocked': 'O teste TCP confirma o bloqueio antes da correção.',
      'connectivity-verified': 'A conexão com PostgreSQL foi validada.',
      'case-solved': 'Política corrigida e conectividade restaurada.',
    },
    successTitle: 'O bloqueio foi removido.',
    successText: 'Você corrigiu o podSelector da NetworkPolicy e validou o tráfego da API até o PostgreSQL na porta 5432.',
  },
]

export function getCaseContent(id: string): CaseContent {
  return cases.find(item => item.id === id) ?? cases[0]
}
