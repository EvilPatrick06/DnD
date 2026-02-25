import { useEffect, useState } from 'react'

/**
 * Generic hook for loading equipment data on mount.
 * Eliminates duplication of the useState + useEffect + load pattern
 * found in OffenseSection5e, DefenseSection5e, EquipmentSection5e, CraftingSection5e.
 *
 * @param loader - Async function that returns the data
 * @param initial - Initial value before data loads
 */
export function useEquipmentData<T>(loader: () => Promise<T>, initial: T): T {
  const [data, setData] = useState<T>(initial)
  useEffect(() => {
    loader()
      .then(setData)
      .catch(() => {})
  }, [])
  return data
}
