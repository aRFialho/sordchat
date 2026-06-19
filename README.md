# SorDChat

Workspace para comunicacao, tarefas e suporte interno, com web app, API FastAPI, banco Neon/Postgres e build desktop via Electron.

## Rodando localmente

Backend:

```powershell
cd backend
python -m pip install -r requirements.txt
python start_server.py
```

Frontend:

```powershell
cd sordchat-frontend
npm install
npm start
```

Acesse `http://127.0.0.1:3000`.

## Credenciais demo

- `admin` / `admin123`
- `coordenador` / `coord123`
- `usuario` / `user123`

## Neon sem Prisma

Configure `DATABASE_URL` com a connection string do Neon. Depois rode:

```powershell
cd backend
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
python scripts/deploy_db.py
python scripts/seed_default_users.py
```

As migrations SQL ficam em `backend/db/migrations` e sao aplicadas diretamente no banco pela tabela `schema_migrations`.

## Render

O blueprint esta em `render.yaml`.

Configuracao sem custo no Render:

- `sordchat-api` usa `plan: free`.
- `sordchat-web` usa `runtime: static`, que e o tipo de site estatico gratuito.
- `autoDeployTrigger: off` evita deploy automatico a cada push; faca deploy manual quando quiser testar.
- Nenhum banco Render Postgres, disco persistente, private service, worker, cron ou key-value e criado pelo blueprint.
- O banco fica no Neon via `DATABASE_URL`.
- `preDeployCommand` nao e usado porque o Render nao suporta pre-deploy em servicos free; a API roda migrations idempotentes no startup com `AUTO_MIGRATE_DB=true`.

Variaveis para configurar no Render:

- `DATABASE_URL`: connection string do Neon com SSL.
- `SECRET_KEY`: segredo JWT.
- `FRONTEND_ORIGINS`: URL publica do static site, por exemplo `https://sordchat-web.onrender.com`.
- `REACT_APP_API_URL`: URL publica da API, por exemplo `https://sordchat-api.onrender.com`.
- `REACT_APP_WS_URL`: URL WebSocket da API, por exemplo `wss://sordchat-api.onrender.com`.
- `REACT_APP_DESKTOP_DOWNLOAD_URL`: URL do instalador desktop publicado. Padrao de producao: `https://sordchat-api.onrender.com/downloads/desktop/latest`.

## Desktop

Preparar certificado interno gratuito para assinar o `.exe`:

```powershell
cd sordchat-frontend
npm run desktop:cert:setup
```

Esse comando cria ou reutiliza um certificado autoassinado em `Cert:\CurrentUser\My`,
exporta o certificado publico para `electron/certificates` e confia nele na maquina
do build. A chave privada nao entra no instalador.

Gerar pasta empacotada:

```powershell
cd sordchat-frontend
npm run desktop:pack
```

Gerar instalador Windows:

```powershell
cd sordchat-frontend
npm run desktop:dist
```

O instalador sai em `sordchat-frontend/dist-desktop`.

O instalador inclui esse certificado publico e tenta registra-lo automaticamente
em `LocalMachine\Root` e `LocalMachine\TrustedPublisher` durante a instalacao
elevada. Isso faz as proximas versoes assinadas pelo mesmo certificado serem
aceitas pela maquina.

Para uma maquina cliente aceitar as assinaturas internas antes da primeira
instalacao, copie estes dois arquivos para a mesma pasta:

- `dist-desktop/certificates/SorDChat-Internal-Code-Signing.cer`
- `scripts/install-internal-certificate.ps1`

Depois rode como administrador nessa maquina:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-internal-certificate.ps1
```

Como e um certificado interno autoassinado, isso nao compra reputacao publica do
Microsoft SmartScreen; para remover esse tipo de alerta fora de um ambiente
controlado, so com certificado publico/EV e historico de reputacao.

Publicar o instalador no Neon para download pela propria API:

```powershell
cd backend
python scripts/publish_desktop_release.py ..\sordchat-frontend\dist-desktop\SorDChat-Setup-0.1.0.exe
```

Depois de publicado, a landing usa `REACT_APP_DESKTOP_DOWNLOAD_URL=https://sordchat-api.onrender.com/downloads/desktop/latest`.

## Observacoes

- `backend/sordchat_fixed.py` e o backend ativo para deploy.
- Uploads locais funcionam, mas em Render o filesystem e efemero. Para producao, o proximo passo e mover anexos para S3/R2/Supabase Storage.
- O Kanban ainda esta local no frontend; persistencia em banco deve entrar em uma proxima migration/API.
