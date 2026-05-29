# ÍNDICE — Renda Fixa Brasileira
# Versão: 1.0 | Uso: Roteamento de contexto para LLM/app web

## ARQUITETURA DOS DOCUMENTOS

```
DOCUMENTO               | ARQUIVO                    | TOKENS (~) | CONTEÚDO
------------------------|----------------------------|------------|---------------------------
rf_01_core              | rf_01_core.md              |   ~900     | Constantes, tabelas IR/IOF, fórmulas base
rf_02_produtos          | rf_02_produtos.md          |   ~800     | Catálogo de produtos e regras
rf_03_calc_prefixado    | rf_03_calc_prefixado.md    |  ~1.200    | Cálculos pré-fixado (CDB, LCI, Tesouro)
rf_04_calc_cdi_selic    | rf_04_calc_cdi_selic.md    |  ~1.200    | Cálculos pós-fixado CDI e Selic
rf_05_calc_ipca         | rf_05_calc_ipca.md         |  ~1.100    | Cálculos IPCA+ e IGPM+
rf_06_resgate           | rf_06_resgate.md           |  ~1.800    | Resgate antecipado, IOF, período parcial
rf_07_taxas_variaveis   | rf_07_taxas_variaveis.md   |  ~2.200    | CDI/Selic/IPCA variáveis + algoritmos
rf_08_marcacao_mercado  | rf_08_marcacao_mercado.md  |  ~1.400    | Mark-to-market Tesouro Prefixado/IPCA+
```

---

## REGRA DE ROTEAMENTO — quais documentos carregar por situação

```
SITUAÇÃO                                    | DOCUMENTOS OBRIGATÓRIOS
--------------------------------------------|----------------------------------------------
Qualquer cálculo                            | rf_01_core  (sempre)
Dúvida sobre regras de um produto           | rf_01_core + rf_02_produtos
Calcular CDB/LCI/LCA pré-fixado             | rf_01_core + rf_03_calc_prefixado
Calcular CDB/LCI/LCA/CRA pós CDI            | rf_01_core + rf_04_calc_cdi_selic
Calcular Tesouro Selic                      | rf_01_core + rf_04_calc_cdi_selic
Calcular CDB/LCI/LCA/CRI/CRA IPCA+         | rf_01_core + rf_05_calc_ipca
Calcular Tesouro IPCA+                      | rf_01_core + rf_05_calc_ipca + rf_08_marcacao_mercado
Calcular Tesouro Prefixado                  | rf_01_core + rf_03_calc_prefixado + rf_08_marcacao_mercado
Resgate antes de 1 ano (qualquer produto)   | + rf_06_resgate
CDI/Selic variou no período                 | + rf_07_taxas_variaveis
IPCA variou mês a mês                       | + rf_07_taxas_variaveis
```

---

## ESTRATÉGIA DE TOKENS POR TIPO DE CÁLCULO

```
CÁLCULO SIMPLES (taxa fixa, 1 ano, sem resgate antecipado):
  Documentos: rf_01_core + 1 doc de cálculo
  Tokens: ~900 + ~1.200 = ~2.100  ✅ muito leve

CÁLCULO COM RESGATE ANTECIPADO:
  Documentos: rf_01_core + 1 doc de cálculo + rf_06_resgate
  Tokens: ~900 + ~1.200 + ~1.800 = ~3.900  ✅ leve

CÁLCULO TESOURO COM MARCAÇÃO A MERCADO:
  Documentos: rf_01_core + rf_03 ou rf_05 + rf_08_marcacao_mercado
  Tokens: ~900 + ~1.200 + ~1.400 = ~3.500  ✅ leve

CÁLCULO COMPLETO COM TAXAS VARIÁVEIS:
  Documentos: rf_01_core + 1 calc + rf_06_resgate + rf_07_taxas_variaveis
  Tokens: ~900 + ~1.200 + ~1.800 + ~2.200 = ~6.100  ✅ razoável

CÁLCULO MÁXIMO (tudo):
  Todos os documentos = ~10.600 tokens  ✅ vs ~15.800 do documento único
```

---

## GLOSSÁRIO DE SIGLAS (para todas as LLMs)

```
CDI    = Certificado de Depósito Interbancário — taxa de referência diária (B3)
Selic  = Taxa básica de juros (Copom/BCB) — pós-fixado do Tesouro Selic
IPCA   = Inflação oficial brasileira (IBGE) — mensal
IGPM   = Índice de inflação FGV — mensal
VNA    = Valor Nominal Atualizado — base de cálculo do Tesouro IPCA+
PU     = Preço Unitário — preço de negociação de um título
du     = dias úteis (base 252/ano para CDI e Selic)
dc     = dias corridos (base 365/ano para pré-fixado)
IR     = Imposto de Renda — incide sobre o lucro (tabela regressiva)
IOF    = Imposto sobre Operações Financeiras — resgate < 30 dias corridos
FGC    = Fundo Garantidor de Créditos — até R$250.000/CPF/instituição
MtM    = Marcação a mercado — precificação ao preço atual de mercado
p.p.   = pontos percentuais (ex: de 10% para 11% = 1 p.p.)
Copom  = Comitê de Política Monetária (BCB) — define a Selic a cada ~45 dias
```
