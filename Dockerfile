# ============================================================================
# Git Blame Bet - Multi-Stage Dockerfile para deploy con Coolify
# ============================================================================
# Arquitectura: monolito single-container (backend API + WebSocket + frontend estático)
#
# ¿Por qué multi-stage? Porque en producción NO necesitamos ni el toolchain de
# compilación ni las devDependencies. Cada stage construye una capa independiente
# y el stage final (runtime) solo copia lo que necesita para correr.
#
# Los tres stages:
#   1. deps    → instala dependencias (cacheable si no cambian los package.json)
#   2. build   → compila el frontend con Vite (cacheable si no cambia el código)
#   3. runtime → imagen mínima de producción (solo lo necesario para ejecutar)
#
# PATTERN CLAVE — copia de manifests ANTES del código fuente:
# En los stages 1 (deps) y 3 (runtime), copiamos los package.json y bun.lock
# ANTES de copiar el código fuente. ¿Por qué? Porque Docker cachea las capas
# por instrucción. Si solo cambia un archivo .ts del backend, los package.json
# y bun.lock siguen iguales → Docker reutiliza la capa cacheada del `bun install`
# y NO reinstala todo. Si copiáramos todo junto, CUALQUIER cambio en cualquier
# archivo invalidaría el cache del install. Esto puede ahorrar minutos en cada build.
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Dependencias
# ---------------------------------------------------------------------------
# Este stage SOLO instala dependencias. Se cachea completo mientras los
# package.json y bun.lock no cambien (que es lo que menos cambia en el proyecto).
# Si tocás un .ts del backend, este stage se reutiliza íntegro desde el cache.
# ---------------------------------------------------------------------------
FROM oven/bun:1.2-debian AS deps

WORKDIR /app

# Copiamos los manifests del workspace para resolver dependencias.
# NOTA: Copiamos SOLO los package.json y lockfile, NO el código fuente.
# Esto es intencional: Docker cachea esta capa. Si los manifests no cambiaron,
# la capa se reutiliza y se saltea el `bun install` completo (mucho más rápido).
COPY package.json bun.lock tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

# --frozen-lockfile: asegura que el install sea EXACTAMENTE lo que dice el lockfile.
# Si alguien tocó un package.json sin actualizar el bun.lock, el build FALLA acá.
# Esto garantiza builds determinísticos — lo mismo que se testeó es lo que se deploya.
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
# Compila el frontend TypeScript y genera el bundle de Vite.
# Depende del stage `deps` así tiene todas las devDependencies disponibles.
# Se cachea mientras el código fuente del frontend y shared no cambien.
# ---------------------------------------------------------------------------
FROM deps AS build

# Copiamos el código fuente del frontend y el package shared.
# Recién ahora copiamos código — si algo cambió en .ts/.tsx, solo este stage
# se reconstruye (el stage 1 deps se reutiliza si los manifests no cambiaron).
COPY frontend/ ./frontend/
COPY packages/shared/ ./packages/shared/

# Build del frontend: corre `tsc -b` (type checking) y luego `vite build` (bundle).
# El resultado queda en frontend/dist/ — lo vamos a copiar en el stage runtime.
RUN cd frontend && bun run build

# ---------------------------------------------------------------------------
# Stage 3: Runtime (producción)
# ---------------------------------------------------------------------------
# Imagen mínima de producción. Solo tiene lo necesario para EJECUTAR la app.
# NO tiene devDependencies, NO tiene herramientas de build, NO tiene código
# fuente del frontend (solo el bundle compilado).
# ---------------------------------------------------------------------------
FROM oven/bun:1.2-debian AS runtime

WORKDIR /app

# Instalamos git porque la app lo necesita para clonar repos y hacer `git blame`.
# --no-install-recommends: evita instalar paquetes "sugeridos" de apt que no
# necesitamos (doc, locales, etc.). Mantiene la imagen más chica y segura.
# Limpiamos /var/lib/apt/lists* después para no dejar basura en la capa.
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# SEGUNDA COPIA DE MANIFESTS — mismo pattern que en Stage 1.
# ¿Por qué copiamos los package.json OTRA VEZ si ya están en el stage deps?
# Porque cada FROM arranca desde cero — los stages NO comparten el filesystem.
# Cada stage es una imagen independiente. Entonces necesitamos los manifests
# acá también para poder correr `bun install --production`.
#
# Y de nuevo: los copiamos ANTES del código fuente para el mismo motivo de
# cache. Si cambia un .ts pero no un package.json, el install se cachea.
COPY package.json bun.lock tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

# --production: instala SOLO dependencies (NO devDependencies).
# En runtime no necesitamos TypeScript, Vite, testing tools, etc.
# Esto reduce drásticamente el tamaño de la imagen y la superficie de ataque.
# --frozen-lockfile: misma garantía determinística que en Stage 1.
RUN bun install --frozen-lockfile --production

# Copiamos el código de la aplicación.
# Backend: el código fuente que Bun ejecuta directamente (no necesita compilación).
# Shared: types y lógica compartida entre frontend y backend.
# Frontend: solo el bundle compilado (dist/), NO el código fuente.
COPY backend/src/ ./backend/src/
COPY packages/shared/src/ ./packages/shared/src/
COPY --from=build /app/frontend/dist/ ./frontend/dist/

# Creamos usuario non-root por seguridad.
# ¿Por qué? Si alguien compromete la app, tiene los permisos de este usuario.
# Correr como root significaría acceso total al container. Con `bun` (UID 1000),
# el daño potencial se limita. Es una práctica fundamental de container hardening.
# El || true es porque oven/bun ya puede tener el usuario creado.
RUN useradd -m -s /bin/bash bun 2>/dev/null || true && \
    chown -R bun:bun /app

USER bun

# EXPOSE es DOCUMENTAL — no abre puertos, solo documenta que la app usa el 3000.
EXPOSE 3000

# WORKDIR /app/backend — esto es CLAVE para el entrypoint.
# El CMD (`bun run src/index.ts`) usa una ruta RELATIVA. Como el WORKDIR es
# /app/backend, Bun busca /app/backend/src/index.ts. Si no hiciéramos esto,
# tendríamos que usar una ruta absoluta como "run backend/src/index.ts".
# Además, esto hace que los paths con import.meta.dir se resuelvan correctamente
# dentro de /app/backend, lo cual es importante si el código usa __dirname o
# rutas relativas al módulo para encontrar archivos.
WORKDIR /app/backend

# HEALTHCHECK: le dice a Docker/Coolify cómo verificar que la app está viva.
# --interval=30s: chequea cada 30 segundos.
# --timeout=3s: si no responde en 3 segundos, se considera unhealthy.
# --start-period=10s: le da 10 segundos al server para arrancar antes del primer check.
# --retries=3: necesita fallar 3 veces seguidas para marcarse unhealthy.
# El comando hace un fetch a /api/health — si responde 200 (ok), está sano.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || '3000') + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Arranca el servidor backend — Bun ejecuta TypeScript directamente, sin build step.
CMD ["bun", "run", "src/index.ts"]
