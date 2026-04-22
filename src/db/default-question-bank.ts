/**
 * Default yes/no question copy per seeded investment type name (pt-BR).
 * Keys must match exactly `investment_type.name` after signup seed.
 */

export const DEFAULT_QUESTIONS_ETF = [
  'O ETF indica de forma clara o índice de referência e a política de replicação (física ou sintética) no material oficial?',
  'A taxa de gestão (e custos totais) é baixa em comparação com ETFs do mesmo universo na mesma bolsa?',
  'A liquidez média e o spread na negociação são compatíveis com o tamanho da sua posição e com a possibilidade de sair com agilidade?',
  'O tracking error histórico em relação ao benchmark é aceitável para o seu padrão?',
  'A carteira (número de ativos e pesos) oferece a diversificação que você busca, sem concentração exagerada em poucos papéis?',
  'Tema, região ou fator (ex.: emergentes, S&P, small caps) alinha-se à sua estratégia de alocação, e não só a um modismo de curto prazo?',
  'A exposição cambial do fundo, se existir, corresponde ao que você intencionalmente assumiu (hedge ou não)?',
  'Você consegue explicar em uma frase o papel deste ETF na sua carteira (não é só "comprei porque subiu")?',
  'A política de dividendos (distribuição x acumulação) e o tratamento de IR no seu caso estão claros para você?',
  'A reguladora, a administradora e o local de cotação são reconhecidos e acessíveis (ex.: CVM, B3, ou equivalente no exterior)?',
] as const

export const DEFAULT_QUESTIONS_ACOES = [
  'ROE historicamente maior que 5%? (Considere anos anteriores).',
  'Tem um crescimento de receitas (Ou lucro) superior a 5% nos últimos 5 anos?',
  'A empresa tem um histórico de pagamento de dividendos?',
  'A empresa investe amplamente em pesquisa e inovação? Setor Obsoleto = SEMPRE NÃO',
  'Tem mais de 30 anos de mercado? (Fundação)',
  'É líder nacional ou mundial no setor em que atua? (Só considera se for LÍDER, primeira colocada)',
  'O setor em que a empresa atua tem mais de 100 anos?',
  'A empresa é uma BLUE CHIP?',
  'A empresa tem uma boa gestão? Histórico de corrupção = SEMPRE NÃO',
  'É livre de controle ESTATAL ou concentração em cliente único?',
  'Div. Líquida/EBITDA é menor que 2 nos últimos 5 anos?',
  'Bom Dividend yield',
] as const

export const DEFAULT_QUESTIONS_FII_REIT = [
  'Os imóveis desse Fundo Imobiliário estão localizados em regiões nobres?',
  'As propriedades são novas e não consomem manutenção excessiva?',
  'O fundo imobiliário está negociado abaixo do P/VP 1? (Acima de 1,5, eu descarto o investimento em qualquer hipótese)',
  'Distribui dividendos a mais de 4 anos consistentemente?',
  'Não é dependente de um único inquilino ou imóvel?',
  'O Yield está dentro ou acima da média para fundos imobiliários do mesmo tipo?',
  'VPA vs Valor da cota, VPA maior que valor da cota',
  'Taxa de administração: perto ou abaixo de 1',
  'Patrimônio Líquido subindo nos ultimos 10 (ou 5) anos',
  'Alavancagem financeira: mais baixa possivel - menor de 10% ou pouco acima disso',
  'Fundo tijolo: vacância zero ou perto de zero',
] as const

export const DEFAULT_QUESTIONS_RENDA_FIXA = [
  'O emissor (ou título soberano) e o prazo do título são compatíveis com o risco de crédito e o horizonte que você aceita?',
  'A liquidez e o vencimento permitem atender necessidades de caixa sem depender de resgate prematuro indesejado?',
  'A remuneração (CDI, IPCA+, prefixada) e eventuais taxas estão claras antes de investir?',
  'Há proteção ou lastro adequados ao produto (ex.: limites do FGC quando aplicável, ou garantias em debêntures)?',
] as const

export const DEFAULT_QUESTIONS_CRIPTO = [
  'Você compreende e aceita volatilidade alta e riscos regulatórios e operacionais deste ativo?',
  'Consegue explicar, em linhas gerais, por que este ativo ou protocolo faz parte da sua estratégia (além de especulação de curto prazo)?',
  'A posição respeita um limite de patrimônio que você definiu para exposição de alto risco?',
  'Custódia e acesso estão razoavelmente seguros (exchange/carteira confiáveis, 2FA, backup de credenciais)?',
] as const

export const DEFAULT_QUESTIONS_RESERVA_VALOR = [
  'O instrumento tende a preservar poder de compra ou papel de proteção nos cenários para os quais você o reserva?',
  'Custos de aquisição, custódia e impostos são aceitáveis para um ativo de reserva, não de trading?',
  'Você evita concentração excessiva num único formato de reserva (ex.: uma única moeda, um único metal, um único emissor)?',
  'Consegue converter em caixa ou equivalente líquido no prazo que uma urgência exigiria?',
] as const

const PACK_BY_TYPE_NAME: Record<string, readonly string[]> = {
  Ações: DEFAULT_QUESTIONS_ACOES,
  'Ações internacionais': DEFAULT_QUESTIONS_ACOES,
  ETF: DEFAULT_QUESTIONS_ETF,
  FIIs: DEFAULT_QUESTIONS_FII_REIT,
  REITs: DEFAULT_QUESTIONS_FII_REIT,
  'Renda fixa': DEFAULT_QUESTIONS_RENDA_FIXA,
  Cripto: DEFAULT_QUESTIONS_CRIPTO,
  'Reserva de valor': DEFAULT_QUESTIONS_RESERVA_VALOR,
}

/** Trim and collapse internal whitespace for deduplication (restore defaults). */
export function normalizeQuestionPrompt(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function hasDefaultQuestionPackForTypeName(typeName: string): boolean {
  return (PACK_BY_TYPE_NAME[typeName]?.length ?? 0) > 0
}

/** Prompts stored in DB and used for seed / restore (canonical spacing). */
export function getDefaultQuestionsForTypeName(typeName: string): string[] {
  const pack = PACK_BY_TYPE_NAME[typeName]
  if (!pack) return []
  return pack.map((p) => normalizeQuestionPrompt(p))
}
