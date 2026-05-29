# rf_07_taxas_variaveis — Taxas Variáveis: CDI, Selic e IPCA
# Carregar quando: CDI/Selic muda no período OU IPCA varia mês a mês
# Requer: rf_01_core

---

## PRINCÍPIO FUNDAMENTAL

```
Taxas pós-fixadas NÃO são constantes. O cálculo correto usa ENCADEAMENTO de fatores:

  Saldo = Capital × F1 × F2 × F3 × ... × Fk

  Onde Fk = (1 + taxa_diaria_periodo_k)^dias_uteis_periodo_k

PROPRIEDADE: A ORDEM dos períodos NÃO altera o saldo final.
  F1 × F2 × F3 = F3 × F1 × F2  (multiplicação é comutativa)

APROXIMAÇÃO VÁLIDA: Usar a taxa média ponderada como se fosse constante.
  Erro < 0,1% para variações moderadas em 1 ano. Aceitável para estimativas.
```

---

## CDI/SELIC COM MÚLTIPLOS PERÍODOS

```
FÓRMULA:
  Para cada período k com (taxa_anual_k, dias_uteis_k):
    taxa_diaria_k = (1 + taxa_anual_k)^(1/252) - 1
    taxa_efetiva_k = taxa_diaria_k × percentual_produto  (ex: × 1,10 para 110% CDI)
    Fator_k = (1 + taxa_efetiva_k)^dias_uteis_k

  Saldo_Bruto = Capital × Fator_1 × Fator_2 × ... × Fator_k

TAXA MÉDIA PONDERADA (aproximação):
  CDI_medio = Σ (CDI_k × du_k) / Σ du_k
```

### Exemplo — CDB 110% CDI com 4 períodos

```
CDI: 10% (63du) → 9% (63du) → 11% (63du) → 12% (63du) | Total: 252du

Fatores diários (× 1,10):
  F1 = (1 + (1,10)^(1/252)×0,10 × 1,10... 

CÁLCULO CORRETO:
  d1 = ((1,10)^(1/252)-1)×1,10 = 0,037988%×1,10 = 0,041787%/du
  d2 = ((1,09)^(1/252)-1)×1,10 = 0,034218%×1,10 = 0,037640%/du
  d3 = ((1,11)^(1/252)-1)×1,10 = 0,041773%×1,10 = 0,045950%/du
  d4 = ((1,12)^(1/252)-1)×1,10 = 0,045335%×1,10 = 0,049868%/du

  Fator_1 = (1,00041787)^63 = 1,02660
  Fator_2 = (1,00037640)^63 = 1,02387
  Fator_3 = (1,00045950)^63 = 1,02929
  Fator_4 = (1,00049868)^63 = 1,03186

  Saldo_Bruto = 1000 × 1,02660 × 1,02387 × 1,02929 × 1,03186 = R$ 1.114,56

CDI médio = (10+9+11+12)/4 = 10,50%
Saldo (média simples) = 1000 × (1 + 0,105×1,10)^1 = R$ 1.115,50
Diferença = R$ 0,94 (0,08%) — aproximação aceitável para 1 ano
```

---

## IPCA VARIÁVEL MÊS A MÊS

```
FÓRMULA:
  VNA_final = Capital × ∏(1 + IPCA_mes_k)   para k = 1 até 12 meses
  taxa_real_diaria = (1 + taxa_real_anual)^(1/252) - 1
  Saldo_Bruto = VNA_final × (1 + taxa_real_diaria)^dias_uteis

ATENÇÃO: Produto encadeado ≠ soma simples
  Soma simples de 12 meses SUBESTIMA o IPCA acumulado real.
  Exemplo: 12 meses de 0,40% = 4,80% (soma) vs 4,907% (produto encadeado).
```

### Exemplo — Tesouro IPCA+ 6,80% com IPCA histórico

```
IPCA MENSAL: jan=0,42 fev=0,83 mar=0,16 abr=0,38 mai=0,46 jun=0,36
             jul=0,38 ago=0,44 set=0,54 out=0,56 nov=0,39 dez=0,52 (%)

IPCA ACUMULADO (produto encadeado):
  Após jan:  1,00420
  Após fev:  1,00420 × 1,00830 = 1,01254
  Após mar:  1,01254 × 1,00160 = 1,01416
  Após abr:  1,01416 × 1,00380 = 1,01800
  Após mai:  1,01800 × 1,00460 = 1,02268
  Após jun:  1,02268 × 1,00360 = 1,02636
  Após jul:  1,02636 × 1,00380 = 1,03026
  Após ago:  1,03026 × 1,00440 = 1,03480
  Após set:  1,03480 × 1,00540 = 1,04039
  Após out:  1,04039 × 1,00560 = 1,04622
  Após nov:  1,04622 × 1,00390 = 1,05030
  Após dez:  1,05030 × 1,00520 = 1,05576

  IPCA acumulado = 5,576%  (vs soma simples = 4,94%)

Capital corrigido = 1000 × 1,05576 = R$ 1.055,76
Fator real (6,80%) = (1,068)^1 = 1,068
Saldo_Bruto = 1055,76 × 1,068 = R$ 1.127,55
IR (17,5%) = (1127,55-1000) × 0,175 = R$ 22,32
Montante_Liquido = R$ 1.105,23
```

### Deflação em um mês (IPCA negativo)

```
CENÁRIO: IPCA de julho = -0,38% (deflação)
  VNA nesse mês = VNA_anterior × (1 - 0,0038) = VNA × 0,9962  ← VNA cai

REGRA: Deflação leve é absorvida pela taxa real positiva acumulada.
       Deflação persistente pode reduzir o rendimento total mas raramente gera
       perda nominal (a taxa real continua positiva).
```

---

## ALGORITMOS PARA IMPLEMENTAÇÃO

### Algoritmo A — CDI/Selic variável (pseudocódigo)

```
ENTRADA:
  capital         = valor inicial (ex: 1000)
  periodos        = [(taxa_anual_1, du_1), (taxa_anual_2, du_2), ...]
  percentual      = fator do produto (ex: 1.10 para 110% CDI; 1.0 para Selic)
  aliquota_ir     = alíquota do IR conforme prazo (0 se isento)

PROCESSAMENTO:
  saldo = capital
  para cada (taxa_anual, du) em periodos:
      d = (1 + taxa_anual)^(1/252) - 1
      d_efetivo = d * percentual
      fator = (1 + d_efetivo)^du
      saldo = saldo * fator

  lucro_bruto = saldo - capital
  ir = lucro_bruto * aliquota_ir
  montante_liquido = saldo - ir

SAÍDA: saldo_bruto, lucro_bruto, ir, montante_liquido
```

### Algoritmo B — IPCA variável (pseudocódigo)

```
ENTRADA:
  capital          = 1000
  ipca_mensal      = [0.0042, 0.0083, 0.0016, ...]  (lista de 12 valores)
  taxa_real_anual  = 0.068
  dias_uteis_total = 252
  aliquota_ir      = 0.175 (0 se isento)

PROCESSAMENTO:
  vna = capital
  para cada ipca_m em ipca_mensal:
      vna = vna * (1 + ipca_m)

  taxa_real_d = (1 + taxa_real_anual)^(1/252) - 1
  fator_real = (1 + taxa_real_d)^dias_uteis_total
  saldo_bruto = vna * fator_real

  lucro_bruto = saldo_bruto - capital
  ir = lucro_bruto * aliquota_ir
  montante_liquido = saldo_bruto - ir

SAÍDA: vna_final, saldo_bruto, lucro_bruto, ir, montante_liquido
```
