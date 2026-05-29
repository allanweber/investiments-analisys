# rf_03_calc_prefixado — Cálculos Pré-Fixado
# Produtos: CDB pré, LCI pré, LCA pré, CRI pré, CRA pré, Tesouro Prefixado
# Requer: rf_01_core

---

## FÓRMULA PRÉ-FIXADO

```
Montante_Bruto = Capital × (1 + taxa_anual)^(dias_corridos / 365)

Para 1 ano exato:
  Montante_Bruto = Capital × (1 + taxa_anual)

Lucro_Bruto      = Montante_Bruto - Capital
IR               = Lucro_Bruto × aliquota_IR   (0 se isento)
Montante_Liquido = Montante_Bruto - IR
```

---

## EXEMPLOS — 1 ANO | R$ 1.000,00

### CDB Pré-fixado 13,50% a.a. (com IR)

```
Montante_Bruto   = 1000 × 1,135 = R$ 1.135,00
Lucro_Bruto      = R$ 135,00
IR (17,5%)       = 135,00 × 0,175 = R$ 23,63
Montante_Liquido = R$ 1.111,37
Rendimento       = 11,14% a.a. líquido
```

### LCI Pré-fixada 11,00% a.a. (isenta de IR)

```
Montante_Liquido = 1000 × 1,11 = R$ 1.110,00
Rendimento       = 11,00% a.a. líquido

Equivalência CDB: 11,00% / (1 - 0,175) = 13,33% bruto
→ LCI 11% é MELHOR que CDB 13,33% (empatam) e MELHOR que CDB abaixo de 13,33%
```

### LCA Pré-fixada 11,20% a.a. (isenta)

```
Montante_Liquido = 1000 × 1,112 = R$ 1.112,00
Rendimento       = 11,20% a.a. líquido
```

### CRI Pré-fixado 12,50% a.a. (isento, sem FGC)

```
Montante_Liquido = 1000 × 1,125 = R$ 1.125,00
Rendimento       = 12,50% a.a. líquido
```

### Tesouro Prefixado 13,20% a.a. (com IR)

```
Montante_Bruto   = 1000 × 1,132 = R$ 1.132,00
Lucro_Bruto      = R$ 132,00
IR (17,5%)       = 132,00 × 0,175 = R$ 23,10
Montante_Liquido = R$ 1.108,90
Rendimento       = 10,89% a.a. líquido

ATENÇÃO: Para resgate ANTES do vencimento → usar rf_08_marcacao_mercado
```

---

## EXEMPLOS — PERÍODOS PARCIAIS | R$ 1.000,00 | CDB 13,50%

```
PRAZO  | MONTANTE BRUTO                          | IR  | LÍQUIDO
-------|------------------------------------------|-----|--------
15 dc  | 1000 × (1,135)^(15/365) = R$ 1.005,35  | IOF dia 15 = 50% → R$ 2,07 lucro liq
90 dc  | 1000 × (1,135)^(90/365) = R$ 1.032,03  | IR 22,5% → R$ 1.024,82
180 dc | 1000 × (1,135)^(180/365) = R$ 1.064,35 | IR 22,5% → R$ 1.049,87
365 dc | 1000 × (1,135)^1 = R$ 1.135,00         | IR 17,5% → R$ 1.111,37

dc = dias corridos
Para períodos < 30 dias: aplicar IOF da tabela (rf_01_core) antes do IR.
Para detalhes de resgate antecipado: ver rf_06_resgate.
```

---

## TESOURO PREFIXADO COM JUROS SEMESTRAIS

```
FUNCIONAMENTO: Paga cupons a cada 6 meses. Cada cupom sofre IR na alíquota
               do prazo decorrido até aquele pagamento (não do vencimento final).

TAXA DE CUPOM SEMESTRAL EQUIVALENTE:
  cupom_semestral = (1 + taxa_anual)^(1/2) - 1
  Exemplo: (1,132)^0,5 - 1 = 6,44% ao semestre

CÁLCULO DO 1° CUPOM (6 meses, IR 22,5%):
  Cupom_bruto  = 1000 × 0,0644 = R$ 64,40
  IR (22,5%)   = 64,40 × 0,225 = R$ 14,49
  Cupom_liq    = R$ 49,91

CÁLCULO DO 2° CUPOM (12 meses, IR 20%):
  Cupom_bruto  = 1000 × 0,0644 = R$ 64,40
  IR (20%)     = 64,40 × 0,20  = R$ 12,88
  Cupom_liq    = R$ 51,52

Total líquido em 1 ano = 49,91 + 51,52 = R$ 101,43 (10,14% a.a. líquido)

NOTA: Os cupons são pagos em dinheiro. Reinvestidos manualmente geram juros adicionais.
```
