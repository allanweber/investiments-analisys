/**
 * UI copy (pt-BR). Default locale module — swap or compose for i18n later.
 */
export const ptBR = {
  investments: {
    createTypeFirst: 'Crie primeiro um tipo em Tipos de investimento.',
    bulkMaxLines:
      'No máximo 100 nomes por envio. Foram consideradas apenas as primeiras 100 linhas.',
    bulkNeedNames: 'Indique pelo menos um nome (um por linha).',
    bulkInvalidType: 'Tipo inválido.',
    bulkNoValidNames: 'Nenhum nome válido para criar.',
    typeChangeBlocked:
      'Não é possível mudar o tipo: já existem respostas. Crie um novo investimento.',
    invalidType: 'Tipo inválido.',
    deleteConfirm: (name: string) => `Excluir o investimento "${name}"?`,
  },
  types: {
    deleteConfirm: (label: string) =>
      `Excluir o tipo "${label}"? Só é possível se não tiver perguntas nem investimentos.`,
    deleteBlockedQuestions:
      'Não é possível excluir: existem perguntas neste tipo.',
    deleteBlockedInvestments:
      'Não é possível excluir: existem investimentos neste tipo.',
  },
  questions: {
    restoreConfirm:
      'Adicionar perguntas padrão em falta? Nada será removido nem sobrescrito.',
    restoreNoPack: 'Este tipo não tem conjunto padrão de perguntas.',
    restoreFailed: 'Não foi possível restaurar.',
    restoreNone: 'Nada a restaurar: todas as perguntas padrão já existem.',
    restoreAdded: (n: number) =>
      `${n} pergunta(s) padrão adicionada(s).`,
    deleteConfirm:
      'Excluir esta pergunta? Se existirem respostas em investimentos, a exclusão será bloqueada.',
    deleteBlocked:
      'Não é possível excluir: existem respostas. Desative a pergunta em vez de excluí-la.',
  },
  scoring: {
    legend:
      'Sim = +1 · Não = −1 · Não respondida = 0 (não entra na soma)',
  },
} as const

export type Messages = typeof ptBR
