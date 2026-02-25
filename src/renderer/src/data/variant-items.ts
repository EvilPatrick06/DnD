import { load5eVariantItems } from '../services/data-provider'

export const VARIANT_ITEMS: Record<string, { label: string; variants: string[] }> = {}

load5eVariantItems()
  .then((data) => {
    Object.assign(VARIANT_ITEMS, data)
  })
  .catch(() => {})
