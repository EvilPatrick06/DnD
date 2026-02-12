import { useNavigate, useLocation } from 'react-router'
import { useBuilderStore } from '../stores/useBuilderStore'
import { GAME_SYSTEMS, type GameSystem } from '../types/game-system'
import CharacterBuilder from '../components/builder/CharacterBuilder'

function SystemSelectScreen(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string })?.returnTo
  const selectGameSystem = useBuilderStore((s) => s.selectGameSystem)

  const systems: Array<{ id: GameSystem; icon: string; desc: string }> = [
    {
      id: 'dnd5e',
      icon: '🐉',
      desc: 'The world\'s greatest roleplaying game. Build characters with races, classes, backgrounds, and ability scores.'
    },
    {
      id: 'pf2e',
      icon: '⚔️',
      desc: 'A rich, flexible system with ancestries, heritages, ability boosts, and deep feat trees at every level.'
    }
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-8">
      <button
        onClick={() => navigate(returnTo || '/characters')}
        className="absolute top-6 left-6 text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1 transition-colors"
      >
        {returnTo ? '← Back to Lobby' : '← Back to Characters'}
      </button>

      <h1 className="text-3xl font-bold text-gray-100 mb-2">Create a Character</h1>
      <p className="text-gray-500 mb-8">Choose your game system to get started</p>

      <div className="grid grid-cols-2 gap-6 max-w-2xl w-full">
        {systems.map((sys) => {
          const config = GAME_SYSTEMS[sys.id]
          return (
            <button
              key={sys.id}
              onClick={() => selectGameSystem(sys.id)}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-left hover:border-amber-500/50 hover:bg-gray-900/80 transition-all group"
            >
              <div className="text-4xl mb-3">{sys.icon}</div>
              <h2 className="text-xl font-bold text-gray-100 group-hover:text-amber-400 transition-colors mb-1">
                {config.name}
              </h2>
              <div className="text-xs text-gray-500 mb-3">{config.shortName} | {config.referenceLabel}</div>
              <p className="text-sm text-gray-400 leading-relaxed">{sys.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CreateCharacterPage(): JSX.Element {
  const phase = useBuilderStore((s) => s.phase)

  if (phase === 'system-select') {
    return <SystemSelectScreen />
  }

  return <CharacterBuilder />
}
