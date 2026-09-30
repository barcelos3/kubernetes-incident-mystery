# Guia do Usuário

## 1. Objetivo

O **Kubernetes Incident Mystery** é um jogo educacional de troubleshooting. Todos os comandos são executados por um simulador dentro do navegador; nenhum cluster, credencial ou recurso real é acessado.

## 2. Abrir o projeto

No ambiente local atual:

```bash
cd ~/kubernetes-incident-mystery
npm install
npm run dev -- --port 4174
```

Abra <http://127.0.0.1:4174>.

## 3. Escolher um caso

A seção **Níveis de investigação** apresenta três casos:

1. **Iniciante — Namespace Fantasma:** `CrashLoopBackOff`, Services, selectors e endpoints.
2. **Intermediário — ConfigMap Envenenado:** ConfigMaps, variáveis de ambiente e rollout.
3. **Avançado — Bloqueio da Meia-Noite:** NetworkPolicies, egress e validação TCP.

Cada cartão mostra nível, tema, XP e estado de conclusão. O progresso é salvo no `localStorage` do navegador.

## 4. Escolher o modo

- **Modo investigação:** apresenta apenas o incidente. O jogador decide quais comandos executar.
- **Modo tutorial:** apresenta uma sequência guiada, o próximo comando e uma explicação opcional.

A troca de modo não altera o estado atual do caso.

## 5. Usar o terminal

Digite comandos no campo inferior e pressione `Enter`.

Atalhos:

- `help`: lista os comandos aceitos no caso atual.
- `aliases`: mostra os aliases `kubectl` habilitados por padrão.
- `resources`: mostra as formas singular, plural e abreviada aceitas.
- `clear`: limpa a saída visual sem reiniciar o caso.
- `reset`: restaura o caso atual.
- `↑` e `↓`: navegam pelo histórico.
- `Ctrl+L`: limpa a saída.

Os botões abaixo do terminal executam comandos frequentes do caso selecionado.

### Abreviações e aliases

Os recursos dos casos aceitam singular, plural e abreviação oficial, como `pod`/`pods`/`po`, `service`/`services`/`svc` e `deployment`/`deployments`/`deploy`. Aliases comuns como `k`, `kgp`, `kgs`, `kgns`, `kgcm`, `kl`, `kex` e `krrd` ficam habilitados por padrão.

### Editor e arquivos simulados

Use `vi arquivo.yaml` ou `vim arquivo.yaml` para abrir o editor. O botão **`:wq salvar`** grava o conteúdo no workspace virtual; **`:q! cancelar`** fecha sem salvar. Os comandos `ls` e `cat arquivo.yaml` permitem inspecionar os arquivos.

Para aplicar um manifesto:

```bash
kubectl apply -f arquivo.yaml
# ou
kaf arquivo.yaml
```

Para editar diretamente um objeto do caso:

```bash
kubectl edit svc redis-service -n production
```

Consulte [Abreviações, aliases e editor vi](05-KUBECTL-ALIASES-EDITOR.md) para o catálogo e exemplos completos.

## 6. Evidências e conclusão

Cada comando relevante adiciona uma pista ao **Quadro de Evidências**. A conclusão exige corrigir a causa raiz; casos avançados também exigem validar o resultado.

Ao concluir:

- a pontuação do caso é exibida;
- o cartão recebe o estado **CONCLUÍDO**;
- o progresso permanece salvo no navegador.

## 7. Reiniciar o progresso

O botão **Reiniciar investigação** limpa apenas o caso ativo. Para apagar todos os estados de conclusão, remova a chave `k8s-mystery-completed` no armazenamento local do navegador.

Pelo console do navegador:

```javascript
localStorage.removeItem('k8s-mystery-completed')
location.reload()
```

## 8. Limitações intencionais

- O terminal aceita apenas comandos previstos no cenário.
- A saída imita `kubectl`, mas não executa binários.
- Não há login, servidor de aplicação ou banco de dados.
- O progresso é local ao navegador e não sincroniza entre dispositivos.
