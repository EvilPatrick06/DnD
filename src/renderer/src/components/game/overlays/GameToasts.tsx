import { useGameStore } from '../../../stores/use-game-store'

// --- Rest Request Toast ---
interface RestRequestToastProps {
  toast: { playerName: string; restType: 'short' | 'long' }
  onDismiss: () => void
  onShortRest: () => void
  onLongRest: () => void
}

export function RestRequestToast({ toast, onDismiss, onShortRest, onLongRest }: RestRequestToastProps): JSX.Element {
  return (
    <div className="fixed top-28 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-gray-900 border border-green-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
        <span className="text-xs text-gray-200">
          {toast.playerName} requests a {toast.restType === 'short' ? 'Short' : 'Long'} Rest
        </span>
        <button
          onClick={() => {
            onDismiss()
            if (toast.restType === 'short') onShortRest()
            else onLongRest()
          }}
          className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-500 text-white rounded cursor-pointer"
        >
          Accept
        </button>
        <button
          onClick={onDismiss}
          className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// --- Phase Change Toast ---
interface PhaseChangeToastProps {
  toast: { phase: string; suggestedLight: 'bright' | 'dim' | 'darkness' }
  onDismiss: () => void
}

export function PhaseChangeToast({ toast, onDismiss }: PhaseChangeToastProps): JSX.Element {
  const gameStore = useGameStore()

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-gray-900 border border-purple-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
        <span className="text-xs text-gray-200">
          It's now <span className="text-purple-300 font-semibold">{toast.phase}</span>. Update ambient lighting to{' '}
          <span className="text-amber-300">{toast.suggestedLight}</span>?
        </span>
        <button
          onClick={() => {
            gameStore.setAmbientLight(toast.suggestedLight)
            onDismiss()
          }}
          className="px-2 py-1 text-[10px] bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer"
        >
          Yes
        </button>
        <button
          onClick={onDismiss}
          className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
        >
          No
        </button>
      </div>
    </div>
  )
}

// --- Long Rest Warning ---
interface LongRestWarningProps {
  onOverride: () => void
  onCancel: () => void
}

export function LongRestWarning({ onOverride, onCancel }: LongRestWarningProps): JSX.Element {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-gray-900 border border-red-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
        <span className="text-xs text-gray-200">Less than 24 hours since last Long Rest. Override?</span>
        <button
          onClick={onOverride}
          className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer"
        >
          Override
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// --- AoE Dismiss Button ---
interface AoEDismissProps {
  onClear: () => void
}

export function AoEDismissButton({ onClear }: AoEDismissProps): JSX.Element {
  return (
    <div className="fixed top-16 right-4 z-30">
      <button
        onClick={onClear}
        className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer shadow-lg"
      >
        Clear AoE Template
      </button>
    </div>
  )
}

// --- Fog Toolbar ---
interface FogToolbarProps {
  activeTool: 'fog-reveal' | 'fog-hide'
  fogBrushSize: number
  onSetTool: (tool: 'select' | 'fog-reveal' | 'fog-hide') => void
  onSetBrushSize: (size: number) => void
  dynamicFogEnabled?: boolean
  onDynamicFogToggle?: (enabled: boolean) => void
}

export function FogToolbar({
  activeTool,
  fogBrushSize,
  onSetTool,
  onSetBrushSize,
  dynamicFogEnabled,
  onDynamicFogToggle
}: FogToolbarProps): JSX.Element {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl px-3 py-2">
      <button
        onClick={() => onSetTool('fog-reveal')}
        className={`px-2 py-1 text-xs rounded-lg cursor-pointer ${activeTool === 'fog-reveal' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
      >
        Reveal
      </button>
      <button
        onClick={() => onSetTool('fog-hide')}
        className={`px-2 py-1 text-xs rounded-lg cursor-pointer ${activeTool === 'fog-hide' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
      >
        Hide
      </button>
      <div className="border-l border-gray-700 h-5 mx-1" />
      <span className="text-[10px] text-gray-400">Brush:</span>
      {[1, 2, 3, 5].map((size) => (
        <button
          key={size}
          onClick={() => onSetBrushSize(size)}
          className={`w-6 h-6 text-[10px] rounded cursor-pointer ${fogBrushSize === size ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          {size}
        </button>
      ))}
      {onDynamicFogToggle && (
        <>
          <div className="border-l border-gray-700 h-5 mx-1" />
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={dynamicFogEnabled ?? false}
              onChange={(e) => onDynamicFogToggle(e.target.checked)}
              className="accent-cyan-500 w-3 h-3 cursor-pointer"
            />
            <span className="text-[10px] text-gray-400">Dynamic Vision</span>
          </label>
        </>
      )}
      <div className="border-l border-gray-700 h-5 mx-1" />
      <button
        onClick={() => onSetTool('select')}
        className="px-2 py-1 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer"
      >
        Done
      </button>
    </div>
  )
}

// --- Wall Toolbar ---
interface WallToolbarProps {
  wallType: 'solid' | 'door' | 'window'
  onSetWallType: (type: 'solid' | 'door' | 'window') => void
  onDone: () => void
}

export function WallToolbar({ wallType, onSetWallType, onDone }: WallToolbarProps): JSX.Element {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl px-3 py-2">
      {(['solid', 'door', 'window'] as const).map((type) => (
        <button
          key={type}
          onClick={() => onSetWallType(type)}
          className={`px-2 py-1 text-xs rounded-lg cursor-pointer capitalize ${
            wallType === type
              ? type === 'solid'
                ? 'bg-blue-600 text-white'
                : type === 'door'
                  ? 'bg-amber-600 text-white'
                  : 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {type}
        </button>
      ))}
      <div className="border-l border-gray-700 h-5 mx-1" />
      <span className="text-[10px] text-gray-400">Click grid intersections to place walls</span>
      <div className="border-l border-gray-700 h-5 mx-1" />
      <button
        onClick={onDone}
        className="px-2 py-1 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer"
      >
        Done
      </button>
    </div>
  )
}
