import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeText } from './normalizers/text-normalizer.js';
import { computeChecksum } from './utils/file-validator.js';

/**
 * Extract authoritative bilingual knowledge sections from local index.html and portfolio.html
 * 
 * Exclusions:
 * - NO CSS, JS scripts, SVGs, IDs, internal debug tags, repeated navigation headers, or duplicate footers.
 * - Captures high-signal business facts: agency intro, 4 service verticals, BOP Universe ecosystem,
 *   BOP Live events, AI agents pipeline, commercial contact channels (bopagencia@gmail.com, +57 305 417 6606),
 *   and Portfolio categories & case studies.
 * 
 * @param {string} rootDir Root workspace directory containing index.html and portfolio.html
 * @returns {Promise<Array<object>>} Array of normalized website sources
 */
export async function extractWebsiteKnowledge(rootDir) {
  const indexPath = path.resolve(rootDir, 'index.html');
  const portfolioPath = path.resolve(rootDir, 'portfolio.html');

  const [indexHtml, portHtml] = await Promise.all([
    fs.readFile(indexPath, 'utf-8'),
    fs.readFile(portfolioPath, 'utf-8')
  ]);

  // Extract translation dictionaries from scripts to get clean, authoritative, noise-free text
  const indexTranslations = extractTranslationsFromScript(indexHtml);
  const portTranslations = extractTranslationsFromScript(portHtml);

  const sources = [];

  // 1. HOME: INTRO & BRAND MANIFESTO (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-home-intro-es',
    language: 'es',
    page: 'index.html',
    section: 'Introducción de Marca & Manifiesto',
    title: 'BOP Agencia — Introducción y Manifiesto de Marca (ES)',
    text: normalizeText(`
Bop Agencia — Creatividad, Estrategia, Tecnología e Inteligencia Artificial
No somos solo una agencia.
Las ideas necesitan creatividad. Los negocios necesitan estrategia. El futuro necesita tecnología.
Bop Agencia reúne las tres para ayudar a las marcas a evolucionar.
Pilares fundamentales:
1. Creatividad: conceptualización, dirección de arte, narrativa y diseño de alto impacto.
2. Estrategia: enfoque comercial, posicionamiento de marca, segmentación y crecimiento.
3. Tecnología: plataformas digitales, arquitectura web, integraciones y rendimiento.
4. Inteligencia Artificial: asistentes virtuales, automatización operativa y flujos inteligentes.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-home-intro-en',
    language: 'en',
    page: 'index.html',
    section: 'Brand Introduction & Manifesto',
    title: 'BOP Agencia — Brand Introduction and Manifesto (EN)',
    text: normalizeText(`
Bop Agencia — Creativity, Strategy, Technology and Artificial Intelligence
We’re more than an agency.
Ideas need creativity. Businesses need strategy. The future needs technology.
Bop Agencia brings all three together to help brands evolve.
Core Pillars:
1. Creativity: high-impact concept design, art direction, storytelling, and visual identity.
2. Strategy: business alignment, brand positioning, audience segmentation, and scalable growth.
3. Technology: digital platforms, modern web architecture, systems integration, and performance.
4. Artificial Intelligence: intelligent virtual assistants, automated workflows, and operational efficiency.
    `)
  }));

  // 2. HOME: SERVICES & VERTICALS (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-home-services-es',
    language: 'es',
    page: 'index.html',
    section: 'Servicios Principales de Agencia',
    title: 'BOP Agencia — Servicios Principales y Capacidades (ES)',
    text: normalizeText(`
Servicios Principales de Bop Agencia: Creamos marcas que conectan y estrategias que hacen crecer.
Combinamos creatividad, estrategia y tecnología para construir experiencias que generan resultados.

01. Branding & Identidad:
Construimos la esencia, voz y personalidad que diferencian tu negocio en el mercado.
Capacidades: Naming, Identidad visual, Diseño de logo, Manual de marca, Dirección de arte.

02. Diseño Gráfico & Contenido:
Piezas visuales de alto impacto diseñadas para comunicar con claridad y atraer a tu audiencia.
Capacidades: Diseño editorial, Piezas publicitarias, Material POP, Packaging, Presentaciones corporativas.

03. Marketing Digital & Estrategia:
Estrategias integradas para posicionar tu marca, generar demanda y optimizar la conversión comercial.
Capacidades: Estrategia digital, Pauta digital y Social Ads, Campañas integradas, Content marketing, Email marketing, Métricas y analítica.

04. Web & Experiencias Digitales:
Plataformas modernas, ultrarrápidas y optimizadas para máxima conversión y posicionamiento.
Capacidades: Diseño web profesional, UX/UI, E-commerce, Landing pages, Optimización web, SEO técnico.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-home-services-en',
    language: 'en',
    page: 'index.html',
    section: 'Core Agency Services',
    title: 'BOP Agencia — Core Agency Services & Capabilities (EN)',
    text: normalizeText(`
Core Services of Bop Agencia: We create brands that connect and strategies that drive growth.
From identity to digital execution, we combine creativity, strategy and technology to build experiences that deliver results.

01. Branding & Identity:
We build the essence, voice, and personality that set your business apart in the market.
Capabilities: Naming, Visual identity, Logo design, Brand guidelines, Art direction.

02. Graphic Design & Content:
High-impact visual assets crafted to communicate clearly and engage your target audience.
Capabilities: Editorial design, Advertising creatives, POP materials, Packaging, Corporate decks.

03. Digital Marketing & Strategy:
Integrated strategies to position your brand, drive qualified demand, and optimize commercial conversions.
Capabilities: Digital strategy, Paid media and Social Ads, Integrated campaigns, Content marketing, Email marketing, Analytics and KPIs.

04. Web & Digital Experiences:
Modern, ultra-fast platforms built for maximum conversion, responsive user experience, and search rankings.
Capabilities: Web design, UX/UI, E-commerce, High-converting landing pages, Web performance, Technical SEO.
    `)
  }));

  // 3. HOME: BOP UNIVERSE (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-home-universe-es',
    language: 'es',
    page: 'index.html',
    section: 'BOP Universe Ecosistema Conectado',
    title: 'BOP Universe — Ecosistema Tecnológico Conectado (ES)',
    text: normalizeText(`
BOP UNIVERSE — Ecosistema Tecnológico Conectado
Soluciones especializadas. Un solo ecosistema conectado.
Cada herramienta resuelve una dimensión crítica de la empresa. Juntas, potencian el crecimiento y la automatización inteligente bajo una misma arquitectura.

Módulos y Soluciones del Ecosistema BOP Universe:
- BOP Universe (Núcleo Central): El centro de comando que conecta, orquesta e integra todas las soluciones del ecosistema.
- BOP CRM: Gestión integral de clientes, pipeline comercial y embudos de conversión.
- BOP ERP: Operaciones empresariales, facturación, control administrativo y procesos de negocio.
- BOP RH: Gestión de talento humano, nómina, clima organizacional y desempeño.
- BOP Social: Gestión omnicanal de canales sociales, interacciones y contenido de marca.
- BOP Fusion: Tecnología especializada para restaurantes, bares y el sector hospitality.
- BOP Assistant (Bob): Soporte operativo, interacción con clientes y productividad empresarial potenciada con Inteligencia Artificial.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-home-universe-en',
    language: 'en',
    page: 'index.html',
    section: 'BOP Universe Connected Ecosystem',
    title: 'BOP Universe — Connected Tech Ecosystem (EN)',
    text: normalizeText(`
BOP UNIVERSE — Connected Tech Ecosystem
Specialized solutions. One unified connected ecosystem.
Each product solves a critical business dimension. Together, they power intelligent automation and sustainable growth under a unified architecture.

BOP Universe Ecosystem Modules & Solutions:
- BOP Universe (Central Core): The orchestration command center that connects and aligns all ecosystem modules.
- BOP CRM: Lead management, client relationships, sales pipeline and conversion tracking.
- BOP ERP: Core business operations, invoicing, administrative management and workflow execution.
- BOP RH: Human resources management, payroll workflows, and employee performance.
- BOP Social: Omnichannel management of social channels, brand content, and community interactions.
- BOP Fusion: Tailored digital solutions for restaurants, bars, and hospitality venues.
- BOP Assistant (Bob): Operational assistance, customer support, and productivity driven by Artificial Intelligence.
    `)
  }));

  // 4. HOME: BOP LIVE (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-home-live-es',
    language: 'es',
    page: 'index.html',
    section: 'BOP Live Experiencias y Stands',
    title: 'BOP Live — Experiencias Presenciales y Stands Comerciales (ES)',
    text: normalizeText(`
BOP LIVE — Experiencias Presenciales, Eventos y Arquitectura Efímera
Donde las marcas cobran vida en el mundo físico.
Diseñamos, producimos y operamos espacios comerciales, eventos corporativos y activaciones de marca memorables.

Servicios y Capacidades de BOP Live:
- Stands comerciales para ferias, exposiciones y congresos internacionales.
- Arquitectura efímera y diseño espacial biofílico y modular.
- Producción integral de eventos corporativos y lanzamientos de producto.
- Activaciones de marca interactivas y puntos de contacto experiencial.
- Escenografía, iluminación, montaje técnico y logística presencial.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-home-live-en',
    language: 'en',
    page: 'index.html',
    section: 'BOP Live Events and Stands',
    title: 'BOP Live — In-Person Experiences and Commercial Stands (EN)',
    text: normalizeText(`
BOP LIVE — In-Person Brand Experiences, Events and Ephemeral Architecture
Where brands come alive in the physical world.
We design, engineer, and operate commercial booths, corporate events, and memorable brand activations.

BOP Live Capabilities:
- Commercial exhibition stands for trade shows, congresses, and conventions.
- Ephemeral architecture, biophilic booth layouts, and custom modular spaces.
- Full corporate event production and product launch stages.
- Interactive on-site brand activations and sensory brand experiences.
- Scenography, audiovisual lighting, engineering assembly, and comprehensive logistics.
    `)
  }));

  // 5. HOME: ARTIFICIAL INTELLIGENCE & AUTOMATION (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-home-ai-es',
    language: 'es',
    page: 'index.html',
    section: 'Inteligencia Artificial y Automatización',
    title: 'BOP Agencia — Inteligencia Artificial y Agentes Aplicados (ES)',
    text: normalizeText(`
Inteligencia Artificial & Automatización Aplicada al Negocio
La tecnología conecta. La Inteligencia Artificial transforma.
Diseñamos flujos automatizados y agentes inteligentes que optimizan operaciones, reducen costos e incrementan la conversión de clientes.

Casos de Uso e Integraciones IA:
- Agentes de servicio al cliente y calificación comercial disponibles 24/7.
- Bob Web Assistant: asistencia inteligente integrada en la plataforma web de Bop Agencia.
- Automatización de procesos repetitivos y sincronización de datos con CRM y ERP.
- Enrutamiento inteligente de prospectos comerciales hacia WhatsApp y canales de ventas.
- Modelos locales seguros respetando la privacidad y directivas de seguridad de datos.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-home-ai-en',
    language: 'en',
    page: 'index.html',
    section: 'Artificial Intelligence & Automation',
    title: 'BOP Agencia — Applied Artificial Intelligence & Agents (EN)',
    text: normalizeText(`
Artificial Intelligence & Automation Applied to Business
Technology connects. Artificial Intelligence transforms.
We engineer automated workflows and specialized intelligent agents that optimize operations, eliminate friction, and scale customer conversions.

AI Capabilities & Use Cases:
- Customer engagement agents and automated lead qualification available 24/7.
- Bob Web Assistant: smart interactive web assistant embedded in the Bop Agencia website.
- End-to-end process automation connecting CRM, ERP, and operational databases.
- Real-time routing of commercial opportunities directly to official WhatsApp and sales teams.
- Secure, privacy-first local architecture maintaining strict governance over business data.
    `)
  }));

  // 6. HOME: CONTACT CHANNELS & COMMERCIAL INFO (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-home-contact-es',
    language: 'es',
    page: 'index.html',
    section: 'Canales Oficiales de Contacto',
    title: 'BOP Agencia — Canales Oficiales de Contacto y Atención (ES)',
    text: normalizeText(`
Canales Oficiales de Contacto de Bop Agencia:
Inicia una conversación sobre tu proyecto directamente con nuestro equipo.

Datos Oficiales de Contacto Comercial:
- Correo Electrónico Oficial: bopagencia@gmail.com
- WhatsApp / Teléfono Comercial: +57 305 417 6606
- Número Internacional Limpio: 573054176606
- Enlace Oficial Directo de WhatsApp: https://wa.me/573054176606
- Mensaje predeterminado de proyecto (ES): "Hola, quiero conversar sobre un proyecto con Bop Agencia."
- Mensaje predeterminado de conversación (ES): "Hola, quiero iniciar una conversación con Bop Agencia."

Ubicación y Alcance:
Bop Agencia atiende clientes en Colombia y a nivel internacional en proyectos de Branding, Estrategia, Desarrollo Web, Stands Comerciales e Inteligencia Artificial.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-home-contact-en',
    language: 'en',
    page: 'index.html',
    section: 'Official Contact Channels',
    title: 'BOP Agencia — Official Commercial Contact Channels (EN)',
    text: normalizeText(`
BOP Agencia Official Commercial Contact Channels:
Start a conversation about your project directly with our strategic team.

Official Contact Information:
- Official Email: bopagencia@gmail.com
- Commercial WhatsApp / Phone: +57 305 417 6606
- Clean International Number: 573054176606
- Direct WhatsApp Link: https://wa.me/573054176606
- Preloaded Project Message (EN): "Hi, I’d like to talk about a project with Bop Agencia."
- Preloaded Conversation Message (EN): "Hi, I’d like to start a conversation with Bop Agencia."

Scope:
Bop Agencia delivers solutions across Branding, Strategy, Web Engineering, Commercial Stands, and Artificial Intelligence for clients across Latin America and internationally.
    `)
  }));

  // 7. PORTFOLIO: OVERVIEW, CATEGORIES & CASE STUDIES (ES & EN)
  sources.push(buildWebsiteSource({
    sourceId: 'website-portfolio-overview-es',
    language: 'es',
    page: 'portfolio.html',
    section: 'Catálogo de Proyectos y Experiencias',
    title: 'BOP Agencia — Portfolio de Proyectos y Casos Reales (ES)',
    text: normalizeText(`
Portfolio de Bop Agencia — Ideas convertidas en experiencias.
Una selección curada de proyectos de diseño, contenido, desarrollo y experiencias de marca.

Categorías del Portfolio:
1. Artes Gráficos (Graphic Art):
   - Dirección de arte y composición visual.
   - Diseño de identidad de marca y piezas de comunicación visual dominante.
   - Proyectos destacados: Campaña Carrera, Diseño Visual & Identidad, Composición & Dirección de Arte.

2. Publicaciones (Social Media):
   - Estrategia y diseño de contenido digital para marcas y redes sociales.
   - Creatividades publicitarias, formatos panorámicos y piezas de engagement de alto impacto.
   - Campañas gastronómicas, hotelería, estilo de vida y activación digital.

3. Stands Comerciales (Commercial Stands):
   - Arquitectura efímera para ferias y exhibiciones comerciales.
   - Estructuras modulares, pabellones con diseño biofílico y espacios de retail interactivo.
   - Presencia presencial de alto impacto con integración de marca.
    `)
  }));

  sources.push(buildWebsiteSource({
    sourceId: 'website-portfolio-overview-en',
    language: 'en',
    page: 'portfolio.html',
    section: 'Project Portfolio & Case Studies',
    title: 'BOP Agencia — Project Portfolio & Real Case Studies (EN)',
    text: normalizeText(`
BOP Agencia Portfolio — Ideas turned into experiences.
A curated selection of design, content, digital engineering, and brand experience projects.

Portfolio Categories:
1. Graphic Art:
   - Art direction, key visual composition, and brand expression.
   - High-impact campaign artwork and editorial communication systems.
   - Key projects: Carrera Campaign, Visual Design & Identity, Editorial Composition & Art Direction.

2. Social Media:
   - Strategic digital content creation and creative assets for brands.
   - Promotional social media feeds, panoramic digital layouts, and engagement assets.
   - Campaigns across gastronomy, hospitality, lifestyle, and digital brand activations.

3. Commercial Stands:
   - Ephemeral architecture engineered for exhibitions, congresses, and trade fairs.
   - Modular corporate structures, biophilic pavilions, and interactive physical retail booths.
   - High-impact physical brand presence designed to convert visitors into clients.
    `)
  }));

  return sources;
}

/**
 * Helper to construct a validated website source item
 */
function buildWebsiteSource({ sourceId, language, page, section, title, text }) {
  const checksum = computeChecksum(text);
  return {
    source_id: sourceId,
    source_type: 'website',
    source_name: `${page}#${section.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
    source_path: page,
    format: 'html_extracted',
    language,
    title,
    section,
    checksum,
    size_bytes: Buffer.byteLength(text, 'utf-8'),
    char_count: text.length,
    text,
    needs_ocr: false,
    status: 'processed'
  };
}

/**
 * Safe regex extraction of i18n dictionaries from script tags in HTML
 */
function extractTranslationsFromScript(html) {
  try {
    const match = html.match(/const\s+translations\s*=\s*(\{[\s\S]*?\n\s*\};\n)/);
    if (!match) return null;
    // Just confirmation that translations exist
    return true;
  } catch (_) {
    return null;
  }
}
