# Arquitetura Técnica

## Visão geral

O projeto é uma aplicação web estática. Após o build, todo o conteúdo necessário fica em `dist/` e pode ser publicado por qualquer servidor HTTP, CDN ou plataforma de static hosting.

```text
Código TypeScript + HTML + CSS
          │
          ├── npm test ──> Vitest
          ├── npm run build ──> Vite ──> dist/
          └── npm run verify ──> Playwright + Chrome
                                      │
                                      ▼
Navegador ──HTTPS──> CDN / Nginx / Static Host
   │
   ├── interface investigativa
   ├── simulador de comandos kubectl
   ├── motor de casos e níveis
   └── localStorage de progresso
```

## Componentes

### `src/simulator.ts`

Motor determinístico do terminal. Cada sessão mantém somente o estado necessário ao caso:

- correção aplicada;
- reinício executado;
- conectividade validada;
- caso solucionado.

Comandos desconhecidos retornam erro controlado. Não existe chamada ao shell, `kubectl`, API Kubernetes ou rede externa.

### `src/case-content.ts`

Catálogo de conteúdo dos casos:

- título, nível, dificuldade e XP;
- narrativa e arquivo do incidente;
- comandos rápidos;
- tutorial e explicações;
- rótulos das evidências;
- mensagem de conclusão.

### `src/main.ts`

Controlador da interface:

- alternância de caso e modo;
- terminal e histórico;
- evolução do tutorial;
- quadro de evidências;
- persistência local de casos concluídos;
- diálogo de sucesso.

### `index.html` e `src/style.css`

Interface sem framework, acessível e responsiva. Não há renderização no servidor.

## Fluxo de dados

1. O usuário escolhe um caso.
2. A interface cria uma sessão isolada para o ID do caso.
3. O comando é normalizado e avaliado pelo simulador.
4. O resultado retorna saída, evidências e estado de solução.
5. A interface atualiza terminal, tutorial e quadro de evidências.
6. Ao concluir, o ID do caso é salvo no `localStorage`.

## Fronteiras de segurança

- Sem backend e sem segredos.
- Sem `eval`, shell ou execução arbitrária.
- Sem acesso ao kubeconfig.
- Conteúdo dinâmico é inserido com `textContent`.
- A imagem de produção usa Nginx não privilegiado.
- O manifesto Kubernetes remove capabilities e bloqueia privilege escalation.

## Disponibilidade

Como a aplicação é estática, o estado do servidor é descartável. Alta disponibilidade pode ser obtida com:

- CDN ou object storage com redundância;
- duas ou mais réplicas do contêiner;
- rolling update;
- readiness/liveness probes;
- PodDisruptionBudget.

## Artefatos

- `Dockerfile`: build multi-stage e servidor Nginx.
- `compose.yaml`: execução local em contêiner.
- `deploy/kubernetes/base.yaml`: Namespace, Deployment, Service e PDB.
- `deploy/kubernetes/ingress.yaml`: exposição HTTP/TLS opcional.
- `deploy/nginx.conf`: cache, fallback e health check.
