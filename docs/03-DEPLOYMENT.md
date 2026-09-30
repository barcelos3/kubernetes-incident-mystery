# Guia de Implantação

## 1. Natureza da aplicação

O Kubernetes Incident Mystery é uma aplicação Vite estática. O comando `npm run build` gera a pasta `dist/`; somente essa pasta precisa ser publicada em produção.

> `vite preview` serve para validação local e não deve ser usado como servidor de produção.

## 2. Requisitos

### Para desenvolver ou gerar o build

- Linux, macOS ou Windows.
- Node.js `20.19+` ou `22.12+` — requisito do Vite instalado.
- npm compatível com a versão do Node.
- Aproximadamente 300 MB livres para dependências e build.

### Para hospedar

Uma das opções:

- servidor HTTP estático;
- Docker/Podman;
- Kubernetes;
- object storage + CDN;
- plataforma de static hosting.

O ambiente de produção não precisa de Node.js quando recebe apenas o conteúdo de `dist/`.

## 3. Build e validação

```bash
git clone <URL_DO_REPOSITORIO>
cd kubernetes-incident-mystery
npm ci
npm test
npm run build
```

Resultado esperado:

```text
dist/
├── index.html
└── assets/
    ├── index-<hash>.css
    └── index-<hash>.js
```

Teste local do build:

```bash
npm run preview -- --host 127.0.0.1 --port 4174
```

Validação completa, com o servidor na porta 4174:

```bash
npm run verify
```

## 4. Servidor web tradicional

Copie `dist/` para o document root de Nginx, Apache, Caddy ou IIS.

Exemplo genérico:

```bash
sudo mkdir -p /var/www/kubernetes-mystery
sudo cp -r dist/* /var/www/kubernetes-mystery/
```

Requisitos do servidor:

- servir `index.html` em `/`;
- servir os arquivos de `/assets/` com cache longo;
- não aplicar cache longo ao `index.html`;
- habilitar compressão Brotli ou gzip;
- terminar TLS no proxy, load balancer ou CDN.

A configuração Nginx pronta está em `deploy/nginx.conf`.

## 5. Docker ou Podman

### Build

```bash
docker build -t kubernetes-incident-mystery:1.0.0 .
```

### Execução

```bash
docker run --rm -p 8080:8080 kubernetes-incident-mystery:1.0.0
curl http://127.0.0.1:8080/healthz
```

Ou:

```bash
docker compose up --build -d
```

Acesse <http://127.0.0.1:8080>.

## 6. Kubernetes

### 6.1 Publicar a imagem

```bash
docker build -t ghcr.io/SEU_USUARIO/kubernetes-incident-mystery:1.0.0 .
docker push ghcr.io/SEU_USUARIO/kubernetes-incident-mystery:1.0.0
```

Substitua a imagem placeholder em `deploy/kubernetes/base.yaml` por essa referência imutável.

### 6.2 Aplicar os recursos

```bash
kubectl apply -f deploy/kubernetes/base.yaml
kubectl -n kubernetes-mystery rollout status deployment/kubernetes-incident-mystery
kubectl -n kubernetes-mystery get pods,svc
```

Acesso temporário sem Ingress:

```bash
kubectl -n kubernetes-mystery port-forward service/kubernetes-incident-mystery 8080:80
```

Abra <http://127.0.0.1:8080>.

### 6.3 Exposição externa

O arquivo `deploy/kubernetes/ingress.yaml` é opcional e exige:

- um Ingress Controller instalado;
- DNS apontando para o load balancer;
- Secret TLS `kubernetes-mystery-tls`;
- substituição de `k8s-mystery.example.com` pelo domínio real.

```bash
kubectl apply -f deploy/kubernetes/ingress.yaml
```

O Kubernetes recomenda considerar Gateway API para novos desenhos; Ingress continua amplamente suportado, mas sua API está congelada.

### 6.4 Rollback

```bash
kubectl -n kubernetes-mystery rollout history deployment/kubernetes-incident-mystery
kubectl -n kubernetes-mystery rollout undo deployment/kubernetes-incident-mystery
```

## 7. Static hosting e nuvem

Configuração comum:

- **Build command:** `npm ci && npm run build`
- **Publish/output directory:** `dist`
- **Runtime:** não necessário

Compatível com:

- GitHub Pages;
- GitLab Pages;
- Cloudflare Pages;
- Netlify;
- Vercel;
- Render Static Sites;
- Azure Static Web Apps;
- AWS S3 + CloudFront;
- Google Cloud Storage + Cloud CDN.

### Hospedagem em subdiretório

Se a URL final for `https://dominio/projeto/`, configure `base: '/projeto/'` em `vite.config.ts` antes do build. Para domínio raiz, o padrão `/` é suficiente.

## 8. CI/CD recomendado

Pipeline mínimo:

1. `npm ci`
2. `npm test`
3. `npm run build`
4. `npm audit --audit-level=high`
5. criar e escanear imagem, quando aplicável;
6. publicar `dist/` ou imagem;
7. executar smoke test em `/healthz` e `/`;
8. promover para produção.

Nunca publique `node_modules`, arquivos locais ou screenshots junto ao site.

## 9. Observabilidade

A aplicação não possui backend. Monitore:

- disponibilidade HTTP de `/healthz`;
- disponibilidade e tempo de resposta de `/`;
- taxa de respostas 4xx/5xx no proxy/CDN;
- erros JavaScript por solução de Real User Monitoring, se aprovada;
- tempo de carregamento dos assets.

Telemetria de usuários deve ser opcional, transparente e sem capturar comandos digitados sem consentimento.

## 10. Cache e atualização

- `index.html`: `no-cache` ou TTL curto.
- arquivos com hash em `/assets/`: cache de um ano com `immutable`.
- use tags de imagem imutáveis, por exemplo `1.0.0`, e evite `latest` em produção.

## 11. Checklist de produção

- [ ] testes e build aprovados;
- [ ] domínio e TLS configurados;
- [ ] imagem versionada e escaneada;
- [ ] health checks respondendo;
- [ ] pelo menos duas réplicas no Kubernetes;
- [ ] requests/limits definidos;
- [ ] rollback testado;
- [ ] cache do HTML e assets validado;
- [ ] nenhuma credencial incluída no build;
- [ ] testes desktop e mobile executados.

## Referências

- Vite — Static Deploy: https://vite.dev/guide/static-deploy
- Vite — Production Build: https://vite.dev/guide/build.html
- Kubernetes — Services: https://kubernetes.io/docs/concepts/services-networking/service/
- Kubernetes — Ingress: https://kubernetes.io/docs/concepts/services-networking/ingress/
