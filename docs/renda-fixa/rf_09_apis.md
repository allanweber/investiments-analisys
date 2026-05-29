# rf_09_apis — Fonte de Dados: BCB SGS (Banco Central do Brasil)
# Guia para Desenvolvedores — Taxas de Renda Fixa Brasileira

---

## BCB SGS — Sistema Gerenciador de Séries Temporais

```
BASE URL:
  https://api.bcb.gov.br/dados/serie/bcdata.sgs.{CODIGO}/dados/ultimos/{N}?formato=json

PARÂMETROS:
  {CODIGO} = código da série (tabela abaixo)
  {N}      = quantidade de registros mais recentes
  formato  = json | csv | xml

  Para período específico (em vez de "ultimos"):
  /dados?dataInicial=DD/MM/YYYY&dataFinal=DD/MM/YYYY&formato=json

AUTENTICAÇÃO: nenhuma — completamente público
CORS:         permite chamadas direto do browser (frontend)
RATE LIMIT:   sem limite documentado
DOCUMENTAÇÃO: https://dadosabertos.bcb.gov.br/dataset?q=sgs
EXPLORADOR:   https://www3.bcb.gov.br/sgspub
```

---

## CÓDIGOS DE SÉRIE

```
CÓDIGO | SÉRIE                          | UNIDADE     | FREQUÊNCIA
-------|--------------------------------|-------------|------------
  12   | CDI Over (taxa diária)         | % ao dia    | Diária
 432   | Meta da Taxa Selic (Copom)     | % ao ano    | Por reunião
  11   | Selic Over (taxa diária)       | % ao dia    | Diária
1178   | Selic acumulada no mês         | % ao mês    | Mensal
 433   | IPCA (variação mensal)         | % ao mês    | Mensal
 226   | IPCA acumulado 12 meses        | % acumulado | Mensal
 189   | IGPM (variação mensal)         | % ao mês    | Mensal
```

---

## FORMATO DE RESPOSTA

```json
[
  { "data": "28/05/2026", "valor": "0.039936" },
  { "data": "27/05/2026", "valor": "0.039936" }
]

ATENÇÃO:
  "valor" vem como STRING  → converter para float com parseFloat()
  "data"  vem DD/MM/YYYY   → parsear adequadamente
  CDI/Selic diário: valor em % ao DIA  (ex: 0.039936 = 0,039936%/dia)
  Meta Selic:       valor em % ao ANO  (ex: 10.50    = 10,50% a.a.)
  IPCA/IGPM:        valor em % ao MÊS  (ex: 0.42     = 0,42% no mês)
```

---

## CHAMADAS ESSENCIAIS

```javascript
const BCB = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

// Meta Selic atual (último valor Copom)
fetch(`${BCB}.432/dados/ultimos/1?formato=json`)

// CDI diário atual
fetch(`${BCB}.12/dados/ultimos/1?formato=json`)

// CDI histórico — últimos 252 dias úteis (1 ano)
fetch(`${BCB}.12/dados/ultimos/252?formato=json`)

// IPCA dos últimos 12 meses
fetch(`${BCB}.433/dados/ultimos/12?formato=json`)

// IGPM dos últimos 12 meses
fetch(`${BCB}.189/dados/ultimos/12?formato=json`)

// CDI por período específico
fetch(`${BCB}.12/dados?dataInicial=01/01/2025&dataFinal=31/12/2025&formato=json`)
```

---

## SERVIÇO COMPLETO (JavaScript)

```javascript
// taxas.service.js
const BCB = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

async function get(serie, ultimos = 1) {
  const res = await fetch(`${BCB}.${serie}/dados/ultimos/${ultimos}?formato=json`);
  if (!res.ok) throw new Error(`BCB SGS erro: ${res.status}`);
  return (await res.json()).map(d => ({
    data:  d.data,
    valor: parseFloat(d.valor)
  }));
}

async function buscarCDIAnual() {
  // Meta Selic ≈ CDI anual (diferença de ~0,10 p.p. — irrelevante para cálculos)
  const d = await get(432);
  return d[0].valor / 100;                           // ex: 10.50 → 0.1050
}

async function buscarCDIDiario() {
  const d = await get(12);
  return d[0].valor / 100;                           // já em % ao dia → decimal
}

async function buscarHistoricoCDI(dias = 252) {
  return (await get(12, dias)).map(d => ({
    data:  d.data,
    valor: d.valor / 100                             // % ao dia em decimal
  }));
}

async function buscarIPCAMensal(meses = 12) {
  return (await get(433, meses)).map(d => ({
    data:  d.data,
    valor: d.valor / 100                             // % ao mês em decimal
  }));
}

async function buscarIGPMMensal(meses = 12) {
  return (await get(189, meses)).map(d => ({
    data:  d.data,
    valor: d.valor / 100
  }));
}

// Resposta unificada — uma chamada só para o frontend
async function buscarTodasTaxas() {
  const [metaSelic, cdiDiario, ipca, igpm] = await Promise.all([
    get(432, 1),
    get(12, 1),
    get(433, 12),
    get(189, 12)
  ]);

  const ipcaHistorico  = ipca.map(d => d.valor / 100);
  const igpmHistorico  = igpm.map(d => d.valor / 100);
  const ipcaAcumulado  = ipcaHistorico.reduce((acc, m) => acc * (1 + m), 1) - 1;
  const igpmAcumulado  = igpmHistorico.reduce((acc, m) => acc * (1 + m), 1) - 1;
  const selicAnual     = metaSelic[0].valor / 100;

  return {
    cdi: {
      anual:  selicAnual,                                    // 0.1050
      diario: Math.pow(1 + selicAnual, 1 / 252) - 1,        // 0.000399
    },
    selic: {
      anual:  selicAnual,
      diario: Math.pow(1 + selicAnual, 1 / 252) - 1,
    },
    ipca: {
      ultimoMes:    ipcaHistorico.at(-1),                    // 0.0042
      historico12m: ipca.map(d => ({ data: d.data, valor: d.valor / 100 })),
      acumulado12m: ipcaAcumulado,                           // 0.0576
    },
    igpm: {
      ultimoMes:    igpmHistorico.at(-1),
      historico12m: igpm.map(d => ({ data: d.data, valor: d.valor / 100 })),
      acumulado12m: igpmAcumulado,
    },
    atualizadoEm: new Date().toISOString()
  };
}
```

---

## CACHE + FALLBACK

```javascript
// cache.js — TTL simples em memória (sem dependências externas)
const _cache = new Map();

async function comCache(chave, ttlMin, fn) {
  const hit = _cache.get(chave);
  if (hit && Date.now() - hit.ts < ttlMin * 60_000) return hit.valor;
  const valor = await fn();
  _cache.set(chave, { valor, ts: Date.now() });
  return valor;
}

// Taxas fixas de fallback (caso a API BCB esteja fora)
const FALLBACK = {
  cdi:   { anual: 0.1050, diario: 0.000399 },
  selic: { anual: 0.1050, diario: 0.000399 },
  ipca:  { ultimoMes: 0.0042, acumulado12m: 0.0483 },
  igpm:  { ultimoMes: 0.0029, acumulado12m: 0.0350 },
  _fallback: true,
  aviso: "API BCB indisponível — usando taxas de referência desatualizadas."
};

// Uso no app:
async function taxasComCache() {
  try {
    return await comCache("taxas", 60, buscarTodasTaxas);
    //                              ↑ TTL: 60 minutos
  } catch (err) {
    console.warn("BCB SGS indisponível:", err.message);
    return FALLBACK;
  }
}
```

---

## TTL RECOMENDADO POR TAXA

```
TAXA        | QUANDO MUDA                  | TTL CACHE
------------|------------------------------|------------------
CDI diário  | Só em dias úteis (~17h)      | 60 minutos
Meta Selic  | A cada ~45 dias (Copom)      | 24 horas
IPCA mensal | Uma vez por mês (IBGE/BCB)   | 24 horas
IGPM mensal | Uma vez por mês (FGV/BCB)    | 24 horas
```
