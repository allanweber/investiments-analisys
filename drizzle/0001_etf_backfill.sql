-- Data migration (runs once with `drizzle-kit migrate`).
-- Add missing "ETF" type + default questions for existing users. Idempotent.

INSERT INTO "investment_type" ("id", "user_id", "name", "sort_order")
SELECT gen_random_uuid(), u."id", 'ETF', (SELECT COALESCE(MAX(it.sort_order), -1) + 1 FROM "investment_type" it WHERE it.user_id = u."id")
FROM "user" u
WHERE NOT EXISTS (SELECT 1 FROM "investment_type" t WHERE t.user_id = u."id" AND t.name = 'ETF');
--> statement-breakpoint
INSERT INTO "question" ("id", "user_id", "investment_type_id", "prompt", "sort_order", "active")
SELECT gen_random_uuid(), it.user_id, it.id, p.prompt, p.ord, true
FROM "investment_type" it
INNER JOIN (
  VALUES
  (0, 'O ETF indica de forma clara o índice de referência e a política de replicação (física ou sintética) no material oficial?'),
  (1, 'A taxa de gestão (e custos totais) é baixa em comparação com ETFs do mesmo universo na mesma bolsa?'),
  (2, 'A liquidez média e o spread na negociação são compatíveis com o tamanho da sua posição e com a possibilidade de sair com agilidade?'),
  (3, 'O tracking error histórico em relação ao benchmark é aceitável para o seu padrão?'),
  (4, 'A carteira (número de ativos e pesos) oferece a diversificação que você busca, sem concentração exagerada em poucos papéis?'),
  (5, 'Tema, região ou fator (ex.: emergentes, S&P, small caps) alinha-se à sua estratégia de alocação, e não só a um modismo de curto prazo?'),
  (6, 'A exposição cambial do fundo, se existir, corresponde ao que você intencionalmente assumiu (hedge ou não)?'),
  (7, 'Você consegue explicar em uma frase o papel deste ETF na sua carteira (não é só "comprei porque subiu")?'),
  (8, 'A política de dividendos (distribuição x acumulação) e o tratamento de IR no seu caso estão claros para você?'),
  (9, 'A reguladora, a administradora e o local de cotação são reconhecidos e acessíveis (ex.: CVM, B3, ou equivalente no exterior)?')
) AS p(ord, prompt) ON true
WHERE it.name = 'ETF'
AND NOT EXISTS (
  SELECT 1 FROM "question" q
  WHERE q.investment_type_id = it.id AND q.prompt = p.prompt
);
