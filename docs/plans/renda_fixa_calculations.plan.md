---
name: Renda fixa calculations
overview: Criar uma biblioteca pura de cálculo para renda fixa, com funções standalone e testes, cobrindo os produtos e regras documentados em docs/renda-fixa sem consultar APIs.
todos:
  - id: core-domain
    content: Criar helpers centrais de IR, IOF, juros compostos e encadeamento de taxas
    status: pending
  - id: prefixado
    content: Implementar cálculo pré-fixado e resgate antecipado
    status: pending
  - id: cdi-selic
    content: Implementar cálculo CDI/SELIC fixo e variável
    status: pending
  - id: ipca-igpm
    content: Implementar cálculo IPCA+/IGPM+ fixo e variável
    status: pending
  - id: mtm
    content: Implementar marcação a mercado para Tesouro Prefixado e IPCA+
    status: pending
  - id: renda-plus
    content: Tratar RendA+ e Educa+ como wrappers da base IPCA+ na fase de acumulação
    status: pending
  - id: tests
    content: Criar testes para todas as funções e cenários de borda
    status: pending
isProject: false
---

# Plano de cálculo de renda fixa

## Objetivo
Criar funções puras para calcular rendimento bruto, rendimento líquido, IR, IOF e campos auxiliares dos produtos de renda fixa documentados em `docs/renda-fixa/`.

## Princípios
- Sem chamadas a APIs.
- Funções standalone, com parâmetros explícitos.
- Código pequeno, legível e reutilizável.
- Reaproveitar fórmulas comuns em helpers centrais.
- Retornos estruturados, sem só devolver números soltos.

## Escopo
- Pré-fixado
- CDI / Selic
- IPCA+ / IGPM+
- Taxas variáveis no período
- Resgate antecipado
- Marcação a mercado
- IR e IOF
- RendA+ / Educa+ na fase de acumulação, reaproveitando a base de IPCA+

## Fora de escopo
- Consulta a APIs públicas
- Persistência em banco
- UI
- Fase de renda do RendA+ / Educa+ sem regra formal fechada na documentação

## Documentos-base
- `docs/renda-fixa/rf_00_indice.md`
- `docs/renda-fixa/rf_01_core.md`
- `docs/renda-fixa/rf_02_produtos.md`
- `docs/renda-fixa/rf_03_calc_prefixado.md`
- `docs/renda-fixa/rf_04_calc_cdi_selic.md`
- `docs/renda-fixa/rf_05_calc_ipca.md`
- `docs/renda-fixa/rf_06_resgate.md`
- `docs/renda-fixa/rf_07_taxas_variaveis.md`
- `docs/renda-fixa/rf_08_marcacao_mercado.md`

## Estrutura sugerida
- `src/lib/renda-fixa/core.ts`
- `src/lib/renda-fixa/prefixado.ts`
- `src/lib/renda-fixa/cdi-selic.ts`
- `src/lib/renda-fixa/ipca.ts`
- `src/lib/renda-fixa/market.ts`
- `src/lib/renda-fixa/index.ts`
- `src/lib/renda-fixa/*.test.ts`

## Contrato base de retorno
As funções devem retornar um objeto com, no mínimo:
- `grossAmount`
- `grossProfit`
- `iof`
- `ir`
- `netAmount`
- `netProfit`
- `grossRate`
- `netRate`

Quando fizer sentido, incluir também:
- `taxBreakdown`
- `vnaFinal`
- `marketPrice`
- `units`
- `isIsento`
- `daysCorridos`
- `daysUteis`

## Helpers centrais
- `getIrRateByDays(daysCorridos)`
- `getIofRateByDays(daysCorridos)`
- `compoundByAnnualRate(capital, annualRate, daysCorridos)`
- `compoundByDailyRate(capital, dailyRate, daysUteis)`
- `compoundChain(periods)`
- `applyTaxes(input)`
- `buildTaxBreakdown(...)`

## Funções por produto
### Pré-fixado
- `calculatePrefixadoInvestment(...)`
- `calculatePrefixadoEarlyRedemption(...)`

### CDI / Selic
- `calculateCdiInvestment(...)`
- `calculateSelicInvestment(...)`
- `calculateVariableCdiSelicInvestment(...)`

### IPCA / IGPM
- `calculateIpcaPlusInvestment(...)`
- `calculateIgpmPlusInvestment(...)`
- `calculateVariableIpcaInvestment(...)`

### Marcação a mercado
- `calculateTreasuryPrefixadoMtM(...)`
- `calculateTreasuryIpcaMtM(...)`

### RendA+ / Educa+
- `calculateTreasuryRendaAAccumulation(...)`
- `calculateTreasuryEducaAccumulation(...)`

Essas duas funções podem ser wrappers finos da base de IPCA+, com a mesma matemática de rendimento da fase de acumulação e as alíquotas já cobertas pelo modelo geral de IR.

## Regras de domínio
- IR incide sobre lucro, não sobre capital.
- IOF só existe se `diasCorridos < 30`.
- LCI/LCA/CRI/CRA são isentos de IR para pessoa física.
- Tesouro Prefixado/IPCA+ usa marcação a mercado no resgate antecipado.
- Tesouro Selic não tem marcação negativa.
- Taxas variáveis devem ser encadeadas, não somadas.
- IPCA variável mensal deve usar produto acumulado.
- Se o lucro bruto for negativo em MtM, IR deve ser zero.

## Testes
Cobrir:
- faixas de IR
- tabela de IOF dia a dia
- pré-fixado em 1 ano
- pré-fixado parcial
- CDI fixo
- Selic fixo
- CDI variável
- IPCA+ fixo
- IGPM+ fixo
- IPCA variável mês a mês
- resgate antecipado com IOF
- resgate isento
- MtM com taxa subindo
- MtM com taxa caindo
- prejuízo bruto em MtM sem IR
- RendA+ e Educa+ como wrappers da base IPCA+
- precisão numérica com `toBeCloseTo`

## Ordem de implementação
1. Criar helpers centrais e tipos.
2. Implementar pré-fixado.
3. Implementar CDI/SELIC.
4. Implementar IPCA/IGPM.
5. Implementar taxas variáveis.
6. Implementar marcação a mercado.
7. Implementar wrappers RendA+/Educa+.
8. Escrever testes por módulo.
9. Exportar tudo no `index.ts`.

## Observações
- Manter números como decimal, não como string percentual.
- Receber `daysCorridos` e `daysUteis` já prontos.
- Não deduzir calendário real dentro das funções.
- Preferir funções pequenas e previsíveis.

## Examplos de calculos de uma corretora real

- Tesouro IPCA+ 2029
  - Valor investido: R$6.430,20
  - DATA DA APLICAÇÃO: 08/10/2025
  - RENTABILIDADE CONTRATADA: IPCA + 8,06%
  - ACUMULADA ANUALIZADA: IPCA + 8,54%
  - TEMPO DA APLICAÇÃO EM DIAS CORRIDOS: 232
  - Valor líquido R$6.993,61
- Tesouro Prefixado 2027
  - Valor investido R$11.995,04
  - DATA DA APLICAÇÃO: 03/01/2025
  - RENTABILIDADE CONTRATADA: 15,66%
  - ACUMULADA ANUALIZADA: 16,51%
  - TEMPO DA APLICAÇÃO EM DIAS CORRIDOS: 508
  - Valor líquido R$14.775,74
- Tesouro Selic 2029
  - Valor investido: 6.067,47
  - DATA DA APLICAÇÃO: 07/03/2024
  - RENTABILIDADE CONTRATADA: SELIC + 0,158%
  - ACUMULADA ANUALIZADA: SELIC + 0,280%
  - TEMPO DA APLICAÇÃO EM DIAS CORRIDOS: 812
  - Valor líquido: 8.013,91
