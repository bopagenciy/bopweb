/**
 * BOP AGENCIA — PHASE 11A.1
 * BOB WEB ASSISTANT — UI SHELL / INTERACTION LOGIC
 * 
 * Strict Brand & Engineering Directives:
 * - Pure UI/UX frontend implementation.
 * - NO AI / NO LLM / NO APIs / NO backend calls.
 * - Honest, controlled fallback for open-ended user text.
 * - Preserves BopContactBridge compatibility.
 * - Full bilingual session management (ES/EN) via sessionStorage.
 * - Fully accessible keyboard controls (Esc to close, focus trap, ARIA).
 */

(function () {
  'use strict';

  // Constants & Dictionary
  const STORAGE_KEY_LANG = 'bob_session_lang';
  const STORAGE_KEY_WELCOMED = 'bob_session_welcomed';
  const STORAGE_KEY_SESSION_ID = 'bob_session_id';

  // Backend Integration Configuration
  // - backendEnabled: true by default for live interaction.
  // - backendBaseUrl: in local dev (localhost/127.0.0.1 not on 8787), defaults to 'http://127.0.0.1:8787'.
  //                   in production, defaults to '' (same origin / reverse proxy).
  // - requestTimeoutMs: 25000 (25 seconds).
  const isLocalDevHost = (typeof window !== 'undefined' && window.location)
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : false;
  const isDifferentPort = (typeof window !== 'undefined' && window.location)
    ? (window.location.port !== '8787')
    : false;

  const defaultAssistantConfig = {
    backendEnabled: true,
    backendBaseUrl: (isLocalDevHost && isDifferentPort) ? 'http://127.0.0.1:8787' : '',
    requestTimeoutMs: 25000
  };

  const assistantConfig = Object.assign({}, defaultAssistantConfig, window.BobAssistantConfig || {});

  // URL query parameter overrides for local testing & development
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('bob_backend')) {
      const bParam = urlParams.get('bob_backend');
      assistantConfig.backendEnabled = (bParam === '1' || bParam === 'true');
    }
    // Safe localhost/127.0.0.1 override only to prevent arbitrary external URL injection
    if (urlParams.has('bob_api')) {
      const apiParam = urlParams.get('bob_api');
      try {
        const parsed = new URL(apiParam);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          assistantConfig.backendBaseUrl = apiParam.replace(/\/+$/, '');
        }
      } catch (_) {}
    }
    if (urlParams.has('bob_timeout')) {
      const tParam = parseInt(urlParams.get('bob_timeout'), 10);
      if (!isNaN(tParam) && tParam >= 1000) {
        assistantConfig.requestTimeoutMs = tParam;
      }
    }
  } catch (_) {}

  const BOB_ASSET_SRC = 'assets/media/img/optimized/bob1-assistant.webp';
  const OFFICIAL_WHATSAPP_URL = 'https://wa.me/573054176606';
  const OFFICIAL_EMAIL = 'bopagencia@gmail.com';

  const I18N = {
    es: {
      assistantName: 'Bob',
      assistantRole: 'Asistente de Bop Agencia',
      statusAvailable: 'Disponible',
      welcomeHeadline: 'Hola 👋 Soy Bob, el asistente de Bop Agencia.',
      welcomeQuestion: 'Antes de comenzar, ¿en qué idioma prefieres conversar?',
      btnLangEs: 'Español',
      btnLangEn: 'English',
      greetingIntro: '¡Perfecto! ¿Cómo puedo ayudarte hoy?',
      disclaimer: 'Bob responde con conocimiento verificado de Bop Agencia.',
      brandMeta: 'Bop Agencia',
      inputPlaceholder: 'Escribe tu mensaje...',
      sendAria: 'Enviar mensaje',
      closeAria: 'Cerrar asistente Bob',
      launcherPillText: 'Habla con Bob',
      launcherOpenAria: 'Abrir chat con Bob',
      launcherCloseAria: 'Cerrar asistente Bob',
      restartAria: 'Reiniciar conversación',
      typingText: 'Bob está pensando...',
      timeoutError: 'Bob está tardando más de lo esperado. Inténtalo de nuevo en unos segundos.',
      unavailableError: 'No pude conectarme con Bob en este momento. Puedes intentarlo de nuevo o escribirnos por WhatsApp.',
      rateLimitError: 'Has enviado varios mensajes muy rápido. Espera un momento y vuelve a intentarlo.',
      fallbackResponse: 'Todavía estoy terminando mi entrenamiento para responder preguntas abiertas. Por ahora puedo ayudarte a explorar Bop Agencia o llevarte al equipo.',
      whatsappCtaLabel: 'Hablar por WhatsApp',
      sourcesLabel: 'Fuentes',
      quickActions: [
        {
          id: 'services',
          label: 'Conocer nuestros servicios',
          response: 'Claro. Bop Agencia trabaja en Branding & Identidad, Diseño & Creatividad, Marketing & Campañas, Web & Digital, entre otras soluciones.\n\nPuedes explorar todos nuestros servicios aquí.',
          ctaLabel: 'Ver servicios →',
          ctaHref: '#servicios'
        },
        {
          id: 'universe',
          label: 'BOP Universe',
          response: 'BOP Universe es nuestro ecosistema tecnológico de plataformas modulares conectadas: CRM, ERP, RRHH, Chatbots y Automatizaciones integradas.',
          ctaLabel: 'Explorar BOP Universe →',
          ctaHref: '#bop-universe'
        },
        {
          id: 'live',
          label: 'BOP Live',
          response: 'BOP Live es nuestra división de experiencias presenciales: stands para ferias, activaciones de marca y eventos memorables.',
          ctaLabel: 'Descubrir BOP Live →',
          ctaHref: '#bop-live'
        },
        {
          id: 'ai',
          label: 'Inteligencia Artificial',
          response: 'Diseñamos soluciones de IA aplicada: flujos inteligentes, agentes para atención y optimización de procesos empresariales.',
          ctaLabel: 'Ver soluciones de IA →',
          ctaHref: '#inteligencia-artificial'
        },
        {
          id: 'project',
          label: 'Quiero iniciar un proyecto',
          response: 'Perfecto. Puedes escribirnos directamente por WhatsApp para conversar sobre tu proyecto.',
          ctaLabel: 'Hablar por WhatsApp →',
          ctaHref: OFFICIAL_WHATSAPP_URL
        }
      ]
    },
    en: {
      assistantName: 'Bob',
      assistantRole: 'Bop Agencia Assistant',
      statusAvailable: 'Available',
      welcomeHeadline: 'Hello 👋 I am Bob, Bop Agencia’s digital assistant.',
      welcomeQuestion: 'Before we start, which language do you prefer to speak in?',
      btnLangEs: 'Español',
      btnLangEn: 'English',
      greetingIntro: 'Perfect! How can I help you today?',
      disclaimer: 'Bob responds using verified Bop Agencia knowledge.',
      brandMeta: 'Bop Agencia',
      inputPlaceholder: 'Type your message...',
      sendAria: 'Send message',
      closeAria: 'Close Bob assistant',
      launcherPillText: 'Talk to Bob',
      launcherOpenAria: 'Open chat with Bob',
      launcherCloseAria: 'Close Bob digital assistant',
      restartAria: 'Restart conversation',
      typingText: 'Bob is thinking...',
      timeoutError: 'Bob is taking longer than expected. Please try again in a few seconds.',
      unavailableError: 'I couldn’t connect to Bob right now. You can try again or contact us on WhatsApp.',
      rateLimitError: 'You’ve sent several messages very quickly. Please wait a moment and try again.',
      fallbackResponse: 'I’m still completing my training for open-ended questions. For now, I can help you explore Bop Agencia or connect you with the team.',
      whatsappCtaLabel: 'Chat on WhatsApp',
      sourcesLabel: 'Sources',
      quickActions: [
        {
          id: 'services',
          label: 'Explore our services',
          response: 'Of course. Bop Agencia delivers Branding & Identity, Design & Creativity, Marketing & Campaigns, Web & Digital, among other core solutions.\n\nYou can explore all our services here.',
          ctaLabel: 'View services →',
          ctaHref: '#servicios'
        },
        {
          id: 'universe',
          label: 'BOP Universe',
          response: 'BOP Universe is our modular ecosystem of connected business platforms: CRM, ERP, HR, Chatbots, and native automations.',
          ctaLabel: 'Explore BOP Universe →',
          ctaHref: '#bop-universe'
        },
        {
          id: 'live',
          label: 'BOP Live',
          response: 'BOP Live is our experiential division: custom exhibition stands, high-impact activations, and live corporate experiences.',
          ctaLabel: 'Discover BOP Live →',
          ctaHref: '#bop-live'
        },
        {
          id: 'ai',
          label: 'Artificial Intelligence',
          response: 'We craft practical applied AI: intelligent workflows, conversational agents, and corporate process optimization.',
          ctaLabel: 'Explore AI solutions →',
          ctaHref: '#inteligencia-artificial'
        },
        {
          id: 'project',
          label: 'I want to start a project',
          response: 'Great. You can reach out directly via WhatsApp to discuss your project.',
          ctaLabel: 'Chat on WhatsApp →',
          ctaHref: OFFICIAL_WHATSAPP_URL
        }
      ]
    }
  };

  // State Management
  let bobLang = sessionStorage.getItem(STORAGE_KEY_LANG) || null;
  let isOpen = false;
  let hasWelcomed = sessionStorage.getItem(STORAGE_KEY_WELCOMED) === 'true';

  // In-memory conversation state (strictly ephemeral, never persisted to localStorage/DB)
  let chatHistory = [];
  let isRequestInflight = false;
  let activeAbortController = null;
  let activeRequestTimer = null;

  // DOM Elements
  let launcherBtn = null;
  let panelEl = null;
  let conversationEl = null;
  let composerInput = null;
  let composerForm = null;
  let headerSubtitleEl = null;
  let metaDisclaimerEl = null;
  let openTimestamp = 0;

  /**
   * Determine current active page language ('es' or 'en')
   */
  function getPageLang() {
    const htmlLang = document.documentElement.getAttribute('lang') || 'es';
    return htmlLang.toLowerCase().startsWith('en') ? 'en' : 'es';
  }

  /**
   * Helper to escape HTML characters
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Inject UI markup into DOM if not already present
   */
  function injectMarkup() {
    if (document.getElementById('bobAssistantLauncher')) return;

    const markup = `
      <!-- Bob Assistant Floating Launcher with Integrated Pill -->
      <button id="bobAssistantLauncher" 
              type="button" 
              aria-label="${(getPageLang() === 'en' ? I18N.en : I18N.es).launcherOpenAria}" 
              aria-expanded="false" 
              aria-controls="bobAssistantPanel"
              data-bob-action="toggle">
        <span class="bob-launcher-pill" id="bobLauncherPill">
          <span class="bob-launcher-pill-text" id="bobLauncherPillText">${(getPageLang() === 'en' ? I18N.en : I18N.es).launcherPillText}</span>
          <svg class="bob-launcher-pill-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <div class="bob-launcher-inner">
          <img src="${BOB_ASSET_SRC}" 
               alt="Bob" 
               class="bob-launcher-avatar" 
               width="60" 
               height="60" 
               loading="eager" 
               decoding="async">
          <span class="bob-launcher-badge" aria-hidden="true"></span>
          <div class="bob-launcher-close-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>
      </button>

      <!-- Bob Assistant Main Panel -->
      <section id="bobAssistantPanel" 
               role="dialog" 
               aria-modal="false" 
               aria-labelledby="bobPanelTitle" 
               aria-hidden="true">
        <!-- Header -->
        <header class="bob-panel-header">
          <div class="bob-header-left">
            <div class="bob-header-avatar-wrap">
              <img src="${BOB_ASSET_SRC}" 
                   alt="Bob" 
                   class="bob-header-avatar" 
                   width="40" 
                   height="40" 
                   loading="lazy">
              <span class="bob-status-indicator" aria-hidden="true"></span>
            </div>
            <div class="bob-header-info">
              <div class="bob-header-title-row">
                <span id="bobPanelTitle" class="bob-header-title">Bob</span>
                <span class="bob-header-tag">BOP</span>
              </div>
              <p class="bob-header-subtitle" id="bobHeaderSubtitle">
                <span class="bob-header-role">${I18N.es.assistantRole}</span>
                <span aria-hidden="true">•</span>
                <span class="bob-header-status-text">${I18N.es.statusAvailable}</span>
              </p>
            </div>
          </div>
          <div class="bob-header-actions">
            <button type="button" 
                    class="bob-header-btn" 
                    id="bobResetBtn" 
                    title="${I18N.es.restartAria}" 
                    aria-label="${I18N.es.restartAria}"
                    data-bob-action="reset">
              <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
            </button>
            <button type="button" 
                    class="bob-header-btn" 
                    id="bobCloseBtn" 
                    title="${I18N.es.closeAria}" 
                    aria-label="${I18N.es.closeAria}"
                    data-bob-action="close">
              <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <!-- Conversation Stage -->
        <div id="bobConversation" 
             role="log" 
             aria-live="polite" 
             aria-atomic="false">
          <!-- Dynamic conversation blocks inserted here -->
        </div>

        <!-- Composer / Input Section -->
        <div class="bob-panel-composer">
          <form class="bob-composer-form" id="bobComposerForm" action="javascript:void(0);">
            <input type="text" 
                   class="bob-composer-input" 
                   id="bobComposerInput" 
                   placeholder="${I18N.es.inputPlaceholder}" 
                   autocomplete="off" 
                   maxlength="2000"
                   aria-label="${I18N.es.inputPlaceholder}">
            <button type="submit" 
                    class="bob-composer-send-btn" 
                    id="bobComposerSendBtn" 
                    aria-label="${I18N.es.sendAria}"
                    data-bob-action="send">
              <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
          <div class="bob-panel-footer-meta">
            <span class="bob-meta-disclaimer" id="bobMetaDisclaimer">${I18N.es.disclaimer}</span>
            <span class="bob-meta-brand">${I18N.es.brandMeta}</span>
          </div>
        </div>
      </section>
    `;

    document.body.insertAdjacentHTML('beforeend', markup);
  }

  /**
   * Cache DOM elements once injected
   */
  function bindElements() {
    launcherBtn = document.getElementById('bobAssistantLauncher');
    panelEl = document.getElementById('bobAssistantPanel');
    conversationEl = document.getElementById('bobConversation');
    composerInput = document.getElementById('bobComposerInput');
    composerForm = document.getElementById('bobComposerForm');
    headerSubtitleEl = document.getElementById('bobHeaderSubtitle');
    metaDisclaimerEl = document.getElementById('bobMetaDisclaimer');
  }

  /**
   * Scroll conversation container to bottom
   */
  function scrollToBottom() {
    if (!conversationEl) return;
    requestAnimationFrame(() => {
      conversationEl.scrollTop = conversationEl.scrollHeight;
    });
  }

  /**
   * Synchronize Launcher pill label and accessible aria attributes with global page language.
   * Spanish: 'Habla con Bob' / 'Abrir chat con Bob'
   * English: 'Talk to Bob' / 'Open chat with Bob'
   */
  function syncLauncherLabels() {
    const pageLang = getPageLang();
    const t = I18N[pageLang] || I18N.es;
    const pillTextEl = document.getElementById('bobLauncherPillText');
    if (pillTextEl) {
      pillTextEl.textContent = t.launcherPillText;
    }
    if (launcherBtn) {
      if (isOpen) {
        launcherBtn.setAttribute('aria-label', t.launcherCloseAria);
      } else {
        launcherBtn.setAttribute('aria-label', t.launcherOpenAria);
      }
    }
  }

  /**
   * Update header, disclaimer, and placeholder labels to active language
   */
  function updateHeaderLabels(lang) {
    const t = I18N[lang] || I18N.es;
    syncLauncherLabels();
    if (headerSubtitleEl) {
      headerSubtitleEl.innerHTML = `
        <span class="bob-header-role">${escapeHtml(t.assistantRole)}</span>
        <span aria-hidden="true">•</span>
        <span class="bob-header-status-text">${escapeHtml(t.statusAvailable)}</span>
      `;
    }
    if (metaDisclaimerEl) {
      metaDisclaimerEl.textContent = t.disclaimer;
    }
    if (composerInput) {
      composerInput.placeholder = t.inputPlaceholder;
      composerInput.setAttribute('aria-label', t.inputPlaceholder);
    }
    const sendBtn = document.getElementById('bobComposerSendBtn');
    if (sendBtn) {
      sendBtn.setAttribute('aria-label', t.sendAria);
    }
    const closeBtn = document.getElementById('bobCloseBtn');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', t.closeAria);
      closeBtn.setAttribute('title', t.closeAria);
    }
    const resetBtn = document.getElementById('bobResetBtn');
    if (resetBtn) {
      resetBtn.setAttribute('aria-label', t.restartAria);
      resetBtn.setAttribute('title', t.restartAria);
    }
  }

  /**
   * Render the Initial Welcome Card (Large Bob presence + Language Choice)
   */
  function renderWelcomeCard() {
    if (!conversationEl) return;
    conversationEl.innerHTML = '';

    const currentSiteLang = getPageLang();
    const isEnFirst = currentSiteLang === 'en';

    // Order buttons based on page language while always asking both
    const btnEs = `<button type="button" class="bob-lang-btn" data-lang-choice="es" data-bob-action="select-lang-es">${I18N.es.btnLangEs}</button>`;
    const btnEn = `<button type="button" class="bob-lang-btn" data-lang-choice="en" data-bob-action="select-lang-en">${I18N.en.btnLangEn}</button>`;

    const langButtonsHtml = isEnFirst ? `${btnEn}${btnEs}` : `${btnEs}${btnEn}`;

    const welcomeHtml = `
      <div class="bob-welcome-card" id="bobWelcomeCard">
        <div class="bob-welcome-visual-wrap">
          <div class="bob-welcome-visual-bg"></div>
          <img src="${BOB_ASSET_SRC}" 
               alt="Bob Assistant" 
               class="bob-welcome-visual-img" 
               width="100" 
               height="100" 
               loading="eager" 
               decoding="async">
        </div>
        <div class="bob-welcome-badge">
          <span class="bob-welcome-badge-dot"></span>
          <span>BOP DIGITAL ASSISTANT</span>
        </div>
        <h3 class="bob-welcome-headline">Hola 👋 Soy Bob, el asistente de Bop Agencia.</h3>
        <p class="bob-welcome-subtext">Antes de comenzar, ¿en qué idioma prefieres conversar?<br><span style="font-size:11.5px; opacity:0.8;">Before we begin, which language do you prefer?</span></p>
        <div class="bob-lang-picker-group">
          ${langButtonsHtml}
        </div>
      </div>
    `;

    conversationEl.innerHTML = welcomeHtml;

    // Attach listeners to language buttons
    const langBtns = conversationEl.querySelectorAll('.bob-lang-btn');
    langBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selectedLang = e.currentTarget.getAttribute('data-lang-choice');
        setAssistantLanguage(selectedLang, true);
      });
    });

    scrollToBottom();
  }

  /**
   * Safe text formatter with whitelisted links and markdown-style bullet parsing.
   * Strictly prevents arbitrary HTML injection.
   */
  function formatSafeMessageContent(rawText) {
    if (!rawText) return '';
    // 1. Strictly escape HTML special characters first
    const escaped = escapeHtml(rawText);

    // 2. Safe linkify whitelist only:
    // - WhatsApp official link: https://wa.me/573054176606
    // - Email official: bopagencia@gmail.com
    const withLinks = escaped
      .replace(
        /(https:\/\/wa\.me\/573054176606(?:\?[^\s<"']*)?)/gi,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="bob-msg-link">$1</a>'
      )
      .replace(
        /(mailto:)?(bopagencia@gmail\.com)/gi,
        '<a href="mailto:$2" class="bob-msg-link">$2</a>'
      );

    // 3. Format lines, paragraphs and bullet lists
    const lines = withLinks.split('\n');
    let out = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inList) {
          out += '</ul>';
          inList = false;
        }
        continue;
      }

      // Check for bullet items (•, -, *)
      const bulletMatch = line.match(/^([•\-\*]|\d+\.)\s+(.+)$/);
      if (bulletMatch) {
        if (!inList) {
          out += '<ul class="bob-msg-bullets">';
          inList = true;
        }
        out += `<li class="bob-msg-bullet-item">${bulletMatch[2]}</li>`;
      } else {
        if (inList) {
          out += '</ul>';
          inList = false;
        }
        out += `<p class="bob-msg-p">${line}</p>`;
      }
    }

    if (inList) {
      out += '</ul>';
    }

    return out;
  }

  /**
   * Render discreet, deduplicated sources UI using native, accessible <details>
   */
  function renderSourcesHtml(sources, lang) {
    if (!Array.isArray(sources) || !sources.length) return '';

    // Deduplicate by source_id or title
    const seen = new Set();
    const deduped = [];
    for (const s of sources) {
      if (!s || !s.title) continue;
      const key = (s.source_id || s.title).trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push({
          title: s.title.trim(),
          category: s.category || '',
          url: s.url || ''
        });
      }
    }

    if (!deduped.length) return '';

    const label = (lang === 'en') ? I18N.en.sourcesLabel : I18N.es.sourcesLabel;

    return `
      <details class="bob-msg-sources-details">
        <summary class="bob-msg-sources-summary">
          <svg class="bob-sources-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span class="bob-sources-label-text">${escapeHtml(label)} (${deduped.length})</span>
          <svg class="bob-sources-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </summary>
        <ul class="bob-msg-sources-list">
          ${deduped.map(item => `
            <li class="bob-msg-source-item">
              <span class="bob-source-bullet">•</span>
              <span class="bob-source-title">${escapeHtml(item.title)}</span>
            </li>
          `).join('')}
        </ul>
      </details>
    `;
  }

  /**
   * Add a Bob message to the conversation log with optional CTA, WhatsApp button, or Sources
   */
  function appendBobMessage(text, options = null) {
    if (!conversationEl) return;

    const row = document.createElement('div');
    row.className = 'bob-msg-row is-bot';

    const lang = bobLang || 'es';
    const formattedContent = formatSafeMessageContent(text);

    let ctaHtml = '';
    if (options && options.ctaHref && options.ctaLabel) {
      ctaHtml = `
        <a href="${escapeHtml(options.ctaHref)}" 
           class="bob-msg-cta-link" 
           data-bob-cta="${escapeHtml(options.id || '')}">
          <span>${escapeHtml(options.ctaLabel)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      `;
    }

    let waHtml = '';
    if (options && options.showWhatsAppCta) {
      const waLabel = (lang === 'en') ? I18N.en.whatsappCtaLabel : I18N.es.whatsappCtaLabel;
      waHtml = `
        <a href="${OFFICIAL_WHATSAPP_URL}" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="bob-msg-cta-link bob-cta-whatsapp">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>${escapeHtml(waLabel)}</span>
        </a>
      `;
    }

    let sourcesHtml = '';
    if (options && options.sources && options.sources.length) {
      sourcesHtml = renderSourcesHtml(options.sources, lang);
    }

    row.innerHTML = `
      <div class="bob-msg-bot-avatar" aria-hidden="true">
        <img src="${BOB_ASSET_SRC}" alt="Bob">
      </div>
      <div class="bob-msg-bubble">
        <div class="bob-msg-content">${formattedContent}</div>
        ${sourcesHtml}
        ${ctaHtml}
        ${waHtml}
      </div>
    `;

    conversationEl.appendChild(row);

    // Bind smooth navigation to CTA if clicked
    if (options && options.ctaHref && options.ctaHref.startsWith('#')) {
      const link = row.querySelector('.bob-msg-cta-link[data-bob-cta]');
      if (link) {
        link.addEventListener('click', (e) => {
          handleCtaNavigation(e, options.ctaHref);
        });
      }
    }

    scrollToBottom();
  }

  /**
   * Add a User message to the conversation log safely
   */
  function appendUserMessage(text) {
    if (!conversationEl) return;

    const row = document.createElement('div');
    row.className = 'bob-msg-row is-user';

    row.innerHTML = `
      <div class="bob-msg-bubble">
        ${escapeHtml(text)}
      </div>
    `;

    conversationEl.appendChild(row);
    scrollToBottom();
  }

  /**
   * Render Quick Actions menu
   */
  function renderQuickActions() {
    if (!conversationEl) return;

    const lang = bobLang || 'es';
    const actions = (I18N[lang] || I18N.es).quickActions;

    const wrap = document.createElement('div');
    wrap.className = 'bob-quick-actions-wrap';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bob-quick-action-btn';
      btn.setAttribute('data-action-id', action.id);
      btn.setAttribute('data-bob-action', `quick-${action.id}`);
      btn.innerHTML = `
        <span>${escapeHtml(action.label)}</span>
        <svg class="bob-quick-action-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;

      btn.addEventListener('click', () => {
        handleQuickAction(action);
      });

      wrap.appendChild(btn);
    });

    conversationEl.appendChild(wrap);
    scrollToBottom();
  }

  /**
   * Handle user clicking a Quick Action
   * Note: "Iniciar proyecto" / "Start project" opens WhatsApp directly without simulating chat.
   */
  function handleQuickAction(action) {
    if (action.id === 'project') {
      window.open(OFFICIAL_WHATSAPP_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    // 1. Show user message
    appendUserMessage(action.label);

    // Remove previous quick action buttons container to keep chat clean
    const oldWraps = conversationEl.querySelectorAll('.bob-quick-actions-wrap');
    oldWraps.forEach(w => w.remove());

    // 2. Controlled UI response after brief 280ms transition
    showMicrotypingThen(() => {
      appendBobMessage(action.response, {
        id: action.id,
        ctaLabel: action.ctaLabel,
        ctaHref: action.ctaHref
      });
      // Offer quick actions again after a moment
      renderQuickActions();
    });
  }

  /**
   * Helper to retrieve or create cryptographically secure anonymous session ID in sessionStorage.
   * Uses Web Crypto crypto.randomUUID() primarily, with crypto.getRandomValues() as secure fallback.
   * Never uses PII (email, phone, name, IP) to build session IDs.
   */
  function getSessionId() {
    let sid = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
    if (!sid) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        sid = 'bob-' + crypto.randomUUID();
      } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        sid = 'bob-' + uuid;
      } else {
        sid = 'bob-session-' + Date.now();
      }
      sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sid);
    }
    return sid;
  }

  /**
   * Handle Free Text Input:
   * - If backendEnabled is true, calls POST /api/bob/chat with active session, language and in-memory history.
   * - Shows real sending/typing state ("Bob está pensando...") during HTTP call.
   * - Implements 25s AbortController timeout and friendly error handling.
   * - Prevents duplicate submissions while in-flight.
   * - If backend is disabled, runs static fallback.
   */
  function handleFreeTextInput(text) {
    if (!text || !text.trim() || isRequestInflight) return;
    const cleanText = text.trim().slice(0, 2000);

    // 1. Show user message
    appendUserMessage(cleanText);

    // Remove quick actions if visible
    const oldWraps = conversationEl.querySelectorAll('.bob-quick-actions-wrap');
    oldWraps.forEach(w => w.remove());

    const lang = bobLang || 'es';
    const t = I18N[lang] || I18N.es;

    // Backend-enabled live conversational path
    if (assistantConfig.backendEnabled) {
      isRequestInflight = true;
      const stopTyping = showPersistentTypingIndicator();

      // Disable input and send button while request is inflight
      if (composerInput) composerInput.disabled = true;
      const sendBtn = document.getElementById('bobComposerSendBtn');
      if (sendBtn) sendBtn.disabled = true;

      // Extract last 6 completed turns for ephemeral history (strictly user and assistant roles)
      const historyPayload = chatHistory.slice(-6).map(item => ({
        role: item.role === 'user' ? 'user' : 'assistant',
        content: item.content.slice(0, 2000)
      }));

      const payload = {
        message: cleanText,
        language: lang,
        session_id: getSessionId(),
        page: 'home',
        history: historyPayload
      };

      activeAbortController = new AbortController();
      const startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

      activeRequestTimer = setTimeout(() => {
        if (activeAbortController) {
          activeAbortController.abort('TIMEOUT');
        }
      }, assistantConfig.requestTimeoutMs);

      const baseUrl = assistantConfig.backendBaseUrl ? assistantConfig.backendBaseUrl.replace(/\/+$/, '') : '';
      const url = `${baseUrl}/api/bob/chat`;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: activeAbortController.signal
      })
      .then(async (response) => {
        if (activeRequestTimer) {
          clearTimeout(activeRequestTimer);
          activeRequestTimer = null;
        }
        stopTyping();
        isRequestInflight = false;
        if (composerInput) {
          composerInput.disabled = false;
          if (isOpen && window.innerWidth > 768) composerInput.focus();
        }
        if (sendBtn) sendBtn.disabled = false;

        if (response.ok) {
          const data = await response.json();
          const replyText = data.reply || t.fallbackResponse;

          // Record turn in ephemeral in-memory history
          chatHistory.push({ role: 'user', content: cleanText });
          chatHistory.push({ role: 'assistant', content: replyText });

          // Optional console debug mode via ?bob_debug=1 (zero secret exposure)
          try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('bob_debug') === '1' || urlParams.get('bob_debug') === 'true') {
              const dur = (typeof performance !== 'undefined') ? Math.round(performance.now() - startTime) : 0;
              console.log('[Bob Assistant Debug]', {
                durationMs: dur,
                provider: data.provider,
                source: data.source,
                sourcesCount: Array.isArray(data.sources) ? data.sources.length : 0
              });
            }
          } catch (_) {}

          // Display Bob grounded reply with server-owned citations (if rag source)
          const isRag = (data.source === 'rag');
          appendBobMessage(replyText, {
            sources: isRag ? data.sources : null
          });
        } else if (response.status === 429) {
          appendBobMessage(t.rateLimitError);
        } else {
          appendBobMessage(t.unavailableError, { showWhatsAppCta: true });
        }
        renderQuickActions();
      })
      .catch((err) => {
        if (activeRequestTimer) {
          clearTimeout(activeRequestTimer);
          activeRequestTimer = null;
        }
        stopTyping();
        isRequestInflight = false;
        if (composerInput) {
          composerInput.disabled = false;
          if (isOpen && window.innerWidth > 768) composerInput.focus();
        }
        if (sendBtn) sendBtn.disabled = false;

        const isTimeout = (err === 'TIMEOUT' || (err && err.name === 'AbortError'));
        if (isTimeout) {
          appendBobMessage(t.timeoutError);
        } else {
          appendBobMessage(t.unavailableError, { showWhatsAppCta: true });
        }
        renderQuickActions();
      });
      return;
    }

    // Static fallback path (Phase 11A.1 default when backendEnabled is false)
    showMicrotypingThen(() => {
      appendBobMessage(t.fallbackResponse);
      renderQuickActions();
    });
  }

  /**
   * Persistent typing indicator during active asynchronous backend requests
   */
  function showPersistentTypingIndicator() {
    if (!conversationEl) return () => {};

    const lang = bobLang || 'es';
    const typingLabel = (lang === 'en') ? I18N.en.typingText : I18N.es.typingText;

    const typingEl = document.createElement('div');
    typingEl.className = 'bob-msg-row is-bot';
    typingEl.id = 'bobBackendTyping';
    typingEl.setAttribute('role', 'status');
    typingEl.setAttribute('aria-live', 'polite');
    typingEl.innerHTML = `
      <div class="bob-msg-bot-avatar" aria-hidden="true">
        <img src="${BOB_ASSET_SRC}" alt="Bob">
      </div>
      <div class="bob-typing-bubble">
        <span class="bob-typing-label">${escapeHtml(typingLabel)}</span>
        <span class="bob-typing-dots" aria-hidden="true">
          <span class="bob-typing-dot"></span>
          <span class="bob-typing-dot"></span>
          <span class="bob-typing-dot"></span>
        </span>
      </div>
    `;

    conversationEl.appendChild(typingEl);
    scrollToBottom();

    return () => {
      const el = document.getElementById('bobBackendTyping');
      if (el) el.remove();
    };
  }

  /**
   * Micro-transitional state (300ms) without pretending AI inference
   */
  function showMicrotypingThen(callback) {
    if (!conversationEl) {
      callback();
      return;
    }

    const typingEl = document.createElement('div');
    typingEl.className = 'bob-msg-row is-bot';
    typingEl.id = 'bobTempTyping';
    typingEl.innerHTML = `
      <div class="bob-msg-bot-avatar" aria-hidden="true">
        <img src="${BOB_ASSET_SRC}" alt="Bob">
      </div>
      <div class="bob-typing-indicator" aria-label="Escribiendo">
        <span class="bob-typing-dot"></span>
        <span class="bob-typing-dot"></span>
        <span class="bob-typing-dot"></span>
      </div>
    `;

    conversationEl.appendChild(typingEl);
    scrollToBottom();

    setTimeout(() => {
      const el = document.getElementById('bobTempTyping');
      if (el) el.remove();
      callback();
    }, 320);
  }

  /**
   * Handle internal anchor navigation from Bob's CTAs
   */
  function handleCtaNavigation(e, href) {
    if (!href.startsWith('#')) return;
    e.preventDefault();

    const targetEl = document.querySelector(href);
    if (targetEl) {
      // Smooth scroll to section
      targetEl.scrollIntoView({ behavior: 'smooth' });

      // On mobile / small screens, close panel gracefully to reveal content
      if (window.innerWidth <= 768) {
        setPanelOpen(false);
      }
    }
  }

  /**
   * Set assistant language and initiate conversation
   */
  function setAssistantLanguage(lang, triggerGreeting = true) {
    bobLang = (lang === 'en') ? 'en' : 'es';
    sessionStorage.setItem(STORAGE_KEY_LANG, bobLang);
    sessionStorage.setItem(STORAGE_KEY_WELCOMED, 'true');
    hasWelcomed = true;

    updateHeaderLabels(bobLang);

    if (triggerGreeting) {
      // Clear welcome card
      if (conversationEl) conversationEl.innerHTML = '';

      const t = I18N[bobLang];
      showMicrotypingThen(() => {
        appendBobMessage(t.greetingIntro);
        renderQuickActions();
      });
    }

    // Dispatch Custom Event for external hooks
    try {
      window.dispatchEvent(new CustomEvent('bob:language-selected', {
        detail: { language: bobLang }
      }));
    } catch (_) {}
  }

  /**
   * Reset conversation back to welcome state
   */
  function resetConversation() {
    sessionStorage.removeItem(STORAGE_KEY_LANG);
    sessionStorage.removeItem(STORAGE_KEY_WELCOMED);
    sessionStorage.removeItem(STORAGE_KEY_SESSION_ID);
    bobLang = null;
    hasWelcomed = false;
    chatHistory = [];
    isRequestInflight = false;

    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch (_) {}
      activeAbortController = null;
    }
    if (activeRequestTimer) {
      clearTimeout(activeRequestTimer);
      activeRequestTimer = null;
    }
    if (composerInput) {
      composerInput.value = '';
      composerInput.disabled = false;
    }
    const sendBtn = document.getElementById('bobComposerSendBtn');
    if (sendBtn) sendBtn.disabled = false;

    updateHeaderLabels('es');
    renderWelcomeCard();

    try {
      window.dispatchEvent(new CustomEvent('bob:reset'));
    } catch (_) {}
  }

  /**
   * Open / Close Assistant Panel
   */
  function setPanelOpen(open) {
    isOpen = open;

    if (isOpen) {
      openTimestamp = Date.now();
      panelEl.classList.add('is-open');
      panelEl.setAttribute('aria-hidden', 'false');
      panelEl.setAttribute('aria-modal', 'true');
      launcherBtn.classList.add('is-open');
      launcherBtn.setAttribute('aria-expanded', 'true');
      launcherBtn.setAttribute('aria-label', (I18N[bobLang || 'es'] || I18N.es).launcherCloseAria);

      // Initialize conversation view if empty
      if (!conversationEl.children.length) {
        if (bobLang && hasWelcomed) {
          updateHeaderLabels(bobLang);
          appendBobMessage((I18N[bobLang] || I18N.es).greetingIntro);
          renderQuickActions();
        } else {
          renderWelcomeCard();
        }
      }

      // Accessible Focus
      setTimeout(() => {
        if (composerInput) composerInput.focus();
      }, 100);

      try {
        window.dispatchEvent(new CustomEvent('bob:open'));
      } catch (_) {}
    } else {
      panelEl.classList.remove('is-open');
      panelEl.setAttribute('aria-hidden', 'true');
      panelEl.setAttribute('aria-modal', 'false');
      launcherBtn.classList.remove('is-open');
      launcherBtn.setAttribute('aria-expanded', 'false');
      launcherBtn.setAttribute('aria-label', (I18N[bobLang || 'es'] || I18N.es).launcherOpenAria);

      // Return focus to launcher button
      launcherBtn.focus();

      try {
        window.dispatchEvent(new CustomEvent('bob:close'));
      } catch (_) {}
    }
  }

  /**
   * Setup Events & Keyboard Accessibility
   */
  function attachEvents() {
    // 1. Launcher toggle
    launcherBtn.addEventListener('click', () => {
      setPanelOpen(!isOpen);
    });

    // 2. Header close button
    const closeBtn = document.getElementById('bobCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        setPanelOpen(false);
      });
    }

    // 3. Header reset button
    const resetBtn = document.getElementById('bobResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetConversation();
      });
    }

    // 4. Keyboard Escape to close panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        setPanelOpen(false);
      }
    });

    // 5. Composer form submit
    composerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (isRequestInflight) return;
      const val = composerInput.value;
      if (!val || !val.trim()) return;

      // If user writes without having chosen language, default to current page lang
      if (!bobLang) {
        bobLang = getPageLang();
        sessionStorage.setItem(STORAGE_KEY_LANG, bobLang);
        sessionStorage.setItem(STORAGE_KEY_WELCOMED, 'true');
        hasWelcomed = true;
        updateHeaderLabels(bobLang);
      }

      composerInput.value = '';
      handleFreeTextInput(val);
    });

    // 6. Outside click to close if on mobile (with slight debounce to avoid closing on trigger)
    document.addEventListener('click', (e) => {
      if (!isOpen) return;
      if (Date.now() - openTimestamp < 300) return;
      if (window.innerWidth <= 768) {
        if (panelEl && launcherBtn && !panelEl.contains(e.target) && !launcherBtn.contains(e.target)) {
          setPanelOpen(false);
        }
      }
    });
  }

  /**
   * Initialization Routine
   */
  function init() {
    injectMarkup();
    bindElements();
    attachEvents();
    // Sync initial launcher labels with page language
    syncLauncherLabels();

    // Listen to global website language changes (e.g. language toggle on html[lang])
    try {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'lang') {
            syncLauncherLabels();
          }
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (_) {}

    // Verify window.BopContactBridge integrity
    if (window.BopContactBridge && typeof window.BopContactBridge.prefillFromBob === 'function') {
      // Bridge contract is active and preserved for Phase 11A.6
    }

    // Expose programmatic API on window for testing, accessibility & future phase extensions
    window.BobAssistant = {
      open: () => setPanelOpen(true),
      close: () => setPanelOpen(false),
      toggle: () => setPanelOpen(!isOpen),
      reset: () => resetConversation(),
      setLanguage: (lang) => setAssistantLanguage(lang, true),
      isOpen: () => isOpen,
      getLanguage: () => bobLang,
      getSessionId: () => getSessionId(),
      getConfig: () => Object.assign({}, assistantConfig),
      getHistory: () => chatHistory.slice(),
      isInflight: () => isRequestInflight
    };

    // Deep linking / test parameters: ?bob=open, ?bob_lang=es|en
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('bob_reset') === '1') {
        sessionStorage.removeItem(STORAGE_KEY_LANG);
        sessionStorage.removeItem(STORAGE_KEY_WELCOMED);
        bobLang = null;
        hasWelcomed = false;
      }
      const paramLang = urlParams.get('bob_lang');
      if (paramLang && (paramLang === 'es' || paramLang === 'en')) {
        setAssistantLanguage(paramLang, false);
        appendBobMessage((I18N[paramLang] || I18N.es).greetingIntro);
        renderQuickActions();
      }
      if (urlParams.get('bob') === 'open') {
        setPanelOpen(true);
      }
    } catch (_) {}
  }



  // Self-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
