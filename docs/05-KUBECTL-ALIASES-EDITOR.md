# Abreviações, aliases e editor `vi`

## Visão geral

O terminal do **Kubernetes Incident Mystery** aceita, por padrão:

- formas singular, plural e abreviada dos recursos utilizados nos casos;
- aliases comuns de `kubectl` inspirados no plugin Kubernetes do Oh My Zsh;
- criação de arquivos locais simulados com `vi` ou `vim`;
- leitura e listagem dos arquivos com `cat` e `ls`;
- aplicação de manifestos com `kubectl apply -f`, `--filename` ou `kaf`;
- edição direta de objetos simulados com `kubectl edit`.

Tudo permanece no navegador. Nenhum arquivo real, cluster ou kubeconfig é acessado.

## Formas aceitas para os recursos dos casos

A documentação oficial do Kubernetes define que `TYPE` pode ser informado no singular, plural ou pela abreviação publicada por `kubectl api-resources`.

| Recurso | Singular | Plural | Abreviação oficial |
|---|---|---|---|
| Namespace | `namespace` | `namespaces` | `ns` |
| Pod | `pod` | `pods` | `po` |
| Service | `service` | `services` | `svc` |
| Endpoints | `endpoint` | `endpoints` | `ep` |
| Deployment | `deployment` | `deployments` | `deploy` |
| ConfigMap | `configmap` | `configmaps` | `cm` |
| NetworkPolicy | `networkpolicy` | `networkpolicies` | `netpol` |

Exemplos equivalentes:

```bash
kubectl get pod -n production
kubectl get pods -n production
kubectl get po -n production
```

Use `resources` no terminal do jogo para consultar a lista disponível.

## Comandos e recursos não disponíveis no caso

O terminal reconhece todas as operações oficiais de nível superior do `kubectl`, mesmo quando o recurso não possui objetos no cenário. Consultas retornam listas vazias em vez de um erro interno do simulador.

```bash
k get po -A
kubectl get po --all-namespaces
kubectl get daemonsets -A
kubectl get secrets -n production
kubectl api-resources
kubectl api-versions
kubectl explain statefulset.spec
kubectl auth can-i get pods
```

Para `get`, também são aceitas flags antes ou depois do tipo, como `kubectl get -A statefulsets -o wide`. Operações sem implementação específica retornam uma mensagem segura e não modificam o estado do caso.

## Aliases habilitados por padrão

Use `aliases` ou `alias` no terminal para consultar o catálogo completo.

| Alias | Expansão |
|---|---|
| `k` | `kubectl` |
| `kg` | `kubectl get` |
| `kd` | `kubectl describe` |
| `kaf` | `kubectl apply -f` |
| `kgp` | `kubectl get pods` |
| `kgpn` | `kubectl get pods -n` |
| `kgpsl` | `kubectl get pods --show-labels` |
| `kdp` | `kubectl describe pods` |
| `kgs` | `kubectl get services` |
| `kds` | `kubectl describe services` |
| `kgns` | `kubectl get namespaces` |
| `kdns` | `kubectl describe namespaces` |
| `kgd` | `kubectl get deployments` |
| `kdd` | `kubectl describe deployments` |
| `kgcm` | `kubectl get configmaps` |
| `kdcm` | `kubectl describe configmaps` |
| `kgep` | `kubectl get endpoints` |
| `kgnetpol` | `kubectl get networkpolicies` |
| `kdnetpol` | `kubectl describe networkpolicies` |
| `kl` | `kubectl logs` |
| `kex` | `kubectl exec` |
| `keti` | `kubectl exec -t -i` |
| `krrd` | `kubectl rollout restart deployment` |

Exemplos:

```bash
kgns
kgp -n production
kdp checkout-api-7d9c8b6f4-x2k9m -n production
kl checkout-api-7d9c8b6f4-x2k9m -n production
krrd payments-worker -n staging
```

## Criar um manifesto com `vi` ou `vim`

Abra um arquivo no editor simulado:

```bash
vi redis-fix.yaml
```

No editor:

1. escreva ou cole o YAML;
2. use **`:wq salvar`** ou `Ctrl+S` para gravar;
3. use **`:q! cancelar`** ou `Esc` para sair sem salvar.

Exemplo de manifesto para o primeiro caso:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: production
spec:
  selector:
    app: redis
```

Confira e aplique:

```bash
ls
cat redis-fix.yaml
kubectl apply -f redis-fix.yaml
# ou
kaf redis-fix.yaml
```

Os arquivos existem somente no workspace em memória do caso e são removidos ao reiniciar a investigação ou recarregar a página.

## Editar um objeto simulado

`kubectl edit` abre o YAML atual do objeto no mesmo editor. Ao usar **`:wq salvar`**, o conteúdo é validado e aplicado automaticamente.

```bash
kubectl edit svc redis-service -n production
k edit cm payments-config -n staging
kubectl edit netpol allow-api-db -n secure-prod
```

A validação exige que o manifesto preserve o `kind`, o nome e o namespace esperados pelo caso, além da correção investigada. Um manifesto incompleto permanece no editor e produz uma mensagem de erro.

## Escopo e segurança

- O editor e o sistema de arquivos são virtuais e mantidos apenas em memória.
- Apenas nomes locais terminados em `.yaml`, `.yml` ou `.txt` são aceitos.
- Caminhos absolutos e travessia de diretórios não são permitidos.
- `kubectl apply` interpreta somente os manifestos previstos pelos três casos.
- Nenhum comando do sistema operacional é executado.

## Referências

- [Kubernetes — Command line tool (kubectl)](https://kubernetes.io/docs/reference/kubectl/)
- [Kubernetes — kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)
- [Kubernetes — kubectl command reference](https://kubernetes.io/docs/reference/kubectl/generated/)
- [Página indicada: referência gerada legada](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#-em-deployment-em-) — atualmente marcada como descontinuada pelo próprio Kubernetes.
- [Oh My Zsh — plugin kubectl](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/kubectl) — referência comunitária para aliases amplamente utilizados.
