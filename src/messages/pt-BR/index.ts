/**
 * Full pt-BR UI copy. Aggregated for `#/messages` — add other locales beside this later.
 */

const PRODUCT_BRAND = 'The Financial Architect' as const
const DASHBOARD_FOOTER_LEDGER = '— High-Fidelity Ledger' as const

const core = {
  meta: {
    htmlLang: 'pt-BR',
    locale: 'pt-BR',
  },
  devtools: {
    /** Dev-only panel label; kept translatable for consistency */
    tanStackRouter: 'TanStack Router',
  },
  common: {
    admin: 'Admin',
    crumbTipos: 'Tipos',
    crumbInvestimentos: 'Investimentos',
    crumbPontuacao: 'Pontuação',
    crumbPerguntas: 'Perguntas',
    labelNome: 'Nome',
    labelOrdem: 'Ordem',
    labelTipo: 'Tipo',
    labelTexto: 'Texto',
    labelAtiva: 'Ativa',
    labelPontos: 'Pontos',
    labelPosicao: 'Posição',
    labelAcoes: 'Ações',
    labelNomes: 'Nomes',
    labelTipoInvestimento: 'Tipo de investimento',
    labelRespAtivasShort: 'Resp. / ativas',
    labelRespondidasAtivas: 'Respondidas / ativas',
    labelNovaPergunta: 'Nova pergunta',
    labelNovoTipo: 'Novo tipo',
    yes: 'Sim',
    no: 'Não',
    statusAtiva: 'Ativa',
    statusInativa: 'Inativa',
    save: 'Salvar',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Excluir',
    saving: 'Salvando…',
    restoring: 'A restaurar…',
    wait: 'Aguarde',
    pontuar: 'Pontuar',
    scorePtsAbbrev: (n: number) => `${n} pts`,
    linesBadge: (n: number) =>
      `${n} linha${n === 1 ? '' : 's'}`,
    ordinalSuffix: 'º',
    dash: '—',
    loading: 'A carregar…',
  },
  shell: {
    brand: PRODUCT_BRAND,
    navInicio: 'Início',
    navInvestimentos: 'Investimentos',
    navInvestimentosShort: 'Invest',
    navTiposLong: 'Tipos de Investimento',
    navTiposShort: 'Tipos',
    navCarteira: 'Carteira',
    newInvestment: 'Novo investimento',
  },
  theme: {
    buttonAuto: 'Auto',
    buttonDark: 'Escuro',
    buttonLight: 'Claro',
    ariaAuto:
      'Tema: automático (sistema). Clique para mudar para tema claro.',
    ariaResolved: (mode: 'dark' | 'light') =>
      `Tema: ${mode === 'dark' ? 'escuro' : 'claro'}. Clique para mudar.`,
  },
  headerUser: {
    signOut: 'Sair',
    signIn: 'Entrar',
    userAvatarAlt: (name: string) => `Foto de perfil de ${name}`,
    userAvatarAltAnonymous: 'Foto de perfil',
    avatarFallbackInitial: '?',
  },
  footer: {
    copyright: (year: number, holder: string) =>
      `© ${year} ${holder}. Todos os direitos reservados.`,
    builtWith: 'Feito com TanStack Start',
    followX: 'Seguir TanStack no X',
    github: 'Repositório TanStack no GitHub',
    /** Placeholder until product owner name is set */
    rightsHolder: PRODUCT_BRAND,
  },
  auth: {
    titleSignUp: 'Criar conta',
    titleSignIn: (brand: string) => `Entrar no ${brand}`,
    subtitle:
      'Acesse sua conta para gerenciar seu patrimônio com precisão editorial.',
    google: 'Google',
    dividerEmail: 'Ou use seu e-mail',
    labelName: 'Nome',
    labelEmail: 'E-mail',
    labelPassword: 'Senha',
    placeholderEmail: 'nome@exemplo.com',
    placeholderPassword: '••••••••',
    errorSignUp: 'Falha no cadastro',
    errorEmailAlreadyRegistered:
      'Este e-mail já está cadastrado. Entre com sua senha ou use “Esqueci a senha”.',
    errorSignIn: 'E-mail ou senha inválidos.',
    errorUnexpected: 'Ocorreu um erro inesperado.',
    submitSignUp: 'Criar conta',
    submitSignIn: 'Entrar',
    hasAccount: 'Já tem conta?',
    newHere: 'Novo por aqui?',
    linkSignIn: 'Entrar',
    linkSignUp: 'Criar conta',
    navInicio: 'Início',
    navInvestimentos: 'Investimentos',
    navTipos: 'Tipos',
    legalPrivacy: 'Privacidade',
    legalTerms: 'Termos',
    legalSupport: 'Suporte',
    passwordMinLengthTitle: 'Mínimo de 8 caracteres.',
    passwordTooShort: 'A senha deve ter pelo menos 8 caracteres.',
    linkForgotPassword: 'Esqueci a senha',
    errorEmailNotVerified:
      'Confirme seu e-mail antes de entrar. Enviamos um código de verificação.',
    errorSignInVerifyFirst: 'Verifique seu e-mail para continuar.',
    errorInvalidOtp: 'Código inválido ou expirado.',
    errorTooManyOtpAttempts:
      'Muitas tentativas. Solicite um novo código e tente de novo.',
    errorRateLimit: 'Aguarde um momento antes de solicitar outro código.',
    errorPasswordMismatch: 'As senhas não coincidem.',
    verifyEmailTitle: 'Confirme seu e-mail',
    verifyEmailSubtitle: (email: string) =>
      `Enviamos um código de 6 dígitos para ${email}.`,
    verifyEmailNoEmail: 'Informe o e-mail usado no cadastro.',
    labelOtp: 'Código de verificação',
    placeholderOtp: '000000',
    submitVerifyEmail: 'Confirmar e entrar',
    resendOtp: 'Reenviar código',
    resendOtpCooldown: (seconds: number) =>
      `Aguarde ${seconds}s para reenviar`,
    verifyEmailSuccess: 'E-mail confirmado. Faça login para continuar.',
    linkChangeEmail: 'Usar outro e-mail',
    forgotPasswordTitle: 'Recuperar senha',
    forgotPasswordSubtitle:
      'Informe seu e-mail. Se existir uma conta, enviaremos um código.',
    submitForgotPassword: 'Enviar código',
    forgotPasswordSuccess:
      'Se existir uma conta com este e-mail, você receberá um código em breve.',
    resetPasswordTitle: 'Nova senha',
    resetPasswordSubtitle: 'Digite o código recebido e escolha uma nova senha.',
    labelNewPassword: 'Nova senha',
    labelConfirmPassword: 'Confirmar senha',
    submitResetPassword: 'Redefinir senha',
    resetPasswordSuccess:
      'Senha redefinida. Entre com sua nova senha.',
    loginAfterResetHint: 'Sua senha foi atualizada.',
    emailOtpSubjectVerify: 'Confirme seu e-mail — The Financial Architect',
    emailOtpBodyVerify: (otp: string) =>
      `Seu código de verificação é: ${otp}\n\nEle expira em 10 minutos. Se você não criou uma conta, ignore este e-mail.`,
    emailOtpSubjectReset: 'Redefinir senha — The Financial Architect',
    emailOtpBodyReset: (otp: string) =>
      `Seu código para redefinir a senha é: ${otp}\n\nEle expira em 10 minutos. Se você não solicitou isso, ignore este e-mail.`,
    emailOtpSubjectSignIn: 'Código de acesso — The Financial Architect',
    emailOtpBodySignIn: (otp: string) =>
      `Seu código de acesso é: ${otp}\n\nEle expira em 10 minutos.`,
    emailOtpSubjectChangeEmail: 'Confirmar e-mail — The Financial Architect',
    emailOtpBodyChangeEmail: (otp: string) =>
      `Seu código de confirmação é: ${otp}\n\nEle expira em 10 minutos.`,
  },
  dashboard: {
    kickerOverview: 'Visão geral',
    title: 'Seu patrimônio, arquitetado.',
    greeting: (name: string) =>
      `Olá, ${name}. Centro de comando para tipos, perguntas e pontuação dos investimentos.`,
    crumbDashboard: 'Dashboard',
    crumbInicio: 'Início',
    kickerHighlights: 'Destaques',
    highlightsTitle: 'Melhor pontuação por tipo',
    highlightsSubtitle:
      'Até três investimentos com maior pontuação em cada tipo (só comparável dentro do mesmo tipo).',
    emptyTypeGroup: 'Sem investimentos neste tipo.',
    cardTypes: 'Tipos',
    cardPortfolio: 'Carteira',
    cardAnswers: 'Respostas',
    totalTypes: 'Total de tipos',
    totalInvestments: 'Investimentos',
    savedAnswers: 'Respostas salvas',
    ctaListTitle: 'Ver investimentos e ranking',
    ctaListBody: 'Compare a pontuação por tipo na sua carteira.',
    ctaListLink: 'Ver lista',
    ctaTypesTitle: 'Gerenciar tipos e perguntas',
    ctaTypesBody:
      'Refine os critérios de avaliação e crie categorias de ativos.',
    ctaTypesLink: 'Acessar módulo',
    flowEmptyTitle: 'Comece pelo primeiro tipo',
    flowEmptyBody:
      'Defina tipos de investimento e perguntas antes de pontuar ativos.',
    flowMainTitle: 'Fluxo principal',
    flowMainBody:
      'Use o menu superior ou os cartões acima para continuar trabalhando.',
    ctaGoTypes: 'Ir para os tipos de investimento',
    footerCopyright: (year: number) =>
      `© ${year} ${PRODUCT_BRAND} ${DASHBOARD_FOOTER_LEDGER}`,
    footerPrivacy: 'Privacidade',
    footerTerms: 'Termos',
    footerSupport: 'Suporte',
  },
  about: {
    kicker: 'Sobre',
    title: 'Um ponto de partida enxuto com espaço para crescer.',
    body:
      'TanStack Start oferece rotas tipadas, server functions e padrões modernos de SSR. Use como base e acrescente rotas, estilo e integrações.',
  },
  notFound: {
    code: '404',
    title: 'Página não encontrada',
    body:
      'O endereço não corresponde a nenhuma rota. Volte ao painel ou à página inicial.',
    ctaDashboard: 'Painel',
    ctaHome: 'Início',
  },
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
    pageTitle: 'Lista e ranking',
    pageSubtitle:
      'Compare pontuações dentro de cada tipo. Filtre a lista abaixo ou adicione vários nomes de uma vez no formulário.',
    noTypesBodyBeforeLink: 'Ainda não há tipos.',
    noTypesLink: 'Crie tipos',
    noTypesBodyAfterLink: 'antes de adicionar investimentos.',
    addInvestmentsTitle: 'Adicionar investimentos',
    addInvestmentsHint:
      'Um nome por linha no mesmo tipo. Máximo 100 linhas por envio.',
    bulkPlaceholder: 'Ex.:\nFundos X\nTítulos Y\nUm nome por linha…',
    selectTypePlaceholder: 'Escolher tipo',
    createListSubmit: 'Criar na lista',
    filterAllPlaceholder: 'Todos ou um tipo',
    filterAllTypes: 'Todos os tipos',
    listCountOne: 'investimento nesta lista',
    listCountMany: 'investimentos nesta lista',
    emptyTitle: 'Ainda sem investimentos',
    emptyBody:
      'Use o formulário acima para colar ou escrever os nomes e escolher o tipo.',
    groupCountOne: 'investimento',
    groupCountMany: 'investimentos',
    thNome: 'Nome',
    thPontos: 'Pontos',
    thAcoes: 'Ações',
    titlePontuar: 'Pontuar',
    totalAnsweredOnly: 'Total (apenas perguntas respondidas):',
    pointsWord: 'pontos',
    activeQuestionsCount: (n: number) => `Perguntas ativas: ${n}`,
    noActiveQuestions:
      'Este tipo não tem perguntas ativas.',
    linkManageQuestions: 'Gerenciar perguntas',
    notFound: 'Investimento não encontrado.',
    backToList: 'Voltar para a lista',
    saveErrorInvalid: 'Dados inválidos. Recarregue a página.',
    saveErrorGeneric: 'Erro ao salvar.',
    segmentedAria: 'Resposta sim ou não',
    unanswered: 'Não respondida',
    answerNo: 'Não',
    answerYes: 'Sim',
    subZero: '0',
    subNegOne: '−1',
    subPlusOne: '+1',
  },
  types: {
    deleteConfirm: (label: string) =>
      `Excluir o tipo "${label}"? Só é possível se não tiver perguntas nem investimentos.`,
    deleteBlockedQuestions:
      'Não é possível excluir: existem perguntas neste tipo.',
    deleteBlockedInvestments:
      'Não é possível excluir: existem investimentos neste tipo.',
    pageTitle: 'Tipos de investimento',
    pageSubtitle:
      'Gerencie as categorias de ativos do seu portfólio. Defina a ordem de exibição e configure os questionários de avaliação.',
    labelNovoTipo: 'Novo tipo',
    newTypePlaceholder: 'Ex.: Renda fixa',
    addButton: 'Adicionar',
    emptyMobile:
      'Ainda sem tipos. Adicione acima ou cadastre-se para receber tipos sugeridos.',
    thNome: 'Nome',
    thOrdem: 'Ordem',
    labelFixedIncome: 'Renda fixa',
    labelFixedIncomeHint:
      'Sem cotação de mercado na carteira; posição pelo custo médio. Também não buscamos moeda do ticker ao salvar.',
    thNumPerguntas: 'Nº de perguntas',
    questionCount: (n: number) => `${n} perguntas`,
    mobilePerguntas: 'Perguntas',
    titleManageQuestions: 'Gerenciar perguntas',
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
    notFound: 'Tipo não encontrado.',
    backToTypes: 'Voltar para os tipos',
    title: (typeName: string) => `Perguntas — ${typeName}`,
    intro:
      'Perguntas inativas não entram na pontuação; respostas antigas podem permanecer no banco de dados.',
    restoreDefaults: 'Restaurar perguntas padrão',
    addQuestion: 'Adicionar pergunta',
    promptPlaceholder: 'Enunciado (sim/não)…',
    emptyMobile:
      'Sem perguntas. As respostas aqui definem a pontuação dos investimentos deste tipo.',
    mobileOrderLabel: (order: string) => `Ordem ${order}`,
    thTexto: 'Pergunta',
  },
  scoring: {
    legend:
      'Sim = +1 · Não = −1 · Não respondida = 0 (não entra na soma)',
  },
  portfolio: {
    displayCurrencyLabel: 'Moeda de exibição',
    subtitleConverted:
      'Totais convertidos para a moeda selecionada. Veja o detalhamento por moeda do ativo abaixo.',
    fxStaleWarning: 'Taxas de câmbio desatualizadas; exibindo última cotação disponível.',
    fxPartialTotals: 'Alguns valores não puderam ser convertidos por falta de taxa.',
    byCurrencyTitle: 'Por moeda',
    byCurrencySubtitle:
      'Totais na moeda original de cada posição, sem misturar denominações entre cartões.',
    byCurrencyHoldings: (n: number) =>
      `${n} posição${n === 1 ? '' : 'ões'}`,
    byCurrencyPctLabel: (display: string) => `da carteira em ${display}`,
    holdingsNativeValue: 'Valor (moeda do ativo)',
    holdingsDisplayValue: (currency: string) => `Valor (${currency})`,
    holdingsRecordingNote:
      'Novas posições são registradas na moeda do ativo; a tabela abaixo converte para exibição.',
    addPositionTitle: 'Adicionar posição',
    chooseAssetClassSubtitle:
      'Escolha a classe do ativo. O formulário de cadastro depende do tipo.',
    chooseVariableIncome: 'Renda variável',
    chooseVariableIncomeHint: 'Ações, FIIs, ETFs e outros ativos com cotação de mercado.',
    chooseFixedIncome: 'Renda fixa',
    chooseFixedIncomeHint: 'Títulos, CDBs e similares sem ticker de bolsa.',
    addVariableBanner:
      'Informe o ticker e os dados da posição. Se o investimento ainda não existir, ele será criado automaticamente para pontuação.',
    addVariableTypeLabel: 'Tipo de investimento',
    addVariableTypePlaceholder: 'Selecione…',
    addVariableWillCreate: (ticker: string) =>
      `Será criado um investimento com o nome «${ticker}» para vincular à pontuação.`,
    addVariableSelectTypeError: 'Selecione o tipo de investimento.',
    addVariableCreateInvestmentError:
      'Não foi possível criar o investimento. Verifique o tipo selecionado.',
    addMergeHint:
      'Já existe posição neste investimento. A quantidade e o preço unitário serão somados (novo preço médio), na mesma moeda da posição.',
    addMergeQuantityLabel: 'Quantidade adicional',
    addMergeUnitPriceLabel: 'Preço unitário desta compra',
    addMergeUnitPriceError: 'Informe o preço unitário desta compra.',
    rendaFixaTitle: 'Adicionar renda fixa',
    rendaFixaSubtitle: 'Informe os dados do título.',
    rendaFixaInvestmentLabel: 'Investimento',
    rendaFixaNewInvestmentOption: 'Novo investimento…',
    rendaFixaNewInvestmentName: 'Nome do investimento',
    rendaFixaInvestmentTypeLabel: 'Tipo de investimento',
    rendaFixaProductTypeLabel: 'Tipo de produto',
    rendaFixaIndexerLabel: 'Indexador',
    rendaFixaCapitalLabel: 'Capital aplicado',
    rendaFixaAnnualRatePre: 'Taxa prefixada (% a.a.)',
    rendaFixaAnnualRateSpread: 'Spread real (% a.a.)',
    rendaFixaAnnualRateSelicSpread: 'Spread Selic (% a.a.)',
    rendaFixaMultiplierCdi: '% do CDI',
    rendaFixaMultiplierSelic: '% da Selic',
    rendaFixaBcbRateCdi:
      'A taxa CDI vigente é carregada automaticamente do Banco Central. Use o multiplicador para contratos acima de 100% do CDI.',
    rendaFixaBcbRateSelic:
      'A taxa Selic vigente é carregada automaticamente do Banco Central.',
    rendaFixaPurchaseDateLabel: 'Data de aplicação',
    rendaFixaMaturityDateLabel: 'Data de vencimento',
    rendaFixaBrokerLabel: 'Corretora (opcional)',
    rendaFixaAddButton: 'Adicionar renda fixa',
    rendaFixaNameRequired: 'Informe o nome do investimento.',
    rendaFixaTypeRequired: 'Selecione o tipo de investimento.',
    rendaFixaCapitalRequired: 'Informe o capital aplicado.',
    rendaFixaRateRequired: 'Informe a taxa contratada.',
    rendaFixaPurchaseDateRequired: 'Informe a data de aplicação.',
    rendaFixaMaturityDateRequired: 'Informe a data de vencimento.',
    rendaFixaMaturityBeforePurchase: 'O vencimento deve ser posterior à data de aplicação.',
    rendaFixaCreateError: 'Não foi possível registrar o investimento. Tente novamente.',
  },
  aporte: {
    title: 'Simulação de Aporte',
    subtitle: 'Informe a moeda e o valor para calcular como distribuir seu aporte.',
    currencyLabel: 'Moeda do aporte',
    amountLabel: 'Valor do aporte',
    amountPlaceholder: 'Ex.: 1000',
    calcularButton: 'Calcular',
    calculating: 'Calculando…',
    colInvestimento: 'Investimento',
    colValor: 'Valor sugerido',
    colUnidades: 'Unidades',
    colPct: '% do aporte',
    colAlocacaoAntes: 'Antes',
    colAlocacaoDepois: 'Depois',
    colMeta: 'Meta',
    noTargets: 'Defina seus alvos por categoria em Portfólio antes de simular um aporte.',
    noEligible: 'Nenhum investimento com pontuação suficiente para as categorias abaixo do alvo.',
    missingQuoteTooltip: 'Cotação não disponível — valor estimado na moeda do aporte.',
    amountRequired: 'Informe um valor maior que zero.',
    errorCalc: 'Não foi possível calcular o aporte. Tente novamente.',
    dash: '—',
  },
} as const

export const ptBR = core

export type Messages = typeof ptBR
