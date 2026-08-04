# Kubernetes Test Lab

Projeto didático completo para estudar uma aplicação web Node.js conectada a PostgreSQL dentro de um cluster Kubernetes local. A aplicação permite cadastrar e listar mensagens, exibindo a data e a hora de cada registro.

## Visão geral

O backend usa Node.js LTS, Express e o driver `pg`. O frontend é HTML, CSS e JavaScript puro, servido pelo próprio Express. O banco cria a tabela `messages` automaticamente na inicialização e utiliza queries parametrizadas.

A estrutura foi separada em `src/app.js` e `src/server.js`: `app.js` monta a aplicação e pode ser testado sem abrir uma porta; `server.js` cuida da conexão inicial, do listener HTTP e do encerramento gracioso. Essa separação torna os testes unitários mais rápidos e evita depender de PostgreSQL durante o `npm test`.

```text
Navegador
    │  http://localhost:8080
    ▼
Service web:80
    │
    ├──► Pod web-1:3000 ─┐
    └──► Pod web-2:3000 ─┤  Deployment (2 réplicas)
                         ▼
                   Service postgres:5432
                         │
                         ▼
                 Pod postgres-0
                         │
                         ▼
              PVC postgres-data-postgres-0
```

O navegador conversa apenas com o Service `web`. Os pods da aplicação usam o nome DNS interno `postgres` para chegar ao Service do banco. O StatefulSet mantém a identidade `postgres-0` e associa o volume persistente ao PVC.

## Estrutura

```text
.
├── src/
│   ├── app.js
│   ├── database.js
│   ├── server.js
│   ├── routes/messages.js
│   └── public/
│       ├── index.html
│       ├── style.css
│       └── app.js
├── tests/app.test.js
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgres-service.yaml
│   ├── postgres-statefulset.yaml
│   ├── web-deployment.yaml
│   ├── web-service.yaml
│   └── kustomization.yaml
├── Dockerfile
├── .dockerignore
├── .env.example
├── package.json
├── AGENTS.md
└── README.md
```

## API

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Liveness simples da aplicação; não depende do banco. |
| `GET` | `/ready` | Verifica se o PostgreSQL aceita consultas. |
| `GET` | `/api/messages` | Lista mensagens da mais recente para a mais antiga. |
| `POST` | `/api/messages` | Cria uma mensagem validada. |

Exemplo de corpo do `POST`:

```json
{
  "name": "Alessandro",
  "message": "Meu primeiro projeto Kubernetes"
}
```

A resposta da listagem é `{ "messages": [...] }`; a criação retorna `201` e `{ "message": {...} }`. Nome e mensagem são obrigatórios, sofrem `trim` e têm limites de tamanho. Erros de conexão retornam `503`.

## Pré-requisitos

- Node.js LTS 22 ou superior e npm.
- Docker Desktop em execução.
- `kubectl`.
- Para o fluxo Kind: Kind.
- Para o fluxo Minikube: Minikube.

Os comandos abaixo funcionam no PowerShell; os comandos de `kubectl`, Docker, Kind e Minikube também são equivalentes no Linux/macOS.

## Validação do projeto

Na raiz do projeto:

```bash
npm install
npm run lint
npm test
docker build -t k8s-test-lab-web:local .
kubectl apply --dry-run=client -k k8s/
```

O `npm test` usa mocks para o banco. Assim, os testes cobrem health check, validações, inserção, listagem e erro de conexão sem exigir um PostgreSQL real.

## Executar localmente sem Kubernetes

Suba um PostgreSQL de laboratório em um volume Docker:

```bash
docker volume create k8s-test-lab-postgres-data
docker run -d --name k8s-test-lab-postgres -p 5432:5432 -e POSTGRES_DB=k8slab -e POSTGRES_USER=k8slab -e POSTGRES_PASSWORD=kubernetes-lab-password -v k8s-test-lab-postgres-data:/var/lib/postgresql/data postgres:16-alpine
```

Em outro terminal:

```bash
Copy-Item .env.example .env
npm install
npm run dev
```

Abra <http://localhost:3000>. Para parar o banco local:

```bash
docker rm -f k8s-test-lab-postgres
```

O volume pode ser mantido para repetir o exercício. Ele não é o PVC do Kubernetes.

## Executar no Kind

### 1. Criar o cluster e carregar a imagem

```bash
kind create cluster --name k8s-test-lab
docker build -t k8s-test-lab-web:local .
kind load docker-image k8s-test-lab-web:local --name k8s-test-lab
```

### 2. Aplicar o laboratório

```bash
kubectl apply -k k8s/
kubectl get pods -n k8s-test-lab -w
```

Quando os pods estiverem prontos, confira os recursos:

```bash
kubectl get all -n k8s-test-lab
kubectl get statefulsets -n k8s-test-lab
kubectl get pvc -n k8s-test-lab
kubectl rollout status deployment/web -n k8s-test-lab
```

### 3. Abrir a aplicação

Em um terminal que ficará aberto:

```bash
kubectl port-forward -n k8s-test-lab service/web 8080:80
```

Acesse <http://localhost:8080>.

## Executar no Minikube

### 1. Criar o cluster e construir a imagem dentro dele

```bash
minikube start
minikube image build -t k8s-test-lab-web:local .
kubectl apply -k k8s/
kubectl get pods -n k8s-test-lab -w
```

Se a versão do Minikube não oferecer `minikube image build`, use o Docker daemon do Minikube:

```bash
minikube docker-env --shell powershell | Invoke-Expression
docker build -t k8s-test-lab-web:local .
kubectl apply -k k8s/
```

### 2. Verificar e abrir

```bash
kubectl get all -n k8s-test-lab
kubectl get pvc -n k8s-test-lab
kubectl rollout status deployment/web -n k8s-test-lab
kubectl port-forward -n k8s-test-lab service/web 8080:80
```

Acesse <http://localhost:8080>.

## Roteiro prático de estudo

### Inspecionar recursos e eventos

```bash
kubectl get all -n k8s-test-lab
kubectl get pvc -n k8s-test-lab
kubectl describe pod -n k8s-test-lab <nome-do-pod>
kubectl describe pvc -n k8s-test-lab <nome-do-pvc>
kubectl get events -n k8s-test-lab --sort-by=.lastTimestamp
```

### Consultar logs

```bash
kubectl logs -n k8s-test-lab deployment/web --all-containers=true
kubectl logs -n k8s-test-lab statefulset/postgres
kubectl logs -n k8s-test-lab <nome-do-pod> -c wait-for-postgres
```

### Demonstrar autorrecuperação da aplicação

Em um terminal, descubra um pod web e remova-o:

```bash
kubectl get pods -n k8s-test-lab -l app.kubernetes.io/name=web
kubectl delete pod -n k8s-test-lab <pod-web>
kubectl get pods -n k8s-test-lab -w
kubectl rollout status deployment/web -n k8s-test-lab
```

O Deployment cria outro pod para voltar às duas réplicas desejadas.

### Demonstrar persistência do PostgreSQL

1. Publique uma mensagem pela página e anote o conteúdo.
2. Verifique o volume:

```bash
kubectl get pvc -n k8s-test-lab
kubectl get pods -n k8s-test-lab -l app.kubernetes.io/name=postgres
```

3. Exclua o pod do banco:

```bash
kubectl delete pod -n k8s-test-lab postgres-0
kubectl get pods -n k8s-test-lab -w
```

4. Faça o port-forward novamente, se necessário, e atualize a página. A mensagem deve continuar presente porque o StatefulSet remonta o mesmo PVC.

### Escalar e reduzir a aplicação

```bash
kubectl scale deployment/web -n k8s-test-lab --replicas=3
kubectl get pods -n k8s-test-lab -l app.kubernetes.io/name=web
kubectl scale deployment/web -n k8s-test-lab --replicas=2
```

O banco permanece com uma réplica: este laboratório não implementa replicação ou alta disponibilidade do PostgreSQL.

### Atualizar a imagem e acompanhar o rollout

Use uma tag nova para que a mudança seja observável:

```bash
docker build -t k8s-test-lab-web:v2 .
kind load docker-image k8s-test-lab-web:v2 --name k8s-test-lab
kubectl set image deployment/web -n k8s-test-lab web=k8s-test-lab-web:v2
kubectl rollout status deployment/web -n k8s-test-lab
kubectl rollout history deployment/web -n k8s-test-lab
```

No Minikube, carregue a nova tag com `minikube image build -t k8s-test-lab-web:v2 .` antes do `kubectl set image`.

## Explicação dos recursos Kubernetes

- **Namespace**: isola todos os recursos do laboratório em `k8s-test-lab`.
- **ConfigMaps**: guardam configurações não sensíveis do PostgreSQL e da aplicação, como nome do banco, host e porta.
- **Secret**: fornece a senha do banco aos dois workloads. O arquivo contém uma senha explícita de laboratório e não deve ser tratado como um segredo seguro em produção.
- **Service `postgres`**: oferece DNS estável e acesso interno na porta 5432.
- **StatefulSet `postgres`**: executa uma réplica com identidade estável e cria um PVC por pod.
- **PVC**: solicita 1 GiB de armazenamento persistente para `/var/lib/postgresql/data`.
- **Deployment `web`**: mantém duas réplicas e executa atualizações com `RollingUpdate`.
- **Service `web`**: expõe a aplicação internamente na porta 80 e encaminha para 3000.
- **Probes**: `/health` mede se o processo web está vivo; `/ready` só fica pronto quando o banco responde. O PostgreSQL usa `pg_isready` nas duas probes.
- **initContainer**: espera o DNS/Service do PostgreSQL aceitar conexões antes de iniciar o container web.

### Deployment e StatefulSet neste projeto

O Deployment é adequado para os pods web porque são réplicas intercambiáveis, sem identidade ou disco próprio. O StatefulSet é usado para o PostgreSQL porque mantém uma identidade previsível (`postgres-0`) e vincula o armazenamento ao pod por meio do volumeClaimTemplate.

### ConfigMap e Secret

ConfigMap é indicado para valores que não precisam de confidencialidade. Secret é a abstração Kubernetes para valores sensíveis, mas o conteúdo ainda deve ser protegido no controle de origem, no RBAC e no armazenamento do cluster. A senha deste exercício está em `stringData` apenas para tornar o laboratório reproduzível.

## Troubleshooting

### Pod web preso em `Init:0/1`

```bash
kubectl get pods -n k8s-test-lab
kubectl describe pod -n k8s-test-lab <pod-web>
kubectl logs -n k8s-test-lab <pod-web> -c wait-for-postgres
kubectl get svc,endpoints -n k8s-test-lab postgres
```

Confira se o pod `postgres-0` está `Ready`, se o Service se chama exatamente `postgres` e se o banco tem endpoint.

### `ImagePullBackOff` no pod web

A imagem local precisa existir dentro do ambiente do cluster:

```bash
docker images k8s-test-lab-web
kind load docker-image k8s-test-lab-web:local --name k8s-test-lab
```

No Minikube, prefira `minikube image build` ou o `docker-env` descrito acima. Depois, recrie os pods ou faça um rollout.

### PVC em `Pending`

```bash
kubectl get storageclass
kubectl describe pvc -n k8s-test-lab <nome-do-pvc>
```

O cluster local precisa ter uma StorageClass padrão. Reinicie o Minikube/Kind ou configure uma StorageClass compatível se ela não existir.

### A aplicação retorna `503`

```bash
kubectl get pods -n k8s-test-lab
kubectl logs -n k8s-test-lab deployment/web
kubectl logs -n k8s-test-lab statefulset/postgres
kubectl get configmap,secret -n k8s-test-lab
```

Verifique especialmente `DB_HOST=postgres`, `DB_PORT=5432`, o nome do banco e a senha. Os nomes usados no ConfigMap correspondem ao Service e às chaves dos manifests.

## Remover o laboratório

```bash
kubectl delete -k k8s/
```

Como o Namespace também faz parte do Kustomize, os recursos namespaced, inclusive o PVC, serão removidos junto com ele. Para apagar também o cluster local:

```bash
kind delete cluster --name k8s-test-lab
```

No Minikube, use `minikube delete` apenas quando quiser remover o cluster inteiro.

## Limitações e melhorias para produção

Este é um laboratório de aprendizagem. Ele não oferece TLS/Ingress, autenticação, autorização, migrações versionadas, backup, criptografia gerenciada, alta disponibilidade do PostgreSQL, autoscaling, observabilidade centralizada, NetworkPolicy ou rotação de segredos. A senha no manifest é deliberadamente didática.

Para produção, use um PostgreSQL gerenciado ou um operador, backups testados e replicação; Secret Manager/Vault e RBAC mínimo; imagens imutáveis assinadas e scanner de vulnerabilidades; Ingress com TLS; NetworkPolicies; PodDisruptionBudget; HPA; métricas, logs estruturados e tracing; migrações controladas; limites revisados com métricas reais; e processos de recuperação de desastre documentados.
