# rf_01_core — Constantes, Tabelas e Fórmulas Base
# Carregar em TODOS os cálculos

---

## CONSTANTES DE REFERÊNCIA (atualize conforme o período)

```
CDI_ANUAL   = 10,50%   → CDI_DIARIO = (1,105)^(1/252) - 1 = 0,039936% ao dia
SELIC_ANUAL = 10,50%   → SELIC_DIARIO = (1,105)^(1/252) - 1 = 0,039936% ao dia
IPCA_ANUAL  =  4,83%   (ou use histórico mensal — ver rf_07)
IGPM_ANUAL  =  3,50%

BASE_DIAS_UTEIS  = 252  (CDI, Selic, taxa real do IPCA+)
BASE_DIAS_CORRIDOS = 365 (pré-fixado, períodos parciais)
```

---

## TABELA DE IR (Imposto de Renda)

```
PRAZO (dias corridos) | ALÍQUOTA | NOTA
----------------------|----------|-----------------------------
      1 –  180 dias   |  22,5%   | Curto prazo
    181 –  360 dias   |  20,0%   | Médio prazo
    361 –  720 dias   |  17,5%   | Longo prazo (1–2 anos)
  acima de 720 dias   |  15,0%   | Longo prazo (> 2 anos)

ISENTOS DE IR (pessoa física): LCI, LCA, CRI, CRA
IR incide sobre o LUCRO, não sobre o capital total.
Com IOF: IR incide sobre o lucro APÓS desconto do IOF.
```

---

## TABELA DE IOF (dias 1–30)

```
DIA |  IOF  | DIA |  IOF  | DIA |  IOF
----|-------|-----|-------|-----|------
  1 |  96%  |  11 |  63%  |  21 |  30%
  2 |  93%  |  12 |  60%  |  22 |  26%
  3 |  90%  |  13 |  56%  |  23 |  23%
  4 |  86%  |  14 |  53%  |  24 |  20%
  5 |  83%  |  15 |  50%  |  25 |  16%
  6 |  80%  |  16 |  46%  |  26 |  13%
  7 |  76%  |  17 |  43%  |  27 |  10%
  8 |  73%  |  18 |  40%  |  28 |   6%
  9 |  70%  |  19 |  36%  |  29 |   3%
 10 |  66%  |  20 |  33%  | 30+ |   0%

IOF incide sobre o LUCRO BRUTO. Calculado ANTES do IR.
Lucro_após_IOF = Lucro_Bruto - (Lucro_Bruto × aliquota_IOF)
IR incide sobre Lucro_após_IOF.
```

---

## FÓRMULAS BASE

```
── JUROS COMPOSTOS ──────────────────────────────────────────────
Montante_Bruto = Capital × (1 + taxa_anual)^(dias_corridos / 365)
  Usar para: pré-fixado, períodos parciais em dias corridos

── CONVERSÃO ANUAL → DIÁRIO (dias úteis) ────────────────────────
taxa_diaria = (1 + taxa_anual)^(1/252) - 1
  Usar para: CDI, Selic, taxa real do IPCA+

── ENCADEAMENTO DE FATORES ───────────────────────────────────────
Saldo = Capital × ∏(1 + taxa_diaria_periodo_k)^du_k
  Usar para: múltiplos períodos com taxas diferentes

── FÓRMULA HÍBRIDA (IPCA+) ──────────────────────────────────────
taxa_total = (1 + IPCA_periodo) × (1 + taxa_real_periodo) - 1
Montante_Bruto = Capital × (1 + taxa_total)
  Usar para: IPCA+ com taxa fixa e IPCA fixo

── SEQUÊNCIA DE IMPOSTOS ────────────────────────────────────────
Lucro_Bruto        = Montante_Bruto - Capital
IOF                = Lucro_Bruto × aliquota_IOF   (se dias < 30)
Lucro_após_IOF     = Lucro_Bruto - IOF
IR                 = Lucro_após_IOF × aliquota_IR  (se produto tem IR)
Montante_Liquido   = Montante_Bruto - IOF - IR
Rendimento_Liquido = Montante_Liquido - Capital
```
