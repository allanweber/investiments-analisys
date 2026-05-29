# rf_08_marcacao_mercado — Marcação a Mercado (Tesouro Prefixado e IPCA+)
# Carregar quando: resgate antecipado de Tesouro Prefixado ou Tesouro IPCA+
# Requer: rf_01_core

---

## PRINCÍPIO

```
Tesouro Prefixado e IPCA+ são recomprados pelo Tesouro ao PREÇO DE MERCADO (MtM).
Taxa de juros e preço do título se movem em direções opostas:
  Taxa SOBE → PU cai  → investidor recebe MENOS que o esperado
  Taxa CAI  → PU sobe → investidor recebe MAIS (estratégia: "surfar a curva")

Tesouro Selic NÃO tem esse risco — seu PU cresce suavemente todo dia.
```

---

## FÓRMULAS (numeradas F1–F8)

```
F1 — PU de compra:
  PU_compra = 1000 / (1 + taxa_contratada)^(dias_vencimento / 365)

F2 — PU de mercado após N dias:
  PU_mercado = 1000 / (1 + taxa_mercado_atual)^(dias_restantes / 365)
  dias_restantes = dias_vencimento_original - dias_passados

F3 — Unidades adquiridas:
  Unidades = Capital / PU_compra

F4 — Valor bruto do resgate:
  Valor_bruto = Unidades × PU_mercado

F5 — Lucro/prejuízo bruto:
  Lucro_bruto = Valor_bruto - Capital
  (se negativo: prejuízo — não incide IR; pode gerar crédito fiscal)

F6 — Montante líquido após IR:
  IR = Lucro_bruto × aliquota_IR   (somente se Lucro_bruto > 0)
  Montante_liquido = Valor_bruto - IR

F7 — Rentabilidade efetiva do período:
  Rentab = (Montante_liquido / Capital - 1) × 100  [%]

F8 — Taxa anual equivalente realizada:
  Taxa_anual = (1 + Rentab/100)^(365 / dias_passados) - 1
```

---

## FÓRMULA ESPECIAL — Tesouro IPCA+ (usa VNA)

```
F9 — VNA atual (Valor Nominal Atualizado):
  VNA_atual = VNA_base × ∏(1 + IPCA_mes_k)
  (VNA_base = R$1.000 na emissão; publicado diariamente pelo Tesouro Nacional)

F10 — PU de mercado do Tesouro IPCA+:
  PU_mercado = VNA_atual / (1 + taxa_real_mercado)^(dias_restantes / 365)

Onde taxa_real_mercado = taxa real negociada hoje para esse título (ex: 6,50% a.a.)
```

---

## EXEMPLOS | R$ 1.000,00 | Tesouro Prefixado 13,20% a.a. | Vencimento: 730 dias

### Cenário 1 — Taxa SUBIU para 14,50% após 180 dias

```
F1: PU_compra  = 1000 / (1,132)^2,0000 = R$ 780,37
F3: Unidades   = 1000 / 780,37          = 1,28143 unidades

F2: PU_mercado = 1000 / (1,145)^(550/365)
               = 1000 / (1,145)^1,5068
               = 1000 / 1,23102
               = R$ 812,33

F4: Valor_bruto       = 1,28143 × 812,33        = R$ 1.041,09
F5: Lucro_bruto       = 1041,09 - 1000           = R$ 41,09
F6: IR (22,5% / 180d) = 41,09 × 0,225           = R$ 9,25
    Montante_liquido  = 1041,09 - 9,25           = R$ 1.031,84
F7: Rentabilidade     = (1031,84/1000-1)×100     = 3,18% em 180 dias
F8: Taxa anual equiv. = (1,0318)^(365/180) - 1   = 6,49% a.a. líquido

IMPACTO: Comprou a 13,20% bruto → realizou 6,49% líquido.
         Carregar até o fim valeria mais.
```

### Cenário 2 — Taxa CAIU para 12,00% após 180 dias

```
F1: PU_compra = R$ 780,37 | F3: Unidades = 1,28143  (idem)

F2: PU_mercado = 1000 / (1,12)^(550/365)
               = 1000 / (1,12)^1,5068
               = 1000 / 1,18519
               = R$ 843,70

F4: Valor_bruto       = 1,28143 × 843,70         = R$ 1.081,30
F5: Lucro_bruto       = R$ 81,30
F6: IR (22,5%)        = 81,30 × 0,225            = R$ 18,29
    Montante_liquido  = R$ 1.063,01
F7: Rentabilidade     = 6,30% em 180 dias
F8: Taxa anual equiv. = (1,0630)^(365/180) - 1   = 13,22% a.a. líquido

CONCLUSÃO: Comprou a 13,20% bruto → realizou 13,22% líquido em metade do tempo.
           "Surfar a curva" funcionou: ganho de capital compensou o IR maior (22,5%).
```

---

## REGRA PRÁTICA

```
ANTES de resgatar Tesouro Prefixado ou IPCA+ antecipadamente, verifique:

  1. A taxa de mercado HOJE para o mesmo título
  2. Se a taxa subiu vs sua taxa contratada → pondere se vale sair agora
  3. Se a taxa caiu bastante → pode ser uma boa oportunidade de realizar lucro

NUNCA aplique em Tesouro Prefixado/IPCA+ recursos que podem ser necessários antes
do vencimento, a menos que você aceite o risco de marcação a mercado.

Alternativa sem esse risco: Tesouro Selic (liquidez diária, sem MtM).
```
