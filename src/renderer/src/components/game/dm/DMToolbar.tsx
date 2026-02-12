interface DMToolbarProps {
  activeTool: 'select' | 'token' | 'fog-reveal' | 'fog-hide' | 'measure'
  onToolChange: (tool: 'select' | 'token' | 'fog-reveal' | 'fog-hide' | 'measure') => void
}

const tools = [
  { id: 'select' as const, label: 'Select', icon: '\u{1F5B1}', shortcut: 'V' },
  { id: 'token' as const, label: 'Token', icon: '\u{1F3AF}', shortcut: 'T' },
  { id: 'fog-reveal' as const, label: 'Reveal Fog', icon: '\u{1F441}', shortcut: 'R' },
  { id: 'fog-hide' as const, label: 'Hide Fog', icon: '\u{1F32B}', shortcut: 'H' },
  { id: 'measure' as const, label: 'Measure', icon: '\u{1F4CF}', shortcut: 'M' }
]

export default function DMToolbar({ activeTool, onToolChange }: DMToolbarProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-xl">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider text-center mb-1">
        DM Tools
      </p>
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors cursor-pointer
            ${
              activeTool === tool.id
                ? 'bg-amber-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}
