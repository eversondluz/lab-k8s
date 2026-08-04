# AGENTS.md

## Arquitetura do projeto

- `src/app.js` cria a aplicação Express e recebe a dependência de banco por injeção.
- `src/server.js` cria o banco, executa a inicialização com tentativas de reconexão, abre a porta 3000 e trata `SIGTERM`/`SIGINT`.
- `src/database.js` encapsula o pool `pg`, a criação automática da tabela, as queries parametrizadas e a readiness do PostgreSQL.
- `src/routes/messages.js` contém validação e endpoints de mensagens.
- `src/public/` contém o frontend sem framework, servido como arquivo estático.
- `tests/` contém testes de API com Supertest e mocks do banco.
- `k8s/` contém manifests independentes organizados por Kustomize. O nome do Service PostgreSQL é `postgres` e deve continuar alinhado a `DB_HOST`.

## Padrões de código

- Use CommonJS, sem introduzir uma segunda estratégia de módulos sem necessidade.
- Mantenha a validação de entrada no limite da API e use queries parametrizadas no banco.
- Não concatene valores recebidos do usuário em SQL ou HTML.
- Preserve respostas JSON e códigos HTTP documentados no README.
- Use logs curtos e claros, sem imprimir senhas, tokens ou payloads sensíveis.
- Mantenha o frontend sem frameworks; renderize conteúdo recebido usando `textContent`.
- Prefira funções pequenas, dependências injetáveis e nomes descritivos.
- Toda alteração de configuração de ambiente deve atualizar `.env.example`, manifests e README quando aplicável.

## Comandos de teste e validação

```bash
npm install
npm run lint
npm test
docker build -t k8s-test-lab-web:local .
kubectl apply --dry-run=client -k k8s/
```

Se houver um cluster local, também valide:

```bash
kubectl apply -k k8s/
kubectl get all -n k8s-test-lab
kubectl get pvc -n k8s-test-lab
kubectl rollout status deployment/web -n k8s-test-lab
```

## Regras para futuras alterações por agentes

1. Leia este arquivo e o README antes de alterar a arquitetura.
2. Preserve os endpoints `/health`, `/ready`, `GET /api/messages` e `POST /api/messages`, salvo se a mudança também atualizar a documentação e os testes.
3. Não substitua o StatefulSet do PostgreSQL por um Deployment sem uma decisão explícita sobre identidade e persistência.
4. Não remova probes, requests/limits, `securityContext`, initContainer ou PVC sem explicar o impacto didático no README.
5. Não coloque credenciais reais no repositório. A credencial existente é somente de laboratório.
6. Adicione ou atualize testes para mudanças de comportamento.
7. Execute lint, testes, build Docker e `kubectl apply --dry-run=client -k k8s/` antes de entregar.
8. Ao alterar um nome de Service, porta, label ou chave de ConfigMap/Secret, confira todos os consumidores nos manifests e no código.
9. Preserve mudanças preexistentes de outros colaboradores e evite comandos destrutivos no workspace.
