# PolitikApp: Comprehensive Dockerization & Production Deployment Plan

**Document Status:** READY FOR EXECUTION  
**Target:** Containerized Local & Production Deployment (Docker, Docker Compose, Cloud PaaS / VPS)  
**Applicability:** Self-contained guide for engineering agents and developers without prior conversation context.

---

## 1. Executive Summary & Current System State

**PolitikApp** is a civic governance platform tracking Philippine elected officials through empirical metrics (bills authored, budget allocations, COA audit findings, and World Governance Indicators [WGI]). 

### Tech Stack
- **Backend:** Spring Boot 3.5.14, Java 17, Maven wrapper (`./mvnw` / `.\mvnw.cmd`), Spring Data JPA / Hibernate 6, Spring Security (Stateless JWT), Flyway 11 migrations.
- **Frontend:** React 19, Vite 8, Vanilla CSS (design tokens in `App.css`), Lucide icons, deep-linking via browser history (`pushState` / `popstate`).
- **Database:** PostgreSQL 17.6 (hosted on Supabase Cloud or containerized PostgreSQL).

### Current Audit & Readiness Scan
| Component | Current State | Blocker / Gap | Required Action |
| :--- | :--- | :--- | :--- |
| **Frontend Build** | `npm run build` passes in 5.5s (0 errors) | No production server (runs on Vite dev server). No SPA routing fallback. | Create multi-stage `Dockerfile` with Nginx and SPA fallback (`try_files $uri /index.html`). |
| **Backend Build** | `mvnw test-compile` passes with 0 errors | No containerization. Tests fail during `mvnw test` due to schema mismatch on remote Supabase DB. | Create multi-stage `Dockerfile` (JDK 17 $\rightarrow$ JRE 17 Alpine). Decouple tests from live DB. |
| **Database & Schema** | Flyway migrations `V1` to `V17` exist in repo | Remote Supabase has version drift (`version 20` recorded; missing `contributors` table error during validation). | Sync Supabase DB with canonical idempotent schema or isolate test environment. |
| **CORS & SSL** | Hardcoded in `SecurityConfig.java` to `http://localhost:*` and private IPs | Blocks `https://` requests and production domains (e.g. Vercel, Railway, Render). | Parameterize CORS origin patterns via `CORS_ALLOWED_ORIGINS` environment variable. |
| **Secrets & Config** | Fallbacks present, `.env` file imports from local disk | Relies on local `.env` files; JWT secret has hardcoded fallback. | Parameterize JWT secret, DB credentials, and CORS via container environment variables. |
| **Docker Tooling** | None | No `Dockerfile`, no `docker-compose.yml`, no `.dockerignore`. | Provide full production Docker configurations. |

---

## 2. Target Deployment Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Client Browser (Desktop / Mobile)        │
                    └───────────────────────────┬────────────────────────────┘
                                                │ HTTPS :443 / HTTP :80
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │            Frontend Container (Nginx Alpine)           │
                    │  - Serves static Vite bundles (/dist)                  │
                    │  - SPA rewrite: try_files $uri $uri/ /index.html       │
                    │  - Reverse Proxy: /api/* and /auth/* ──┐               │
                    └────────────────────────────────────────┼───────────────┘
                                                             │ Proxy pass (Internal Docker Network)
                                                             │ http://backend:8080
                                                             ▼
                    ┌────────────────────────────────────────────────────────┐
                    │            Backend Container (Spring Boot / JRE 17)    │
                    │  - Stateless REST API (:8080)                          │
                    │  - JWT Auth Filter & Rate Limiter                      │
                    │  - Actuator Health Endpoint (/actuator/health)         │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               PostgreSQL Database Layer                │
                    │  Option A (Default): Cloud Supabase PostgreSQL (SSL)  │
                    │  Option B: Local PostgreSQL 16/17 Docker Container     │
                    └────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Key Architectural Win:** Serving the frontend through an Nginx reverse proxy that routes `/api/` and `/auth/` to the backend on the internal Docker bridge network completely eliminates CORS preflight overhead and cross-domain SSL certificate complexity.

---

## 3. Phased Implementation Roadmap

### Phase 1: Database & Test Stabilization (Pre-Deployment Blocker)
Before container images can be reliably tested in CI/CD or production, the database schema validation failure must be fixed.

1. **Problem Analysis:**
   - In `backend/src/main/resources/application.properties`, Hibernate is configured with `spring.jpa.hibernate.ddl-auto=validate`.
   - When tests execute, Hibernate connects to Supabase and fails with:
     ```
     Schema-validation: missing table [contributors]
     Schema "public" has a version (20) that is newer than the latest available migration (17) !
     ```
   - This occurs because the remote Supabase database had experimental migrations or manual schema changes applied directly.

2. **Resolution Steps:**
   - **Step 1.1: Database Schema Sync:** Apply the unified idempotent migration script [supabase/migrations/20260906000000_politikapp_supabase_complete_schema.sql](file:///c:/Users/Si-Mon/Documents/Projecting/Mock/PolitikApp/supabase/migrations/20260906000000_politikapp_supabase_complete_schema.sql) to the target PostgreSQL database to ensure tables (`contributors`, `politicians`, `profile_edit_submissions`, `moderation_queue`, `timeline_entries`) and constraints exist cleanly.
   - **Step 1.2: Repair Flyway Schema Table:** Execute `DELETE FROM flyway_schema_history WHERE version > '17';` on Supabase to eliminate the "version 20 is newer than latest available migration 17" warning.
   - **Step 1.3: Update Documentation:** Align [docs/DATABASE_SCHEMA.md](file:///c:/Users/Si-Mon/Documents/Projecting/Mock/PolitikApp/docs/DATABASE_SCHEMA.md) to remove retired 1.0 tables (`jury_votes`, `reputation_audit_logs`, `peer_applications`) and retired triggers (`sync_submission_action_details_metric`) dropped in migration `V17`.
   - **Step 1.4: Decouple Unit Tests:** Configure `backend/src/test/resources/application.properties` to use an embedded database (H2 in PostgreSQL mode) or mock repository layer so builds do not require live network connectivity to Supabase.

---

### Phase 2: Backend Dockerization & Configuration Hardening

1. **Create `backend/Dockerfile` (Multi-Stage Build):**
```dockerfile
# Stage 1: Build JAR using Maven
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /workspace

# Cache dependency layer
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline -B

# Copy source and build executable JAR (skipping external DB tests in container build)
COPY src src
RUN ./mvnw clean package -DskipTests -B

# Stage 2: Minimal Production JRE Runtime
FROM eclipse-temurin:17-jre-alpine AS runner
WORKDIR /app

# Security: Run as unprivileged user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built artifact from builder stage
COPY --from=builder /workspace/target/*.jar app.jar

# Container memory and garbage collection tuning
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"
ENV SERVER_PORT=8080

EXPOSE 8080

# Health check using Spring Boot Actuator
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

2. **Create `backend/.dockerignore`:**
```
target/
.git/
.mvn/
*.log
.env
.env.*
```

3. **Update CORS in [SecurityConfig.java](file:///c:/Users/Si-Mon/Documents/Projecting/Mock/PolitikApp/backend/src/main/java/com/politikapp/backend/config/SecurityConfig.java):**
   - Inject `@Value("${app.cors.allowed-origins:}") String customOrigins` to allow dynamic origin injection.
   - Whitelist `https://*` and environment-defined domains alongside existing local network regexes.

4. **Environment Variables Configuration in [application.properties](file:///c:/Users/Si-Mon/Documents/Projecting/Mock/PolitikApp/backend/src/main/resources/application.properties):**
   Ensure fallback to standard system environment variables when no `.env` file is present:
   ```properties
   spring.datasource.url=${DATABASE_URL}
   spring.datasource.username=${DATABASE_USERNAME}
   spring.datasource.password=${DATABASE_PASSWORD}
   app.auth.jwt.secret=${APP_AUTH_JWT_SECRET:politikapp-super-secret-key-must-be-at-least-32-bytes}
   ```

---

### Phase 3: Frontend Dockerization & Reverse Proxy Setup

1. **Create `frontend/nginx.conf`:**
```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Static asset caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # Reverse proxy for backend APIs (Eliminates CORS issues)
    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /auth/ {
        proxy_pass http://backend:8080/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA routing fallback for React history deep-linking
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

2. **Create `frontend/Dockerfile` (Multi-Stage Build):**
```dockerfile
# Stage 1: Build React Assets
FROM node:20-alpine AS builder
WORKDIR /app

# Cache package installation
COPY package.json package-lock.json ./
RUN npm ci

# Pass build-time API base URL (Default to relative "" so Nginx proxies /api and /auth)
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

3. **Create `frontend/.dockerignore`:**
```
node_modules/
dist/
.git/
*.log
.env*
```

---

### Phase 4: Full Stack Orchestration (`docker-compose.yml`)

Create `docker-compose.yml` in the root workspace directory:

```yaml
version: '3.8'

services:
  # Spring Boot REST API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: politikapp-backend
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=supabase
      - DATABASE_URL=${DATABASE_URL}
      - DATABASE_USERNAME=${DATABASE_USERNAME}
      - DATABASE_PASSWORD=${DATABASE_PASSWORD}
      - JPA_DDL_AUTO=validate
      - FLYWAY_ENABLED=true
      - APP_AUTH_JWT_SECRET=${APP_AUTH_JWT_SECRET:-politikapp-super-secret-key-must-be-at-least-32-bytes}
      - APP_RATE_LIMITING_ENABLED=true
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - politikapp-net

  # React Frontend + Nginx Reverse Proxy
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_BASE_URL=""
    container_name: politikapp-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - politikapp-net

networks:
  politikapp-net:
    driver: bridge
```

---

### Phase 5: Verification & Deployment Options

#### Option A: Local Full Stack Docker Run
1. Create a root `.env` containing your database credentials:
   ```bash
   DATABASE_URL=jdbc:postgresql://<SUPABASE_HOST>:5432/postgres?sslmode=require...
   DATABASE_USERNAME=postgres.<PROJECT_REF>
   DATABASE_PASSWORD=<SECRET_PASSWORD>
   APP_AUTH_JWT_SECRET=<STRONG_RANDOM_32_CHAR_KEY>
   ```
2. Build and launch containers:
   ```bash
   docker compose up --build -d
   ```
3. Verify running containers:
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```
4. Access application at `http://localhost/` and check backend health at `http://localhost:8080/actuator/health`.

#### Option B: Split Cloud Production Deployment
If deploying without managing a VPS:
- **Database:** Supabase PostgreSQL Cloud Instance.
- **Backend:** Deploy `backend/Dockerfile` to **Railway**, **Render**, or **AWS App Runner** (Set port `8080`, inject env vars from `.env`).
- **Frontend:** Deploy `frontend` to **Vercel** or **Cloudflare Pages** (Set `VITE_API_BASE_URL=https://<your-backend-url>`).
- **CORS Update:** Provide `CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>` to backend env vars.

---

## 4. Execution Checklist for Agents

- [ ] **Step 1:** Synchronize database schema and verify `flyway_schema_history` on Supabase to ensure `mvnw test` passes.
- [ ] **Step 2:** Update [docs/DATABASE_SCHEMA.md](file:///c:/Users/Si-Mon/Documents/Projecting/Mock/PolitikApp/docs/DATABASE_SCHEMA.md) to prune references to retired `jury_votes` and `sync_submission_action_details_metric`.
- [ ] **Step 3:** Parameterize CORS in [SecurityConfig.java](file:///c:/Users/Si-Mon/Documents/Projecting/Mock/PolitikApp/backend/src/main/java/com/politikapp/backend/config/SecurityConfig.java) with `CORS_ALLOWED_ORIGINS` to support HTTPS and production URLs.
- [ ] **Step 4:** Create `backend/Dockerfile` and `backend/.dockerignore`.
- [ ] **Step 5:** Create `frontend/nginx.conf`, `frontend/Dockerfile`, and `frontend/.dockerignore`.
- [ ] **Step 6:** Create root `docker-compose.yml` and `.env.example`.
- [ ] **Step 7:** Run `docker compose up --build` and verify that the application boots with both containers reporting healthy.
