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
python scripts/deploy_db.py
python scripts/seed_default_users.py
```

As migrations SQL ficam em `backend/db/migrations` e sao aplicadas diretamente no banco pela tabela `schema_migrations`.

## Render

O blueprint esta em `render.yaml`.

Variaveis para configurar no Render:

- `DATABASE_URL`: connection string do Neon com SSL.
- `SECRET_KEY`: segredo JWT.
- `FRONTEND_ORIGINS`: URL publica do static site, por exemplo `https://sordchat-web.onrender.com`.
- `REACT_APP_API_URL`: URL publica da API, por exemplo `https://sordchat-api.onrender.com`.
- `REACT_APP_WS_URL`: URL WebSocket da API, por exemplo `wss://sordchat-api.onrender.com`.
- `REACT_APP_DESKTOP_DOWNLOAD_URL`: URL do instalador desktop publicado.

## Desktop

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

O instalador sai em `sordchat-frontend/dist-desktop`. Publique o arquivo gerado como `SorDChat-Desktop.exe` no static site ou use uma URL externa em `REACT_APP_DESKTOP_DOWNLOAD_URL`.

## Observacoes

- `backend/sordchat_fixed.py` e o backend ativo para deploy.
- Uploads locais funcionam, mas em Render o filesystem e efemero. Para producao, o proximo passo e mover anexos para S3/R2/Supabase Storage.
- O Kanban ainda esta local no frontend; persistencia em banco deve entrar em uma proxima migration/API.
