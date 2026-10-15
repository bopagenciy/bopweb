/**
 * Grounded Fallback Policy
 * 
 * Generates transparent, deterministic fallback replies when retrieval produces
 * no matching chunks or when information is absent. Avoids model hallucination.
 */

export function getNoKnowledgeFallback(language = 'es') {
  if (language === 'en') {
    return 'I don’t have confirmed information about that in Bop Agencia’s knowledge base. I can help you contact the team if you’d like.';
  }
  return 'No tengo esa información confirmada en mi base de conocimiento de Bop Agencia. Si quieres, puedo ayudarte a contactar al equipo.';
}

export function getPriceFallback(language = 'es') {
  if (language === 'en') {
    return 'Projects at Bop Agencia are quoted based on their specific scope and technical requirements. Feel free to contact our team directly at bopagencia@gmail.com or via WhatsApp (+57 305 417 6606) for a tailored proposal.';
  }
  return 'Los proyectos en Bop Agencia se cotizan según su alcance y requerimientos técnicos específicos. Puedes comunicarte directamente con nuestro equipo en bopagencia@gmail.com o vía WhatsApp (+57 305 417 6606) para coordinar una propuesta a medida.';
}

export default {
  getNoKnowledgeFallback,
  getPriceFallback
};
