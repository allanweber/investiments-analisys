import { useCallback, useState } from 'react'

import type { HoldingRow } from '../types'

export type ModalState =
  | { kind: 'closed' }
  | { kind: 'chooseAssetClass' }
  | { kind: 'addFixedIncome' }
  | { kind: 'editFixedIncome'; row: HoldingRow }
  | { kind: 'add' }
  | { kind: 'edit'; row: HoldingRow }
  | { kind: 'addToPosition'; row: HoldingRow }

export type UseHoldingModalResult = {
  state: ModalState
  close: () => void
  openChooseAssetClass: () => void
  openAddFixedIncome: () => void
  openEditFixedIncome: (row: HoldingRow) => void
  openAdd: () => void
  openEdit: (row: HoldingRow) => void
  openAddToPosition: (row: HoldingRow) => void
}

export function useHoldingModal(): UseHoldingModalResult {
  const [state, setState] = useState<ModalState>({ kind: 'closed' })

  const openAddToPosition = useCallback((row: HoldingRow) => {
    setState({ kind: 'addToPosition', row })
  }, [])

  return {
    state,
    close: () => setState({ kind: 'closed' }),
    openChooseAssetClass: () => setState({ kind: 'chooseAssetClass' }),
    openAddFixedIncome: () => setState({ kind: 'addFixedIncome' }),
    openEditFixedIncome: (row) => setState({ kind: 'editFixedIncome', row }),
    openAdd: () => setState({ kind: 'add' }),
    openEdit: (row) => setState({ kind: 'edit', row }),
    openAddToPosition,
  }
}
