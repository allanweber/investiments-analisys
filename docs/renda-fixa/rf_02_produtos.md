# rf_02_produtos — Catálogo de Produtos e Regras
# Carregar quando: dúvida sobre regras de um produto específico

---

## MATRIZ DE PRODUTOS

```
PRODUTO | EMISSOR        | FGC | IR (PF) | LIQUIDEZ          | INDEXADORES DISPONÍVEIS
--------|----------------|-----|---------|-------------------|---------------------------
CDB     | Bancos         | Sim | Sim     | Varia (D+0/D+1)   | Pré, CDI%, IPCA+
LCI     | Bancos         | Sim | Isento  | Carência 90 dias  | Pré, CDI%, IPCA+
LCA     | Bancos         | Sim | Isento  | Carência 90 dias  | Pré, CDI%, IPCA+
CRI     | Securitizadora | Não | Isento  | Mercado sec. only | Pré, CDI%, IPCA+, IGPM+
CRA     | Securitizadora | Não | Isento  | Mercado sec. only | Pré, CDI%, IPCA+, IGPM+
T.Selic | Governo Federal| N/A | Sim     | Diária (D+1)      | Selic Over
T.Pre   | Governo Federal| N/A | Sim     | Diária* (D+1)     | Taxa fixa
T.IPCA+ | Governo Federal| N/A | Sim     | Diária* (D+1)     | IPCA + taxa real
T.RendA+| Governo Federal| N/A | Sim**   | Bloqueada fase acum| IPCA + taxa real
T.Educa+| Governo Federal| N/A | Sim**   | Bloqueada fase acum| IPCA + taxa real

*  Liquidez diária mas com marcação a mercado — ver rf_08_marcacao_mercado
** RendA+ e Educa+ têm benefício de desconto progressivo de IR na fase de renda
```

---

## REGRAS ESPECIAIS POR PRODUTO

```
CDB
  - FGC: cobre até R$250.000 por CPF por instituição financeira
  - Liquidez: depende do contrato — pode ter vencimento fixo ou liquidez diária
  - IOF: sim, se resgate < 30 dias corridos

LCI / LCA
  - Carência mínima: 90 dias corridos (não é possível resgatar antes)
  - Após carência: resgate livre, sem IOF, sem IR
  - FGC: cobre até R$250.000 por CPF por instituição

CRI / CRA
  - Sem FGC — analisar rating de crédito e qualidade do lastro antes de investir
  - Resgate antecipado: apenas no mercado secundário, geralmente com deságio de 1–5%
  - Isento de IR e IOF para pessoa física

TESOURO SELIC
  - Liquidez diária real (sem marcação a mercado negativa)
  - Melhor opção para reserva de emergência
  - IOF: sim, se resgate < 30 dias

TESOURO PREFIXADO / IPCA+
  - Resgate antecipado ao PREÇO DE MERCADO (marcação a mercado)
  - Se juros subiram: preço do título caiu → pode receber menos que o esperado
  - Se juros caíram: preço do título subiu → pode receber mais (estratégia de trading)
  - IOF: sim, se resgate < 30 dias
  - Para cálculos de resgate antecipado: usar rf_08_marcacao_mercado

TESOURO RENDA+ / EDUCA+
  - Fase de acumulação: cálculo igual ao Tesouro IPCA+
  - Fase de renda: converte em pagamentos mensais (RendA+ por 20 anos, Educa+ por 5 anos)
  - IR com desconto progressivo na fase de renda
```

---

## EQUIVALÊNCIA ENTRE PRODUTOS (para comparações)

```
FÓRMULA — taxa bruta equivalente de um produto isento para comparar com CDB (tributado):
  taxa_CDB_equivalente = taxa_isenta / (1 - aliquota_IR)

EXEMPLOS (IR 17,5% — prazo > 1 ano):
  LCI 11,00% a.a. → CDB equivalente = 11,00% / 0,825 = 13,33% a.a.
  LCI 90% CDI     → CDI equivalente = 90% / 0,825 = 109,09% do CDI
  LCA 92% CDI     → CDI equivalente = 92% / 0,825 = 111,52% do CDI

FÓRMULA — taxa isenta equivalente a um CDB tributado:
  taxa_isenta_equivalente = taxa_CDB_bruta × (1 - aliquota_IR)

EXEMPLOS:
  CDB 13,50% → LCI equivalente = 13,50% × 0,825 = 11,14% a.a.
  CDB 110% CDI → LCI equivalente = 110% × 0,825 = 90,75% do CDI
```
