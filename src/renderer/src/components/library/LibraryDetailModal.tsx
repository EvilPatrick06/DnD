import { useCallback } from 'react'
import type { LibraryItem, LibraryCategory } from '../../types/library'
import { getCategoryDef } from '../../types/library'

interface LibraryDetailModalProps {
  item: LibraryItem
  onClose: () => void
  onCloneAsHomebrew: (item: LibraryItem) => void
  onDelete?: (item: LibraryItem) => void
}

function renderField(label: string, value: unknown): JSX.Element | null {
  if (value === null || value === undefined || value === '') return null

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (typeof value[0] === 'string') {
      return (
        <div key={label}>
          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
          <dd className="text-sm text-gray-200">{value.join(', ')}</dd>
        </div>
      )
    }
    return (
      <div key={label}>
        <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
        <dd className="text-sm text-gray-200 space-y-1">
          {value.map((v, i) => (
            <div key={i} className="pl-2 border-l border-gray-700">
              {typeof v === 'object' ? renderObject(v as Record<string, unknown>) : String(v)}
            </div>
          ))}
        </dd>
      </div>
    )
  }

  if (typeof value === 'object') {
    return (
      <div key={label}>
        <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
        <dd className="text-sm text-gray-200 pl-2 border-l border-gray-700">
          {renderObject(value as Record<string, unknown>)}
        </dd>
      </div>
    )
  }

  return (
    <div key={label}>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm text-gray-200">{String(value)}</dd>
    </div>
  )
}

function renderObject(obj: Record<string, unknown>): JSX.Element {
  return (
    <div className="space-y-1.5">
      {Object.entries(obj).map(([k, v]) => {
        if (k.startsWith('_') || v === null || v === undefined) return null
        return (
          <div key={k} className="flex gap-2">
            <span className="text-xs text-gray-500 min-w-[80px]">{formatLabel(k)}:</span>
            <span className="text-xs text-gray-300 break-words">
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

const HIDDEN_KEYS = new Set(['id', '_homebrewId', '_basedOn', 'tokenSize', 'source'])

function getDisplayFields(data: Record<string, unknown>, category: LibraryCategory): [string, unknown][] {
  const priorityKeys = getPriorityKeys(category)
  const prioritized: [string, unknown][] = []
  const remaining: [string, unknown][] = []

  for (const [key, value] of Object.entries(data)) {
    if (HIDDEN_KEYS.has(key)) continue
    if (priorityKeys.includes(key)) {
      prioritized.push([key, value])
    } else {
      remaining.push([key, value])
    }
  }

  prioritized.sort((a, b) => priorityKeys.indexOf(a[0]) - priorityKeys.indexOf(b[0]))
  return [...prioritized, ...remaining]
}

function getPriorityKeys(category: LibraryCategory): string[] {
  switch (category) {
    case 'monsters':
    case 'creatures':
    case 'npcs':
      return ['name', 'cr', 'type', 'size', 'alignment', 'ac', 'hp', 'hitDice', 'speed', 'abilityScores', 'traits', 'actions']
    case 'spells':
      return ['name', 'level', 'school', 'castingTime', 'range', 'components', 'duration', 'description', 'lists']
    case 'classes':
      return ['name', 'hitDie', 'primaryAbility', 'savingThrows', 'proficiencies']
    case 'weapons':
      return ['name', 'category', 'damage', 'damageType', 'properties', 'weight', 'cost']
    case 'armor':
      return ['name', 'category', 'ac', 'stealthDisadvantage', 'strengthReq', 'weight', 'cost']
    case 'magic-items':
      return ['name', 'rarity', 'type', 'attunement', 'description']
    default:
      return ['name', 'description']
  }
}

export default function LibraryDetailModal({
  item,
  onClose,
  onCloneAsHomebrew,
  onDelete
}: LibraryDetailModalProps): JSX.Element {
  const catDef = getCategoryDef(item.category)
  const fields = getDisplayFields(item.data, item.category)

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {catDef && <span className="text-2xl">{catDef.icon}</span>}
            <div>
              <h2 className="text-xl font-bold text-gray-100">{item.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{catDef?.label ?? item.category}</span>
                {item.source === 'homebrew' && (
                  <span className="text-[10px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded-full">
                    Homebrew
                  </span>
                )}
                {item.source === 'official' && (
                  <span className="text-[10px] bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded-full">
                    Official
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-2xl leading-none cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <dl className="space-y-4">
            {fields.map(([key, value]) => renderField(formatLabel(key), value))}
          </dl>
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-gray-800">
          {item.source === 'official' && (
            <button
              onClick={() => onCloneAsHomebrew(item)}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Clone as Homebrew
            </button>
          )}
          {item.source === 'homebrew' && (
            <>
              <button
                onClick={() => onCloneAsHomebrew(item)}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Edit
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(item)}
                  className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Delete
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-800 text-gray-200 text-sm font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
