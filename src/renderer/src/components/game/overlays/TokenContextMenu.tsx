import { useEffect, useRef, useState } from 'react'
import {
  getPluginContextMenuItems,
  type PluginBottomBarWidget,
  type PluginContextMenuAction
} from '../../../services/plugin-system/ui-extensions'

type _PluginBottomBarWidget = PluginBottomBarWidget
type _PluginContextMenuAction = PluginContextMenuAction

import { useGameStore } from '../../../stores/use-game-store'
import type { SidebarEntry } from '../../../types/game-state'
import type { MapToken } from '../../../types/map'

interface TokenContextMenuProps {
  x: number
  y: number
  token: MapToken
  mapId: string
  isDM: boolean
  characterId?: string | null
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
  characterId,
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

  const [showSetHP, setShowSetHP] = useState(false)
  const [hpValue, setHpValue] = useState(String(token.currentHP ?? 0))

  const isOwnToken = !isDM && characterId != null && token.entityId === characterId

  if (!isDM && !isOwnToken) return null

  const handleSetHP = (): void => {
    const val = parseInt(hpValue, 10)
    if (!Number.isNaN(val)) {
      updateToken(mapId, token.id, { currentHP: Math.max(0, val) })
    }
    setShowSetHP(false)
    onClose()
  }

  const handleEditToken = (): void => {
    onEditToken(token)
    onClose()
  }

  const handleAddToInitiative = (): void => {
    onAddToInitiative(token)
    onClose()
  }

  const handleApplyCondition = (): void => {
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
      statBlock:
        token.ac || token.maxHP
          ? {
              ...(token.ac ? { ac: token.ac } : {}),
              ...(token.maxHP ? { hpMax: token.maxHP, hpCurrent: token.currentHP ?? token.maxHP } : {})
            }
          : undefined
    }
    addSidebarEntry(category, entry)
    onClose()
  }

  // Player view: limited context menu for own token only
  if (!isDM && isOwnToken) {
    return (
      <div
        ref={menuRef}
        className="absolute bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {/* Token info header */}
        <div className="px-4 py-2 border-b border-gray-800">
          <div className="text-xs font-semibold text-gray-200">{token.label}</div>
          {token.currentHP != null && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              HP: {token.currentHP}/{token.maxHP ?? '?'}
              {token.ac != null && <span className="ml-2">AC: {token.ac}</span>}
            </div>
          )}
        </div>
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
      </div>
    )
  }

  // DM view: full context menu
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
      {showSetHP ? (
        <div className="px-4 py-2 flex items-center gap-1">
          <input
            type="number"
            value={hpValue}
            onChange={(e) => setHpValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSetHP()
              if (e.key === 'Escape') setShowSetHP(false)
            }}
            className="w-16 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
            autoFocus
          />
          <span className="text-[10px] text-gray-500">/ {token.maxHP ?? '?'}</span>
          <button
            onClick={handleSetHP}
            className="px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
          >
            Set
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSetHP(true)}
          className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Set HP{token.currentHP != null ? ` (${token.currentHP}/${token.maxHP ?? '?'})` : ''}
        </button>
      )}
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
      <button
        onClick={() => {
          updateToken(mapId, token.id, { nameVisible: token.nameVisible === false })
          onClose()
        }}
        className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
      >
        {token.nameVisible === false ? 'Show Name to Players' : 'Hide Name from Players'}
      </button>
      {/* Plugin context menu items */}
      {(() => {
        const pluginItems = getPluginContextMenuItems().filter((item) => !item.dmOnly || isDM)
        if (pluginItems.length === 0) return null
        return (
          <>
            <div className="border-t border-gray-800 my-1" />
            {pluginItems.map((item) => (
              <button
                key={`${item.pluginId}-${item.label}`}
                onClick={() => {
                  item.onClick(token.id)
                  onClose()
                }}
                className="w-full px-4 py-2 text-xs text-left text-gray-200 hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </>
        )
      })()}
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
