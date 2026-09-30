# Kubernetes Incident Mystery

> Documentação completa: [`docs/00-INDEX.md`](docs/00-INDEX.md)  
> Apresentação: [`docs/Kubernetes-Incident-Mystery-Apresentacao.pptx`](docs/Kubernetes-Incident-Mystery-Apresentacao.pptx)  
> Implantação: [`docs/03-DEPLOYMENT.md`](docs/03-DEPLOYMENT.md)
> Aliases e editor `vi`: [`docs/05-KUBECTL-ALIASES-EDITOR.md`](docs/05-KUBECTL-ALIASES-EDITOR.md)

Jogo educacional inspirado no formato investigativo do SQL Murder Mystery. O jogador usa comandos `kubectl` para investigar um incidente fictício, identificar a causa raiz e restaurar a aplicação.

## Modelo 1 — Simulador no navegador

O modelo atual é totalmente seguro e não acessa clusters reais. O terminal interpreta apenas comandos previstos pelo caso.

### Casos disponíveis

1. **Nível 1 — O Incidente do Namespace Fantasma**
   - `CrashLoopBackOff`, Services, selectors, labels e endpoints.
2. **Nível 2 — O ConfigMap Envenenado**
   - ConfigMaps, variáveis de ambiente, patch e rollout restart.
3. **Nível 3 — O Bloqueio da Meia-Noite**
   - NetworkPolicies, default-deny e validação de conectividade TCP.

Cada caso possui narrativa, comandos rápidos, evidências próprias, pontuação e tutorial independente. O progresso dos casos concluídos fica salvo no navegador.

O terminal também aceita singular, plural e abreviações oficiais dos recursos usados nos casos, aliases comuns como `k`, `kgp`, `kgns`, `kgs`, `kgd`, `kgcm`, `kl` e `krrd`, além de um workspace virtual com `vi`/`vim`, `cat`, `ls`, `kubectl edit` e `kubectl apply -f`.

### Modos

- **Investigação:** nenhuma orientação passo a passo.
- **Tutorial:** sequência guiada específica para cada caso, com comando sugerido e explicação.

## Executar

```bash
cd ~/kubernetes-incident-mystery
npm install
npm run dev -- --port 4174
```

Acesse: <http://127.0.0.1:4174>

## Validar

Com o servidor ativo na porta 4174:

```bash
npm test
npm run build
npm run verify
```

## Modelo 2 — Cluster Kind

Será a próxima etapa. Usará um cluster Kubernetes efêmero, namespaces isolados e manifests descartáveis para executar comandos `kubectl` reais sem tocar em produção. O projeto incluirá tutorial de instalação, criação do cluster, investigação, restauração e remoção completa do ambiente.
