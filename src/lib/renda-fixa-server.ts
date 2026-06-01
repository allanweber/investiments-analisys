import { createServerFn } from '@tanstack/react-start'

import { ensureBcbRatesForDisplay } from '#/lib/market-data/bcb-refresh'

async function getDb() {
  return (await import('#/db')).db
}

/** Returns current BCB indexer rates (CDI/Selic/IPCA/IGPM) as decimals for use in fixed-income calculations. */
export const getBcbRatesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const rates = await ensureBcbRatesForDisplay(db)
  return {
    cdiAnnual: rates.cdiAnnual,
    selicAnnual: rates.selicAnnual,
    ipcaAccumulated12m: rates.ipcaAccumulated12m,
    igpmAccumulated12m: rates.igpmAccumulated12m,
    ipcaMonthly: [...rates.ipcaMonthly],
    igpmMonthly: [...rates.igpmMonthly],
    asOf: rates.asOf?.toISOString() ?? null,
  }
})
