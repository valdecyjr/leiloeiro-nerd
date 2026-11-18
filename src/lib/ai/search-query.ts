import type { ApiMessage } from "@/domain/chat/types/chat";

// ponytail: até onde uma pergunta "se sustenta sozinha". Abaixo disso ("e o
// prazo?", "e para pessoa jurídica?") ela quase não tem assunto próprio, e o
// embedding dela cai longe de qualquer trecho da base. Acima, o usuário já
// descreveu o que quer; misturar mensagens antigas só arrastaria a busca para
// um tema que ele pode ter largado.
export const STANDALONE_MIN_LENGTH = 80;
// Quantas mensagens ANTERIORES do usuário entram para dar assunto à pergunta curta.
export const MAX_PREVIOUS_USER_MESSAGES = 2;
// Teto do texto que vai para a API de embeddings (a mensagem atual nunca é cortada).
export const MAX_SEARCH_TEXT_LENGTH = 600;

/**
 * Monta o texto usado na busca semântica (RAG) a partir da conversa.
 *
 * Sem chamada extra ao modelo: é só uma regra local, para não somar latência
 * nem custo a cada mensagem. Pergunta longa busca sozinha. Pergunta curta
 * ganha, antes dela, as últimas mensagens do USUÁRIO — as respostas do
 * assistente ficam de fora, porque são longas e dominariam o embedding.
 *
 * `messages` vem de `sanitizeMessages` da rota: já limitado e com a última
 * mensagem do usuário.
 */
export function buildSearchQuery(messages: ApiMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return "";

  const current = last.content.trim();
  if (current.length >= STANDALONE_MIN_LENGTH) return current;

  const previous = messages
    .slice(0, -1)
    .filter((m) => m.role === "user")
    .slice(-MAX_PREVIOUS_USER_MESSAGES)
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (previous.length === 0) return current;

  const room = Math.max(0, MAX_SEARCH_TEXT_LENGTH - current.length - 1);
  // Do fim para o começo: as mensagens mais recentes são as que mais importam.
  const context = previous.join(" ").slice(-room).trim();
  return context ? `${context} ${current}` : current;
}
