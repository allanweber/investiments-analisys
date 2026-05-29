# rf_04_calc_cdi_selic — Cálculos Pós-Fixado CDI e Selic
# Produtos: CDB CDI%, LCI CDI%, LCA CDI%, CRI CDI%, CRA CDI%, Tesouro Selic
# Requer: rf_01_core

---

## FÓRMULAS CDI / SELIC

```
── TAXA DIÁRIA ────────────────────────────────────────────────────
taxa_diaria     = (1 + taxa_anual)^(1/252) - 1
taxa_efetiva_d  = taxa_diaria × percentual_CDI   (ex: × 1,10 para 110% CDI)

── MONTANTE PARA PERÍODO FIXO ────────────────────────────────────
Montante_Bruto = Capital × (1 + taxa_efetiva_d)^dias_uteis

── CONVERSÃO DIAS CORRIDOS → DIAS ÚTEIS ─────────────────────────
Aproximação: dias_uteis ≈ dias_corridos × (252/365) = dias_corridos × 0,69041
Exata: contar os dias úteis reais no calendário

── TESOURO SELIC ─────────────────────────────────────────────────
Igual ao CDI com percentual = 1,00 (100% da Selic)
```

---

## EXEMPLOS — 1 ANO (252 du) | R$ 1.000,00

### CDB 110% CDI (10,50% a.a.)

```
taxa_diaria_CDI = (1,105)^(1/252) - 1 = 0,039936% ao dia
taxa_efetiva_d  = 0,039936% × 1,10    = 0,043930% ao dia

Montante_Bruto   = 1000 × (1,00043930)^252 = R$ 1.115,50
Lucro_Bruto      = R$ 115,50
IR (17,5%)       = 115,50 × 0,175 = R$ 20,21
Montante_Liquido = R$ 1.095,29 | Rendimento = 9,53% a.a. líquido
```

### LCI 90% CDI (isenta)

```
taxa_efetiva_d  = 0,039936% × 0,90 = 0,035942% ao dia
Montante_Liquido = 1000 × (1,00035942)^252 = R$ 1.094,50
Rendimento = 9,45% a.a. líquido

Equivalência CDB: 9,45% / 0,825 = 11,45% bruto  →  LCI 90% CDI ≈ CDB 109% CDI
```

### LCA 92% CDI (isenta)

```
taxa_efetiva_d  = 0,039936% × 0,92 = 0,036741% ao dia
Montante_Liquido = 1000 × (1,00036741)^252 = R$ 1.096,60
Rendimento = 9,66% a.a. líquido
```

### CRI 105% CDI (isento, sem FGC)

```
taxa_efetiva_d  = 0,039936% × 1,05 = 0,041933% ao dia
Montante_Liquido = 1000 × (1,00041933)^252 = R$ 1.110,25
Rendimento = 11,03% a.a. líquido
```

### Tesouro Selic (100% Selic | 10,50% a.a.)

```
taxa_diaria_Selic = (1,105)^(1/252) - 1 = 0,039936% ao dia

Montante_Bruto   = 1000 × (1,00039936)^252 = R$ 1.105,00
Lucro_Bruto      = R$ 105,00
IR (17,5%)       = 105,00 × 0,175 = R$ 18,38
Montante_Liquido = R$ 1.086,62 | Rendimento = 8,66% a.a. líquido

VANTAGEM: Única opção de renda fixa com liquidez diária real SEM risco de marcação negativa.
```

---

## EXEMPLOS — PERÍODOS PARCIAIS | R$ 1.000,00 | Tesouro Selic

```
PRAZO         | DU  | MONTANTE BRUTO | IOF    | IR (22,5%) | LÍQUIDO
--------------|-----|----------------|--------|------------|--------
15 dc (11 du) |  11 | R$ 1.004,40   | 50% lc | sim        | R$ 1.001,70
30 dc (21 du) |  21 | R$ 1.008,41   | 0%     | sim        | R$ 1.006,52
90 dc (63 du) |  63 | R$ 1.025,37   | 0%     | sim        | R$ 1.019,66
180 dc (126du)|  126| R$ 1.051,45   | 0%     | sim        | R$ 1.039,87

lc = lucro cobrado | Para detalhe completo de IOF: ver rf_06_resgate
```

---

## TABELA DE REFERÊNCIA — % DO CDI vs RENDIMENTO LÍQUIDO (1 ano, IR 17,5%)

```
% DO CDI | TAXA BRUTA A.A. | MONTANTE BRUTO | IR      | LÍQUIDO  | % LÍQUIDO
---------|-----------------|----------------|---------|----------|----------
  80%    |   8,40%         | R$ 1.084,00   | R$14,70 | R$1.069,30|  6,93%
  85%    |   8,93%         | R$ 1.089,25   | R$15,62 | R$1.073,63|  7,36%
  90%    |   9,45%         | R$ 1.094,50   | R$16,54 | R$1.077,96|  7,80%
  95%    |   9,98%         | R$ 1.099,75   | R$17,46 | R$1.082,29|  8,23%
 100%    |  10,50%         | R$ 1.105,00   | R$18,38 | R$1.086,62|  8,66%
 105%    |  11,03%         | R$ 1.110,25   | R$19,29 | R$1.090,96|  9,10%
 110%    |  11,55%         | R$ 1.115,50   | R$20,21 | R$1.095,29|  9,53%
 115%    |  12,08%         | R$ 1.120,75   | R$21,13 | R$1.099,62|  9,96%
 120%    |  12,60%         | R$ 1.126,00   | R$22,05 | R$1.103,95| 10,40%

Valores calculados com CDI = 10,50% a.a.
Para taxas variáveis ao longo do período: ver rf_07_taxas_variaveis.
```
