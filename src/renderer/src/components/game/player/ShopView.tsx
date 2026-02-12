import { useGameStore } from '../../../stores/useGameStore'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { ShopItem } from '../../../network/types'
import type { Character } from '../../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../../types/character'

function formatPrice(price: ShopItem['price']): string {
  const parts: string[] = []
  if (price.pp) parts.push(`${price.pp} pp`)
  if (price.gp) parts.push(`${price.gp} gp`)
  if (price.sp) parts.push(`${price.sp} sp`)
  if (price.cp) parts.push(`${price.cp} cp`)
  return parts.join(', ') || 'Free'
}

function canAfford(character: Character, price: ShopItem['price']): boolean {
  const treasure = is5eCharacter(character) || isPf2eCharacter(character) ? character.treasure : null
  if (!treasure) return false

  // Convert everything to cp for comparison
  const charTotal = (treasure.pp ?? 0) * 1000 + (treasure.gp ?? 0) * 100 + (treasure.sp ?? 0) * 10 + (treasure.cp ?? 0)
  const priceTotal = (price.pp ?? 0) * 1000 + (price.gp ?? 0) * 100 + (price.sp ?? 0) * 10 + (price.cp ?? 0)

  return charTotal >= priceTotal
}

function deductCurrency(character: Character, price: ShopItem['price']): Character {
  if (!is5eCharacter(character) && !isPf2eCharacter(character)) return character

  const treasure = { ...character.treasure }
  // Convert to cp, deduct, convert back
  let totalCp = (treasure.pp ?? 0) * 1000 + (treasure.gp ?? 0) * 100 + (treasure.sp ?? 0) * 10 + (treasure.cp ?? 0)
  const costCp = (price.pp ?? 0) * 1000 + (price.gp ?? 0) * 100 + (price.sp ?? 0) * 10 + (price.cp ?? 0)

  totalCp -= costCp
  treasure.pp = Math.floor(totalCp / 1000); totalCp %= 1000
  treasure.gp = Math.floor(totalCp / 100); totalCp %= 100
  treasure.sp = Math.floor(totalCp / 10); totalCp %= 10
  treasure.cp = totalCp

  return { ...character, treasure, updatedAt: new Date().toISOString() } as Character
}

export default function ShopView(): JSX.Element | null {
  const { shopOpen, shopName, shopInventory, closeShop } = useGameStore()
  const { characters } = useCharacterStore()
  const saveCharacter = useCharacterStore((s) => s.saveCharacter)
  const sendMessage = useNetworkStore((s) => s.sendMessage)
  const localPeerId = useNetworkStore((s) => s.localPeerId)

  // Find local player's character (with fallback to first character)
  const localChar = characters.find((c) => c.playerId === 'local' || c.playerId === localPeerId) ?? characters[0] ?? null

  if (!shopOpen || shopInventory.length === 0) return null

  const handleBuy = async (item: ShopItem): Promise<void> => {
    if (!localChar || !canAfford(localChar, item.price)) return

    // Deduct currency
    const updated = deductCurrency(localChar, item.price)

    // Add item to equipment
    const equipment = is5eCharacter(updated)
      ? [...updated.equipment, { name: item.name, quantity: 1 }]
      : isPf2eCharacter(updated)
        ? [...updated.equipment, { name: item.name, quantity: 1 }]
        : []

    const withItem = { ...updated, equipment } as Character
    await saveCharacter(withItem)

    // Send buy message to host
    sendMessage('player:buy-item', {
      itemId: item.id,
      itemName: item.name,
      price: item.price
    })
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-amber-400">{shopName}</h3>
        <button
          onClick={closeShop}
          className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
        >
          Close
        </button>
      </div>

      <div className="space-y-1 max-h-60 overflow-y-auto">
        {shopInventory.map((item) => {
          const affordable = localChar ? canAfford(localChar, item.price) : false
          return (
            <div key={item.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">{item.name}</div>
                {item.description && (
                  <div className="text-[10px] text-gray-500">{item.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-amber-400">{formatPrice(item.price)}</span>
                <span className="text-xs text-gray-500">x{item.quantity}</span>
                <button
                  onClick={() => handleBuy(item)}
                  disabled={!affordable || item.quantity <= 0}
                  className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                    affordable && item.quantity > 0
                      ? 'bg-green-700 hover:bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Buy
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
