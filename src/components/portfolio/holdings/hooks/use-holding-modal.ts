import { useState } from 'react'

import type { HoldingRow } from '../types'

export type ModalState =
  | { kind: 'closed' }
  | { kind: 'chooseAssetClass' }
  | { kind: 'fixedIncomeComingSoon' }
  | { kind: 'add' }
  | { kind: 'edit'; row: HoldingRow }
  | { kind: 'addToPosition'; row: HoldingRow }

export type UseHoldingModalResult = {
  state: ModalState
  close: () => void
  openChooseAssetClass: () => void
  openFixedIncomeComingSoon: () => void
  openAdd: () => void
  openEdit: (row: HoldingRow) => void
  openAddToPosition: (row: HoldingRow) => void
}

export function useHoldingModal(): UseHoldingModalResult {
  const [state, setState] = useState<ModalState>({ kind: 'closed' })

  return {
    state,
    close: () => setState({ kind: 'closed' }),
    openChooseAssetClass: () => setState({ kind: 'chooseAssetClass' }),
    openFixedIncomeComingSoon: () => setState({ kind: 'fixedIncomeComingSoon' }),
    openAdd: () => setState({ kind: 'add' }),
    openEdit: (row) => setState({ kind: 'edit', row }),
    openAddToPosition: (row) => setState({ kind: 'addToPosition', row }),
  }
}
