Pack Captures (FastAPI + React)

Sistema simple para capturar evidencia de empaque (fotos con marca de agua) y consultar pedidos.
Roles: admin, bodega (solo capturar), callcenter (solo consultar).

📦 Estructura
backend_2.0/ # FastAPI + SQLite (o Postgres)
frontend_2.0/ # React + Vite

🚀 Requisitos

Node 18+ y npm

Python 3.10+ (con venv)

(Opcional) PostgreSQL 14+ si no quieres SQLite

🔐 Usuarios demo

admin / admin → todo

bodega / bodega2025 → solo Capturar

callcenter / callcenter123 → solo Consultar

🧪 Arranque rápido (local)

1. Backend
   cd backend_2.0
   python3 -m venv .venv
   source .venv/bin/activate # Windows: .venv\Scripts\activate
   pip install -r requirements.txt

# .env (ya incluido, ajustable)

# API_PREFIX=/api

# SECRET_KEY=dev-secret-key-change-me

# STORAGE_DIR=./data/images

# ENABLE_WATERMARK=True

uvicorn app.main:app --reload --port 8000

Verifica:

Health: http://127.0.0.1:8000/health
→ {"status":"ok"}

Docs: http://127.0.0.1:8000/docs

Por defecto usa SQLite en backend_2.0/data/app.db (se crea sola).
El directorio de imágenes es backend_2.0/data/images/.

2. Frontend
   cd ../frontend_2.0
   npm i

# .env (opcional en dev)

# VITE_BACKEND_URL=http://127.0.0.1:8000

# VITE_API_PREFIX=/api

npm run dev

Abrir: http://localhost:5173

🌐 URLs relativas (no “quemamos” dominio)
Frontend

Nunca usamos http://dominio:puerto en el código.

El frontend llama rutas relativas:

API: VITE_API_PREFIX → por defecto /api

Login: POST /token

Archivos: /files/...

En dev, Vite proxy estas rutas hacia el backend local (VITE_BACKEND_URL).

frontend_2.0/vite.config.ts:

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
const env = loadEnv(mode, process.cwd(), '')
const target = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
return {
plugins: [react()],
server: {
proxy: {
'/api': { target, changeOrigin: true, secure: false },
'/token': { target, changeOrigin: true, secure: false },
'/files': { target, changeOrigin: true, secure: false },
},
},
}
})

frontend_2.0/src/ui/App.tsx calcula la base así:

const apiBase = (import.meta.env.VITE_API_PREFIX || '/api').replace(/\/+$/, '')
// se usa como `${apiBase}/orders`, `${apiBase}/captures`, etc.

Producción (Nginx)

Sirve el dist/ del frontend.

Proxy /api y /files al backend (en 127.0.0.1:8000, por ejemplo).

Resultado: el front sigue llamando /api y Nginx redirige.

Ejemplo Nginx:

server {
server_name tu-dominio.com;

# Frontend estático

root /opt/pack/frontend_2.0/dist;
index index.html;

# SPA

location / { try_files $uri /index.html; }

# API → backend

location /api/ {
proxy_pass http://127.0.0.1:8000/api/;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Archivos de evidencias

location /files/ {
proxy_pass http://127.0.0.1:8000/files/;
}
}

Si el sitio vive bajo subruta (ej. /pack), define VITE_API_PREFIX=/pack/api y proxyea /pack/api/ y /pack/files/.

🗄️ Base de datos
Opción rápida (por defecto): SQLite

Sin configurar nada: ./data/app.db.

Autocreación de tablas al arrancar.

Postgres (recomendado en producción)

Instala driver:

pip install psycopg2-binary

En backend_2.0/.env agrega:

DATABASE_URL=postgresql+psycopg2://usuario:password@host:5432/packdb

El proyecto crea las tablas al arrancar con Base.metadata.create_all(...).

Si luego quieres migraciones formales, añade Alembic.

✍️ Captura y Consulta (comportamiento)

Capturar (roles: admin, bodega):

Campos obligatorios: order_no, responsible, note, foto(s).

Límite: 10 fotos por envío (el front hace lotes de 3).

Las imágenes se guardan en STORAGE_DIR/<order_no>/.

Si ENABLE_WATERMARK=True, se agrega banda inferior con: pedido, fecha/hora, operador.

Consultar (roles: admin, callcenter):

Lista de pedidos con contador y última captura.

Álbum por pedido; visor ampliado con zoom +/−, reset, arrastrar, pantalla completa y “abrir”.

🔧 Build y despliegue
Frontend (build)
cd frontend_2.0
npm run build

# genera frontend_2.0/dist/

Backend como servicio (systemd + gunicorn/uvicorn)
sudo tee /etc/systemd/system/pack-backend.service >/dev/null <<'UNIT'
[Unit]
Description=Pack Captures API
After=network.target

[Service]
User=pack
Group=pack
WorkingDirectory=/opt/pack/backend_2.0
EnvironmentFile=/opt/pack/backend_2.0/.env
ExecStart=/opt/pack/backend_2.0/.venv/bin/gunicorn app.main:app \
 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 \
 --workers 2 --threads 4 --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now pack-backend
sudo systemctl status pack-backend

⚙️ Variables de entorno

backend_2.0/.env.example

API_PREFIX=/api
SECRET_KEY=please-change-me
STORAGE_DIR=./data/images
ENABLE_WATERMARK=True

# DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/packdb

# CORS_ORIGINS=["https://tu-dominio.com"] # en producción puedes restringirlo

frontend_2.0/.env.example

VITE_BACKEND_URL=http://127.0.0.1:8000 # solo para dev (proxy vite)
VITE_API_PREFIX=/api # SIEMPRE relativo

🧰 Troubleshooting

“Failed to fetch” en dev → confirma que el backend está en :8000 y que vite.config.ts proxya /api, /token, /files. Reinicia npm run dev.

python: command not found → usa python3 y crea venv: python3 -m venv .venv.

No sube muchas fotos → máximo 10 por request; el front manda en lotes de 3.

Ver imágenes rotas → revisa que Nginx proxyee /files/ y que STORAGE_DIR existe con permisos.
