# rf_06_resgate — Resgate Antecipado
# Carregar quando: investidor resgata ANTES de 1 ano
# Requer: rf_01_core + documento de cálculo do produto específico

---

## REGRAS DE LIQUIDEZ POR PRODUTO

```
PRODUTO         | RESGATE ANTECIPADO POSSÍVEL?
----------------|------------------------------------------------------------
CDB             | Sim (se contrato permitir). IOF se < 30 dc.
LCI / LCA       | NÃO antes de 90 dc. Após 90 dc: livre, sem IOF, sem IR.
CRI / CRA       | NÃO diretamente. Apenas no mercado secundário com deságio.
Tesouro Selic   | Sim, qualquer dia. IOF se < 30 dc. Sem MtM negativo.
Tesouro Pré/IPCA| Sim, mas ao preço de mercado (MtM). Ver rf_08_marcacao_mercado.
```

---

## FÓRMULAS PARA PERÍODO PARCIAL

```
── PRÉ-FIXADO (dias corridos) ────────────────────────────────────
Montante_Bruto = Capital × (1 + taxa_anual)^(dias_corridos / 365)

── PÓS-FIXADO CDI/SELIC (dias úteis) ────────────────────────────
taxa_diaria = (1 + taxa_anual × percentual)^(1/252) - 1
  ERRADO: (taxa_anual × percentual)^(1/252)
  CERTO:  ((1 + taxa_anual)^(1/252) - 1) × percentual
Montante_Bruto = Capital × (1 + taxa_diaria)^dias_uteis

── IPCA+ PARCIAL ─────────────────────────────────────────────────
IPCA_parcial = IPCA_anual × (dias_corridos / 365)  [aproximação]
taxa_real_d  = (1 + taxa_real_anual)^(1/252) - 1
Montante_Bruto = Capital × (1 + IPCA_parcial) × (1 + taxa_real_d)^dias_uteis

── SEQUÊNCIA COMPLETA COM IOF ────────────────────────────────────
1. Calcular Montante_Bruto com a fórmula do produto
2. Lucro_Bruto = Montante_Bruto - Capital
3. Se dias_corridos < 30: IOF = Lucro_Bruto × aliquota_IOF_do_dia  (tabela rf_01)
4. Lucro_apos_IOF = Lucro_Bruto - IOF
5. IR = Lucro_apos_IOF × aliquota_IR  (se produto tem IR; senão IR = 0)
6. Montante_Liquido = Montante_Bruto - IOF - IR
```

---

## EXEMPLOS COMPARATIVOS | R$ 1.000,00

### CDB Pré 13,50% — múltiplos prazos

```
PRAZO  | dc  | du  | BRUTO      | IOF      | IR (alíq) | LÍQUIDO
-------|-----|-----|------------|----------|-----------|--------
15 dc  |  15 |  11 | R$1.005,35 | R$2,68 (50%) | R$0,60 (22,5%) | R$1.002,07
30 dc  |  30 |  21 | R$1.009,57 | R$0      | R$2,15 (22,5%) | R$1.007,42
90 dc  |  90 |  63 | R$1.032,03 | R$0      | R$7,21 (22,5%) | R$1.024,82
180 dc | 180 | 126 | R$1.064,35 | R$0      | R$14,48 (22,5%)| R$1.049,87
365 dc | 365 | 252 | R$1.135,00 | R$0      | R$23,63 (17,5%)| R$1.111,37
```

### Tesouro Selic 10,50% — múltiplos prazos

```
PRAZO  | dc  | du  | BRUTO      | IOF          | IR (22,5%) | LÍQUIDO
-------|-----|-----|------------|--------------|------------|--------
15 dc  |  15 |  11 | R$1.004,40 | R$2,20 (50%) | R$0,50     | R$1.001,70
30 dc  |  30 |  21 | R$1.008,41 | R$0          | R$1,89     | R$1.006,52
90 dc  |  90 |  63 | R$1.025,37 | R$0          | R$5,71     | R$1.019,66
180 dc | 180 | 126 | R$1.051,45 | R$0          | R$11,58    | R$1.039,87
365 dc | 365 | 252 | R$1.105,00 | R$0          | R$18,38    | R$1.086,62
```

### LCI Pré 11% — prazos (carência 90 dc)

```
PRAZO  | RESGATE?  | LÍQUIDO
-------|-----------|-----------------------------
< 90dc | BLOQUEADO | Não é possível — aguardar carência
90 dc  | SIM       | 1000 × (1,11)^(90/365) = R$ 1.026,05
180 dc | SIM       | 1000 × (1,11)^(180/365) = R$ 1.052,85
365 dc | SIM       | R$ 1.110,00
```

### CRI/CRA — mercado secundário

```
Capital: R$1.000,00 | Cenário: venda após 90 dc com deságio de 2%

PU de mercado estimado após 90 dc: R$ 1.028,00
Deságio (2%): -R$ 20,56
Valor recebido: R$ 1.007,44 (R$ 7,44 de rendimento em 90 dias)

CONCLUSÃO: Evitar CRI/CRA se precisar de liquidez antes do vencimento.
```

---

## IMPACTO DO IOF — SIMULAÇÃO (CDB pré 13,50%)

```
DIA | LUCRO BRUTO | IOF       | IR (22,5%) | LUCRO LÍQUIDO | EFICIÊNCIA
----|-------------|-----------|------------|---------------|----------
  1 | R$  0,37    | R$  0,35  | R$  0,00   | R$  0,01      |   3%
  5 | R$  1,85    | R$  1,54  | R$  0,07   | R$  0,24      |  13%
 10 | R$  3,70    | R$  2,44  | R$  0,28   | R$  0,98      |  27%
 15 | R$  5,35    | R$  2,68  | R$  0,60   | R$  2,07      |  39%
 20 | R$  7,16    | R$  2,36  | R$  1,08   | R$  3,72      |  52%
 25 | R$  8,57    | R$  1,37  | R$  1,62   | R$  5,58      |  65%
 29 | R$  9,28    | R$  0,28  | R$  2,03   | R$  6,97      |  75%
 30 | R$  9,57    | R$  0,00  | R$  2,15   | R$  7,42      |  78%
 90 | R$ 32,03    | R$  0,00  | R$  7,21   | R$ 24,82      |  78%
365 | R$135,00    | R$  0,00  | R$ 23,63   | R$111,37      |  82%

REGRA DE OURO: Se já chegou ao dia 25+, aguente até o dia 30 — o IOF despenca.
               Do dia 29 para o 30: economia de R$ 0,28 de IOF com apenas 1 dia de espera.
```
