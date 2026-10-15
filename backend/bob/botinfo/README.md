# BOP Agencia — Bob Knowledge Base & Ingestion Foundation (Phase 11A.3)

Este directorio contiene la infraestructura local y segura para la ingestión, normalización, fragmentación y estructuración de conocimiento para **Bob Assistant**.

---

## 1. Estructura de Directorios

```
backend/bob/
├── botinfo/
│   ├── README.md               # Esta documentación técnica y operativa
│   ├── sources/                # FUENTES LOCALES (protegidas en .gitignore)
│   │   ├── documents/          # Documentos autorizados (.pdf, .docx, .txt, .md)
│   │   └── text/               # Notas y fragmentos de texto complementarios (.txt, .md)
│   ├── generated/              # CORPUS ESTRUCTURADO GENERADO
│   │   ├── manifest.json       # Resumen y métricas de fuentes y chunks
│   │   ├── sources.json        # Índice de metadata de fuentes procesadas
│   │   └── chunks.jsonl        # Chunks serializados (JSON Lines) para búsqueda
│   └── quarantine/             # Archivos que fallaron validación o sospechosos
└── knowledge/                  # MOTOR DE INGESTIÓN
    ├── ingest.js               # Orquestador del pipeline CLI
    ├── status.js               # Visualizador de estado y diagnóstico CLI
    ├── chunker.js              # Segmentación semántica determinista (1000–1600 caracteres)
    ├── manifest.js             # Generador y serializador de manifest y corpus
    ├── website-source.js       # Extractor de conocimiento oficial de index.html y portfolio.html
    ├── parsers/
    │   ├── txt-parser.js       # Parser local UTF-8 con soporte BOM y MD
    │   ├── pdf-parser.js       # Extractor local PDF (unpdf / PDF.js) con detección de OCR
    │   └── docx-parser.js      # Extractor local DOCX (mammoth)
    ├── normalizers/
    │   └── text-normalizer.js  # Limpieza de espacios y caracteres de control (preserva números, emails y URLs)
    └── utils/
        └── file-validator.js   # Guardia de seguridad: traversal, symlinks, extensiones y límites de peso
```

---

## 2. Principios de Seguridad y Privacidad

- **100% Local**: No se realizan llamadas de red salientes ni se conecta con servicios en la nube (OpenAI, Anthropic, Gemini, Ollama ni terceros).
- **Protección de Fuentes Privadas**: La carpeta `sources/` está excluida en `.gitignore` para evitar filtraciones accidentales de contratos o documentos internos confidenciales.
- **Aislamiento Web**: El directorio `botinfo/` se ubica exclusivamente dentro de `backend/bob/` y nunca se sirve como recurso estático ni se expone mediante rutas públicas del servidor HTTP.
- **Validación Estricta**:
  - Límite máximo de archivo: 20 MB por defecto.
  - Formatos admitidos: `.pdf`, `.docx`, `.txt`, `.md`.
  - Rechazo inmediato de enlaces simbólicos (symlinks) y mitigación de *path traversal*.
  - Detección de archivos vacíos (0 bytes) y archivos sin texto indexable (`needs_ocr: true`).

---

## 3. Comandos de la Línea de Comandos (CLI)

Desde el directorio `backend/bob/`:

### Ingestión en vivo
Escanea `sources/` y el sitio web autorizado (`index.html` y `portfolio.html`), extrae, normaliza, fragmenta y genera los artefactos en `generated/`:
```bash
npm run knowledge:ingest
```

### Ingestión en modo de prueba (`--dry-run`)
Ejecuta todo el pipeline de análisis, conteo y validación sin escribir nada en el disco:
```bash
npm run knowledge:ingest -- --dry-run
# o directamente:
node knowledge/ingest.js --dry-run
```

### Diagnóstico de estado
Muestra el resumen actual del corpus estructurado (`manifest.json`):
```bash
npm run knowledge:status
```

### Ejecución de Pruebas Automatizadas
Ejecuta la suite de pruebas del motor de conocimiento (20 pruebas unitarias y de integración):
```bash
npm run test:knowledge
```

Ejecuta todas las pruebas del backend (API HTTP + Motor de Conocimiento):
```bash
npm run test:all
```

---

## 4. Política de Fragmentación Semántica (Chunking)

Los fragmentos generados respetan las siguientes reglas:
- **Longitud objetivo**: 1000 a 1600 caracteres por chunk.
- **Solapamiento (*Overlap*)**: 150 a 250 caracteres preservando límites de palabras.
- **Límites semánticos**: Se priorizan saltos de párrafo dobles (`\n\n`), saltos de línea simples y puntuación terminal (`.`, `!`, `?`).
- **IDs deterministas**: Formato `${sourceId}-${section}-${index}-${contentFingerprint}`, reproducibles e invariables si el contenido no cambia.
- **Enlaces bidireccionales**: Cada chunk contiene `previous_chunk_id` y `next_chunk_id` para permitir reconstrucciones de contexto secuenciales durante la fase RAG.

---

## 5. Detección de Cambios y Caché

Cada fuente procesada almacena su hash SHA-256 en `sources.json`. En ejecuciones posteriores de `npm run knowledge:ingest`:
- Los archivos con el mismo hash se marcan como `[CACHED]` y reutilizan sus chunks calculados sin reanalizar.
- Los archivos nuevos o modificados se marcan como `[PROCESSED]`.
- Los archivos que ya no existan en disco se descartan del corpus para evitar fragmentos huérfanos.

---

## 6. Documentos Escaneados e Imágenes (`needs_ocr`)

Si se ingresa un PDF o documento que no contiene texto vectorial (por ejemplo, escaneos o imágenes incrustadas sin capa OCR), el sistema:
1. No se bloquea ni genera excepciones fatales.
2. Extrae las páginas detectadas.
3. Establece la bandera `needs_ocr: true` en la metadata de la fuente.
4. Registra el documento en la métrica `needs_ocr_count` de `manifest.json`.

---

## 7. Motor de Recuperación Determinista (PHASE 11A.4 — Retrieval Foundation)

El directorio `backend/bob/retrieval/` implementa el motor de búsqueda léxica y ranking local sin dependencias externas ni servicios de terceros.

### Componentes de Retrieval
- **`retriever.js`**: Servicio central `KnowledgeRetriever` para inicialización, caché en memoria y ranking.
- **`corpus-loader.js`**: Carga segura con validación de schema (`1.0.0`) y aislamiento ante corpus corruptos (`KNOWLEDGE_CORPUS_INVALID`).
- **`scorer.js`**: Motor de scoring léxico BM25 ($k_1=1.2, b=0.75$) combinado con:
  - Boost por coincidencia de frase exacta en cuerpo (+8.0) y título/sección (+8.0).
  - Boost por tokens en título/sección (+4.0 por término, +18.0 para anclas como `portfolio`/`portafolio`).
  - Multiplicador de alineación de idioma ($1.5\times$ para el idioma objetivo, $0.4\times$ para cross-language).
- **`query-normalizer.js`**: Normalización Unicode NFKC, eliminación de stopwords (ES/EN) con protección estricta de términos de marca (`bop`, `bob`, `agencia`, `universe`, `fusion`, `live`, `crm`, `erp`, `rh`, `social`).
- **`citation-builder.js`**: Generación de etiquetas de citación legibles para humanos y fragmentos (*snippets*) seguros centrados en los términos de búsqueda.
- **`search-cli.js`**: Herramienta CLI para ejecución de búsquedas.

### Uso en Línea de Comandos (CLI)
```bash
# Búsqueda en español
npm run knowledge:search -- "qué servicios ofrece Bop Agencia" --lang es

# Búsqueda en inglés
npm run knowledge:search -- "what services does Bop Agencia offer" --lang en

# Búsqueda con límite de resultados
npm run knowledge:search -- "Bop Fusion" --lang es --top 3
```

### Endpoint Seguro para Testing Interno
- **Ruta**: `POST /api/bob/search`
- **Controles de Seguridad**: Protegido con Rate Limiting (60 req/min), límite de longitud de query (máx. 500 caracteres), validación de payload (máx. 32KB) y headers CORS.
- **Payload**:
  ```json
  {
    "query": "correo de contacto bop agencia",
    "language": "es",
    "top_k": 5
  }
  ```
- **Respuesta**:
  ```json
  {
    "ok": true,
    "query": "correo de contacto bop agencia",
    "language": "es",
    "total_matches": 14,
    "results": [
      {
        "rank": 1,
        "score": 52.551,
        "chunk_id": "website-home-contact-es-...",
        "source_id": "website-home-contact-es",
        "source_name": "BOP Agencia — Canales Oficiales de Contacto y Atención (ES)",
        "section": "Canales Oficiales de Contacto",
        "language": "es",
        "snippet": "Canales Oficiales de Contacto de Bop Agencia: Inicia una conversación...",
        "citation": {
          "label": "Bop Agencia — Contacto",
          "source": "website"
        }
      }
    ],
    "duration_ms": 2
  }
  ```

---

## 8. Ausencia de Inteligencia Artificial Externa & Roadmap Futuro

- **Cero Embeddings / Cero Vectores**: El sistema opera mediante índices invertidos y frecuencias léxicas BM25 deterministas.
- **Cero LLM en Retrieval**: Ni OpenAI, ni Gemini, ni Anthropic, ni Ollama son consultados durante búsquedas.
- **StubProvider y Chat Intactos**: El endpoint conversacional `POST /api/bob/chat` y la UI del asistente Bob se mantienen desacoplados de retrieval en esta fase.
- **Preparación RAG (Fase 11A.5+)**: Los fragmentos retornados por `KnowledgeRetriever` suministrarán el contexto fundamentado (*grounding*) al futuro proveedor de lenguaje natural.

