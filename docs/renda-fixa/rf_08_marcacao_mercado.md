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

## POR QUE A RENTABILIDADE ACUMULADA DIFERE DA CONTRATADA

```
DEFINIÇÕES:
  Taxa contratada  = taxa de retorno se o título for carregado ATÉ O VENCIMENTO
                     (yield to maturity — YTM). É fixada na compra.
  Rentabilidade    = retorno efetivo ANUALIZADO do período já decorrido,
  acumulada        calculado sobre o valor de mercado atual do título.

  Elas SÓ coincidem exatamente na data de vencimento.
  Antes disso, a rentabilidade acumulada pode ser maior OU menor que a contratada.
```

### Mecanismo 1 — Marcação a mercado (MtM)

```
Quando as taxas de mercado CAEM após a compra:
  → O PU do título SOBE acima do que a taxa contratada preveria
  → A rentabilidade acumulada anualizada SUPERA a taxa contratada
  → O investidor está "adiantando" lucro que seria realizado no vencimento

Quando as taxas de mercado SOBEM após a compra:
  → O PU CAI
  → A rentabilidade acumulada fica ABAIXO da taxa contratada
  → Se vender, realiza menos do que a taxa contratada promete

EXEMPLO (Tesouro Prefixado 2027 — dados reais):
  Compra:        jan/2025 a 15,66% a.a.
  Após 508 dias: taxa de mercado caiu → título valorizado

  Valor esperado pela taxa contratada em 508 dias:
    11.995,04 × (1,1566)^(508/365) = R$ 14.686,06 bruto

  Valor de mercado real após 508 dias:
    Lucro líq = 14.775,74 - 11.995,04 = R$ 2.780,70
    Lucro bruto = 2.780,70 / (1 - 0,175) = R$ 3.370,55
    Valor bruto = R$ 15.365,59

  Excesso sobre o esperado = 15.365,59 - 14.686,06 = R$ 679,53
  → Ganho extra por queda de taxas (MtM)
```

### Mecanismo 2 — Efeito da anualização sobre período diferente de 365 dias

```
A anualização usa exponenciação, não proporção linear.
Um mesmo retorno absoluto gera taxas anualizadas DIFERENTES conforme o prazo.

FÓRMULA:
  taxa_anualizada = (1 + retorno_periodo)^(365 / dias_decorridos) - 1

EXEMPLO com retorno de 28,10% bruto:
  Se em 508 dias: (1,2810)^(365/508) - 1 = 19,4% a.a.
  Se em 730 dias: (1,2810)^(365/730) - 1 = 13,2% a.a.
  Se em 365 dias: (1,2810)^(365/365) - 1 = 28,1% a.a.

→ O mesmo valor absoluto acumulado gera taxas anualizadas muito diferentes.
  Isso amplifica qualquer diferença entre PU contratado e PU de mercado.
```

### Mecanismo 3 — MtM do spread no Tesouro Selic

```
O Tesouro Selic tem duration quase zero (reprecia diariamente pela Selic).
MAS o spread (ex: Selic + 0,158%) tem uma duration pequena, porém não nula.

Se o mercado passou a exigir spread MENOR para títulos similares:
  → Seu título com spread maior vale ligeiramente mais
  → Rentabilidade acumulada do spread supera o spread contratado

EXEMPLO (Tesouro Selic 2029 — dados reais):
  Contratado:  Selic + 0,158% a.a.
  Acumulado:   Selic + 0,280% a.a.
  Diferença:   +0,122 p.p. — capturado pelo MtM do spread

  Capital:     R$ 6.067,47  |  Valor líq: R$ 8.013,91  |  Dias: 812
  IR: 15,0%  (acima de 720 dias)

  Lucro líq.   = 8.013,91 - 6.067,47           = R$ 1.946,44
  Lucro bruto  = 1.946,44 / (1 - 0,15)         = R$ 2.290,05
  Valor bruto  = R$ 8.357,52
  Retorno bruto em 812 dias = 37,74%
  ≈ Selic acumulada em 812 dias (~36,5%) + excesso do spread
```

### Resumo dos 3 casos reais

```
TÍTULO          | CONTRATADA     | ACUMULADA      | DIFERENÇA  | CAUSA PRINCIPAL
----------------|----------------|----------------|------------|------------------
Prefixado 2027  | 15,66% a.a.    | 16,51% a.a.    | +0,85 p.p. | Taxa mercado caiu (MtM)
IPCA+ 2029      | IPCA + 8,06%   | IPCA + 8,54%   | +0,48 p.p. | Taxa real caiu (MtM)
Selic 2029      | Selic + 0,158% | Selic + 0,280% | +0,12 p.p. | MtM do spread

Em todos os casos as taxas caíram após a compra → títulos valorizaram.
O investidor realizaria um ganho ACIMA do contratado se vendesse agora.
Se carregar até o vencimento, realizará exatamente a taxa contratada.

REGRA:
  rentabilidade_acumulada > taxa_contratada → mercado caiu, vender pode valer a pena
  rentabilidade_acumulada < taxa_contratada → mercado subiu, melhor carregar até o fim
  rentabilidade_acumulada = taxa_contratada → vencimento ou taxas inalteradas
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
