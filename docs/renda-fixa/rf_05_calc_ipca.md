# rf_05_calc_ipca — Cálculos IPCA+ e IGPM+
# Produtos: CDB IPCA+, LCI IPCA+, LCA IPCA+, CRI IPCA+, CRA IPCA+, Tesouro IPCA+
# Requer: rf_01_core

---

## FÓRMULAS IPCA+ / IGPM+

```
── TAXA TOTAL (indexador fixo) ────────────────────────────────────
taxa_total = (1 + indexador_anual) × (1 + taxa_real_anual) - 1
Montante_Bruto = Capital × (1 + taxa_total)

── COMPONENTES SEPARADOS ─────────────────────────────────────────
Capital_corrigido = Capital × (1 + indexador_anual)
Montante_Bruto    = Capital_corrigido × (1 + taxa_real_anual)

── TAXA REAL DIÁRIA (dias úteis) ─────────────────────────────────
taxa_real_diaria = (1 + taxa_real_anual)^(1/252) - 1
Fator_real = (1 + taxa_real_diaria)^dias_uteis

── FÓRMULA COMPLETA ──────────────────────────────────────────────
Montante_Bruto = Capital × (1 + IPCA_periodo) × Fator_real

Para IPCA variável mês a mês: ver rf_07_taxas_variaveis (Bloco 11)
Para Tesouro IPCA+ com resgate antecipado: ver rf_08_marcacao_mercado
```

---

## EXEMPLOS — 1 ANO | R$ 1.000,00 | IPCA = 4,83%

### CDB IPCA+ 6,00% a.a. (com IR)

```
taxa_total       = (1,0483) × (1,06) - 1 = 11,12% a.a.
Montante_Bruto   = 1000 × 1,1112 = R$ 1.111,20
Lucro_Bruto      = R$ 111,20
IR (17,5%)       = 111,20 × 0,175 = R$ 19,46
Montante_Liquido = R$ 1.091,74 | Rendimento = 9,17% a.a. líquido
Ganho real líquido: 9,17% - 4,83% (IPCA) ≈ 4,34 p.p. acima da inflação
```

### LCI IPCA+ 5,50% a.a. (isenta)

```
taxa_total       = (1,0483) × (1,055) - 1 = 10,59% a.a.
Montante_Liquido = 1000 × 1,1059 = R$ 1.105,90
Rendimento = 10,59% a.a. líquido
```

### LCA IPCA+ 5,70% a.a. (isenta)

```
taxa_total       = (1,0483) × (1,057) - 1 = 10,80% a.a.
Montante_Liquido = 1000 × 1,1080 = R$ 1.108,00
```

### CRI IPCA+ 7,00% a.a. (isento, sem FGC)

```
taxa_total       = (1,0483) × (1,07) - 1 = 12,17% a.a.
Montante_Liquido = 1000 × 1,1217 = R$ 1.121,70
```

### CRA IPCA+ 6,50% a.a. (isento, sem FGC)

```
taxa_total       = (1,0483) × (1,065) - 1 = 11,64% a.a.
Montante_Liquido = 1000 × 1,1164 = R$ 1.116,40
```

### CRA IGPM+ 5,00% a.a. (isento, IGPM = 3,50%)

```
taxa_total       = (1,035) × (1,05) - 1 = 8,675% a.a.
Montante_Liquido = 1000 × 1,08675 = R$ 1.086,75

ATENÇÃO: IGPM pode ser negativo → rendimento pode ser menor que a taxa real.
```

### Tesouro IPCA+ 6,80% a.a. (com IR)

```
taxa_total       = (1,0483) × (1,068) - 1 = 11,96% a.a.
Montante_Bruto   = 1000 × 1,1196 = R$ 1.119,60
Lucro_Bruto      = R$ 119,60
IR (17,5%)       = 119,60 × 0,175 = R$ 20,93
Montante_Liquido = R$ 1.098,67 | Rendimento = 9,87% a.a. líquido

ATENÇÃO: Para resgate ANTES do vencimento → usar rf_08_marcacao_mercado
```

### Tesouro RendA+ IPCA+ 7,20% a.a. — fase acumulação (com IR)

```
taxa_total       = (1,0483) × (1,072) - 1 = 12,38% a.a.
Montante_Bruto   = 1000 × 1,1238 = R$ 1.123,80
IR (17,5%)       = 123,80 × 0,175 = R$ 21,67
Montante_Liquido = R$ 1.102,13
DIFERENCIAL: na fase de renda há desconto progressivo no IR (até 20% de redução).
```

---

## TABELA RÁPIDA — IPCA+ por taxa real (IPCA = 4,83%, 1 ano, com IR 17,5%)

```
TAXA REAL | TAXA TOTAL | BRUTO    | IR      | LÍQUIDO   | REAL LÍQUIDO*
----------|------------|----------|---------|-----------|---------------
 IPCA+4%  |   9,01%    | R$1.090  | R$15,76 | R$1.074,24|  +4,18 p.p.
 IPCA+5%  |  10,07%    | R$1.101  | R$17,61 | R$1.083,11|  +4,09 p.p.
 IPCA+6%  |  11,12%    | R$1.111  | R$19,46 | R$1.091,74|  +4,02 p.p.
 IPCA+7%  |  12,17%    | R$1.122  | R$21,32 | R$1.100,37|  +3,95 p.p.
 IPCA+8%  |  13,23%    | R$1.132  | R$23,12 | R$1.108,88|  +3,86 p.p.

* Real líquido = rendimento líquido anualizado - IPCA do período
```
