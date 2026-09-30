# Roadmap e Melhorias Futuras

## Princípios

- manter o Modelo 1 seguro e executável sem cluster;
- transformar conteúdo de casos em dados versionados;
- separar claramente simulação e execução real;
- não coletar telemetria ou comandos sem consentimento;
- validar conceitos contra a documentação oficial do Kubernetes.

## Curto prazo — qualidade e conteúdo

### Editor declarativo de casos

Mover comandos, estados e respostas para um schema JSON/YAML validado. Isso permitirá criar novos casos sem alterar o motor TypeScript.

### Mais cenários

- Pod `Pending` por resources/taints;
- probes mal configuradas;
- Secret ausente ou chave incorreta;
- RBAC com `Forbidden`;
- imagens com `ImagePullBackOff`;
- HPA sem métricas;
- PVC em estado `Pending`;
- DNS/CoreDNS;
- Ingress/Gateway com rota incorreta;
- rollout canário e rollback.

### Sistema de avaliação

- pontuação por quantidade de comandos;
- penalidade por tentativas destrutivas;
- tempo de resolução;
- badges por tema;
- histórico por caso e melhor pontuação.

## Médio prazo — plataforma educacional

### Modelo 2 com Kind

- criação automatizada de cluster efêmero;
- manifests que introduzem falhas reais;
- kubeconfig limitado ao laboratório;
- reset idempotente do cenário;
- validação automática da solução;
- tutorial de instalação e remoção;
- isolamento por namespace e políticas de segurança.

### Progressão e trilhas

- trilha iniciante, SRE, segurança e plataforma;
- pré-requisitos entre casos;
- explicações de causa raiz após conclusão;
- modo desafio sem dicas;
- modo instrutor com respostas e métricas.

### PWA e offline

- instalação como aplicativo;
- cache dos casos;
- uso offline;
- exportação/importação do progresso.

### Acessibilidade e localização

- português e inglês;
- contraste alternativo;
- navegação completa por teclado;
- suporte melhorado a leitores de tela;
- opção de reduzir densidade visual.

## Longo prazo — produto multiusuário

### Backend opcional

- contas e sincronização de progresso;
- turmas e organizações;
- leaderboard privado;
- criação e publicação de casos;
- versionamento e revisão de conteúdo;
- API para catálogos externos.

### Integração educacional

- SCORM/xAPI ou LTI;
- emissão de certificados;
- relatórios para instrutores;
- laboratórios associados a cursos;
- integração com LMS.

### Sandboxes remotos

- clusters descartáveis por sessão;
- limites de CPU, memória e tempo;
- políticas de admissão;
- rede isolada;
- destruição automática;
- trilha de auditoria.

## Prioridade recomendada

1. Schema declarativo de casos.
2. Modelo 2 com Kind local.
3. Mais cinco cenários simulados.
4. Pontuação e histórico.
5. PWA/offline.
6. Backend opcional e turmas.
7. Sandboxes remotos.

## Riscos

- **Custo:** clusters remotos por aluno exigem quotas e expiração.
- **Segurança:** nunca reutilizar kubeconfig de produção.
- **Manutenção:** saídas simuladas devem acompanhar mudanças do Kubernetes.
- **Conteúdo:** casos precisam ensinar investigação, não apenas memorização de comandos.
- **Privacidade:** progresso e telemetria devem ter consentimento e retenção explícitos.
