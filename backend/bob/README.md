# BOP AGENCIA — BOB WEB ASSISTANT BACKEND
## PHASE 11A.2 — SECURE BACKEND FOUNDATION & CONVERSATION API

Lightweight, native Node.js backend foundation powering Bob, the official digital assistant of BOP Agencia.

---

### 1. Architecture Overview

```
Browser (Static Frontend on Namecheap)
   │
   │ HTTPS fetch
   ▼
POST /api/bob/chat   (Zero npm dependencies, Native Node.js 18+)
   │
   ├── CORS Validation (Strict allowlist, no wildcard *)
   ├── Security Headers (nosniff, DENY, no-cache)
   ├── Rate Limiter (In-memory, default 20 req/min per IP)
   ├── Payload Constraint (Max 32KB payload, max 500 chars per message)
   ├── Input Validation (Schema, string types, language allowlist es/en)
   │
   ▼
Conversation Service (with 15s timeout safeguard)
   │
   ▼
Provider Adapter Interface
   │
   ├── StubProvider (ACTIVE in Phase 11A.2 — deterministic, no external cost)
   ├── [Future Phase 11A.3] OpenAI / Gemini / Anthropic Adapters
   └── [Future Phase 11A.4] Knowledge Retriever / Vector RAG
   │
   ▼
Sanitized JSON Response (No secrets, no stack traces)
```

---

### 2. Security Principles

1. **Zero Client Secrets**: No API keys, credentials, or tokens are ever placed in `index.html`, `bob-assistant.js`, CSS, or public client files.
2. **Backend Proxy Pattern**: The frontend never communicates directly with external AI services (`api.openai.com`, `generativelanguage.googleapis.com`, etc.). All communication passes through our secure backend.
3. **Strict Validation**: All endpoints enforce strict payload size (32KB), maximum message lengths (2000 chars), and strict bilingual validation (`es` | `en`).
4. **Safe Logging**: The backend never logs user messages, email addresses, phone numbers, or tokens. It only logs metadata (status, latency, message character length, anonymized session prefixes).
5. **Rate Limiting**: Defends endpoints against automated spam and denial-of-service attempts.

---

### 3. API Contract

#### A. Health Check
- **Endpoint**: `GET /api/bob/health`
- **Response `200 OK`**:
```json
{
  "ok": true,
  "service": "bop-bob-backend",
  "provider": "stub"
}
```

#### B. Conversation
- **Endpoint**: `POST /api/bob/chat`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "message": "Hola Bob, ¿cómo funciona BOP?",
  "language": "es",
  "session_id": "bob-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "page": "home",
  "history": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": "¡Hola! ¿Cómo puedo ayudarte hoy?" }
  ]
}
```
- **Response `200 OK`**:
```json
{
  "ok": true,
  "reply": "¡Hola! La conexión segura con el backend de Bob está verificada y operativa (sesión: bob-9b1d). El motor de conocimiento y LLM se conectarán en las próximas fases.",
  "language": "es",
  "provider": "stub",
  "source": "stub",
  "sources": [],
  "session_id": "bob-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```
- **Error Response Example `400 Bad Request`**:
```json
{
  "ok": false,
  "code": "EMPTY_MESSAGE",
  "error": {
    "code": "EMPTY_MESSAGE",
    "message": "Field \"message\" cannot be empty."
  }
}
```

---

### 4. Configuration & Environment Variables

Copy `backend/bob/.env.example` to `backend/bob/.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BOP_BOB_PORT` | `8787` | Port for the backend server |
| `BOP_BOB_HOST` | `127.0.0.1` | Host binding interface |
| `NODE_ENV` | `development` | Runtime environment (`development` / `production`) |
| `BOP_BOB_PROVIDER` | `stub` | Active adapter (`stub` in Phase 11A.2) |
| `BOP_ALLOWED_ORIGINS` | `http://localhost:8080,http://127.0.0.1:8080` | Comma-separated CORS allowed origins |
| `BOP_BOB_RATE_LIMIT` | `20` | Max requests per rate window |
| `BOP_BOB_RATE_WINDOW_MS` | `60000` | Rate window duration in milliseconds (1 min) |
| `BOP_BOB_MAX_MESSAGE_LENGTH` | `2000` | Maximum character length for user message |
| `BOP_BOB_PROVIDER_TIMEOUT_MS` | `15000` | Max timeout before returning 504 |

---

### 5. Running the Backend

#### Development
```bash
cd backend/bob
npm start
```
Or with auto-restart on changes (Node 18+):
```bash
cd backend/bob
npm run dev
```

#### Running Automated Tests
```bash
npm test
```
The test suite verifies:
- Health endpoint status and fields
- Spanish and English stub responses
- Payload schema validation (empty, excessive length, invalid language)
- Method Not Allowed (405)
- Route Not Found (404)
- Preflight CORS headers

---

### 6. Frontend Integration & Static Hosting Decoupling

The main website (`index.html`) is 100% static and compatible with standard shared hosting (e.g., Namecheap).

Frontend integration in `assets/js/bob-assistant.js` is controlled by a safe toggle:
- **Default state**: `backendEnabled: false` (serves the Phase 11A.1 UI shell and honest fallback without requiring a backend).
- **Testing backend locally**:
  - Append `?bob_backend=1` to the URL: `http://localhost:8080/?bob_backend=1&bob=open`
  - Or configure globally before initialization:
    ```html
    <script>
      window.BobAssistantConfig = {
        apiBaseUrl: 'http://127.0.0.1:8787',
        backendEnabled: true
      };
    </script>
    ```
