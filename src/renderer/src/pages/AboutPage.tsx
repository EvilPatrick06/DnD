import { useNavigate } from 'react-router'

const FEATURES = [
  { name: 'Character Creation (5e)', status: 'complete' as const },
  { name: 'Character Creation (PF2e)', status: 'complete' as const },
  { name: 'Character Sheets', status: 'complete' as const },
  { name: 'Campaign Creation', status: 'complete' as const },
  { name: 'Pre-Made Adventures', status: 'complete' as const },
  { name: 'Multiplayer Lobbies', status: 'complete' as const },
  { name: 'Voice Chat', status: 'complete' as const },
  { name: 'Map & Token System', status: 'complete' as const },
  { name: 'Initiative Tracker', status: 'complete' as const },
  { name: 'Fog of War', status: 'complete' as const },
  { name: 'Dice Roller', status: 'complete' as const },
  { name: 'NPC Management', status: 'complete' as const },
  { name: 'In-Game Shop', status: 'complete' as const },
  { name: 'Conditions & Buffs', status: 'complete' as const },
  { name: 'Equipment System', status: 'complete' as const },
  { name: 'Fantasy Calendar', status: 'complete' as const },
  { name: 'Chat Moderation', status: 'complete' as const },
  { name: 'Player Colors', status: 'complete' as const },
  { name: 'File Sharing', status: 'complete' as const },
  { name: 'Ban System', status: 'complete' as const },
  { name: 'Co-DM Support', status: 'complete' as const }
]

const TECH_STACK = [
  { name: 'Electron', detail: 'Desktop framework' },
  { name: 'React 19', detail: 'UI library' },
  { name: 'TypeScript', detail: 'Type safety' },
  { name: 'Tailwind CSS v4', detail: 'Styling' },
  { name: 'Zustand v5', detail: 'State management' },
  { name: 'PeerJS', detail: 'WebRTC P2P networking' },
  { name: 'PixiJS', detail: 'Map rendering' },
  { name: 'electron-vite', detail: 'Build tooling' }
]

const WHATS_NEW = [
  'Full D&D 5e and Pathfinder 2e character builders with SRD data',
  'P2P multiplayer with voice chat and DM moderation tools',
  'Interactive map canvas with tokens, fog of war, and measurement',
  'In-game shop system with equipment economy',
  'Expandable skill, condition, and equipment details on character sheets',
  '8 pre-made adventures with NPCs and chapter breakdowns',
  'Character import/export with .dndchar files'
]

export default function AboutPage(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="h-screen bg-gray-950 text-gray-100 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/')}
          className="text-amber-400 hover:text-amber-300 hover:underline mb-8 block cursor-pointer text-sm"
        >
          &larr; Back to Menu
        </button>

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">&#9876;</div>
          <h1 className="text-3xl font-bold text-amber-400 mb-1">D&D Virtual Tabletop</h1>
          <p className="text-gray-500 text-sm">Version 2.1.0</p>
        </div>

        <p className="text-gray-300 text-center leading-relaxed mb-10 max-w-xl mx-auto">
          A desktop application for playing Dungeons & Dragons 5th Edition and Pathfinder 2nd Edition
          online with friends. Create characters, build campaigns, and adventure together — no browser required.
        </p>

        {/* Supported Systems */}
        <div className="flex gap-4 mb-10 justify-center">
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-5 py-3 text-center">
            <div className="text-2xl mb-1">&#9876;</div>
            <div className="text-sm font-semibold">D&D 5th Edition</div>
            <div className="text-xs text-green-400 mt-1">Full Support</div>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-5 py-3 text-center">
            <div className="text-2xl mb-1">&#128737;</div>
            <div className="text-sm font-semibold">Pathfinder 2e</div>
            <div className="text-xs text-green-400 mt-1">Full Support</div>
          </div>
        </div>

        {/* Feature Status */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Features</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {FEATURES.map((f) => (
              <div key={f.name} className="flex items-center gap-2 text-sm">
                <span className="text-green-400 text-xs">&#10003;</span>
                <span className="text-gray-300">{f.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What's New */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">What&apos;s New in 2.1</h2>
          <ul className="space-y-2">
            {WHATS_NEW.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-amber-400 mt-0.5">&#8226;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tech Stack */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tech Stack</h2>
          <div className="grid grid-cols-2 gap-3">
            {TECH_STACK.map((t) => (
              <div key={t.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-200 font-medium">{t.name}</span>
                <span className="text-xs text-gray-500">{t.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Credits */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Credits</h2>
          <ul className="space-y-1.5 text-sm text-gray-400">
            <li>Created by Gavin Knotts</li>
            <li>Built with Claude Code by Anthropic</li>
            <li>Development: VS Code, Node.js, npm, TypeScript</li>
            <li>UI: React 19, Tailwind CSS v4, Zustand v5</li>
            <li>Desktop: Electron, electron-vite, electron-builder</li>
            <li>Game rules: D&amp;D 5e SRD (Wizards of the Coast, OGL/CC-BY-4.0)</li>
            <li>Game rules: Pathfinder 2e (Paizo, ORC License)</li>
            <li>Networking: PeerJS (peerjs.com)</li>
            <li>Rendering: PixiJS (pixijs.com)</li>
            <li>Icons: Unicode emoji and HTML entities</li>
          </ul>
        </div>

        <div className="text-center text-xs text-gray-600 pb-6">
          &copy; 2025-2026 Gavin Knotts
        </div>
      </div>
    </div>
  )
}
