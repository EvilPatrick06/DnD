import { useEffect, useRef } from 'react'
import { useGameStore } from '../../../stores/useGameStore'
import type { SidebarEntry } from '../../../types/game-state'
import type { MapToken } from '../../../types/map'

interface TokenContextMenuProps {
  x: number
  y: number
  token: MapToken
  mapId: string
  isDM: boolean
  onClose: () => void
  onEditToken: (token: MapToken) => void
  onAddToInitiative: (token: MapToken) => void
}

export default function TokenContextMenu({
  x,
  y,
  token,
  mapId,
  isDM,
  onClose,
  onEditToken,
  onAddToInitiative
}: TokenContextMenuProps): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const updateToken = useGameStore((s) => s.updateToken)
  const removeToken = useGameStore((s) => s.removeToken)
  const addSidebarEntry = useGameStore((s) => s.addSidebarEntry)
  const allies = useGameStore((s) => s.allies)
  const enemies = useGameStore((s) => s.enemies)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!isDM) return null

  const handleEditToken = (): void => {
    onEditToken(token)
    onClose()
  }

  const handleAddToInitiative = (): void => {
    onAddToInitiative(token)
    onClose()
  }

  const handleApplyCondition = (): void => {
    console.log('[TokenContextMenu] Apply condition to:', token.label, token.id)
    onClose()
  }

  const handleToggleVisibility = (): void => {
    updateToken(mapId, token.id, { visibleToPlayers: !token.visibleToPlayers })
    onClose()
  }

  const handleRemoveToken = (): void => {
    removeToken(mapId, token.id)
    onClose()
  }

  // Check if the token is already in allies or enemies
  const isInAllies = allies.some((e) => e.sourceId === token.id)
  const isInEnemies = enemies.some((e) => e.sourceId === token.id)

  const createSidebarEntryFromToken = (category: 'allies' | 'enemies'): void => {
    const descParts: string[] = []
    if (token.entityType) descParts.push(`Type: ${token.entityType}`)
    if (token.ac) descParts.push(`AC ${token.ac}`)
    if (token.maxHP) descParts.push(`HP ${token.currentHP ?? token.maxHP}/${token.maxHP}`)
    if (token.walkSpeed) descParts.push(`Speed ${token.walkSpeed} ft`)

    const entry: SidebarEntry = {
      id: crypto.randomUUID(),
      name: token.label,
      description: descParts.length > 0 ? descParts.join(' | ') : undefined,
      visibleToPlayers: true,
      isAutoPopulated: false,
      sourceId: token.id,
      statBlock: token.ac || token.maxHP
        ? {
            ...(token.ac ? { ac: token.ac } : {}),
            ...(token.maxHP ? { hpMax: token.maxHP, hpCurrent: token.currentHP ?? token.maxHP } : {})
          }
        : undefined
    }
    addSidebarEntry(category, entry)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="absolute bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={handleEditToken}
        className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Edit Token
      </button>
      <button
        onClick={handleAddToInitiative}
        className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Add to Initiative
      </button>
      <button
        onClick={handleApplyCondition}
        className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Apply Condition
      </button>
      <div className="border-t border-gray-800 my-1" />
      {!isInAllies && (
        <button
          onClick={() => createSidebarEntryFromToken('allies')}
          className="w-full px-4 py-2 text-xs text-left text-green-400 hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Add to Allies
        </button>
      )}
      {!isInEnemies && (
        <button
          onClick={() => createSidebarEntryFromToken('enemies')}
          className="w-full px-4 py-2 text-xs text-left text-red-400 hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Add to Enemies
        </button>
      )}
      <div className="border-t border-gray-800 my-1" />
      <button
        onClick={handleToggleVisibility}
        className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        {token.visibleToPlayers ? 'Hide from Players' : 'Show to Players'}
      </button>
      <div className="border-t border-gray-800 my-1" />
      <button
        onClick={handleRemoveToken}
        className="w-full px-4 py-2 text-xs text-left text-red-400 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Remove Token
      </button>
    </div>
  )
}
