import { load5eVariantItems, type VariantItemEntry } from '../services/data-provider'

type _VariantItemEntry = VariantItemEntry

export const VARIANT_ITEMS: Record<string, { label: string; variants: string[] }> = {}

load5eVariantItems()
  .then((data) => {
    Object.assign(VARIANT_ITEMS, data)
  })
  .catch(() => {})
