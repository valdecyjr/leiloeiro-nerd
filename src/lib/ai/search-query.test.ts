import { describe, expect, it } from "vitest";
import type { ApiMessage } from "@/domain/chat/types/chat";
import {
  MAX_PREVIOUS_USER_MESSAGES,
  MAX_SEARCH_TEXT_LENGTH,
  STANDALONE_MIN_LENGTH,
  buildSearchQuery,
} from "./search-query";

const u = (content: string): ApiMessage => ({ role: "user", content });
const a = (content: string): ApiMessage => ({ role: "assistant", content });

describe("buildSearchQuery", () => {
  it("primeira pergunta: usa só ela", () => {
    expect(buildSearchQuery([u("Como faço para participar?")])).toBe("Como faço para participar?");
  });

  it("pergunta de acompanhamento curta ganha o assunto das mensagens anteriores do usuário", () => {
    const query = buildSearchQuery([
      u("Como funciona o pagamento do item que ganhei?"),
      a("Você paga via PIX em até 3 dias..."),
      u("e o prazo?"),
    ]);
    expect(query).toBe("Como funciona o pagamento do item que ganhei? e o prazo?");
  });

  it("não inclui respostas do assistente (são longas e dominariam o embedding)", () => {
    const query = buildSearchQuery([u("Como dar um lance?"), a("RESPOSTA LONGA DO ASSISTENTE"), u("e se eu errar?")]);
    expect(query).not.toContain("RESPOSTA LONGA");
  });

  it("pergunta longa e completa busca sozinha, sem arrastar o assunto antigo", () => {
    const longa = "Quais são as regras para cancelar um item que eu cadastrei e que ainda não recebeu nenhum lance?";
    expect(longa.length).toBeGreaterThanOrEqual(STANDALONE_MIN_LENGTH);
    expect(buildSearchQuery([u("Como funciona o pagamento?"), a("..."), u(longa)])).toBe(longa);
  });

  it("usa no máximo as últimas mensagens do usuário", () => {
    const query = buildSearchQuery([u("um"), a("x"), u("dois"), a("x"), u("três"), a("x"), u("e agora?")]);
    expect(MAX_PREVIOUS_USER_MESSAGES).toBe(2);
    expect(query).toBe("dois três e agora?");
  });

  it("limita o tamanho do texto sem cortar a pergunta atual", () => {
    const antiga = "a".repeat(2000);
    const query = buildSearchQuery([u(antiga), a("x"), u("e o prazo?")]);
    expect(query.length).toBeLessThanOrEqual(MAX_SEARCH_TEXT_LENGTH);
    expect(query.endsWith("e o prazo?")).toBe(true);
  });

  it("ignora mensagens anteriores vazias", () => {
    expect(buildSearchQuery([u("   "), a("x"), u("e o prazo?")])).toBe("e o prazo?");
  });

  it("lista vazia ou que não termina no usuário devolve texto vazio", () => {
    expect(buildSearchQuery([])).toBe("");
    expect(buildSearchQuery([u("oi"), a("olá")])).toBe("");
  });
});
