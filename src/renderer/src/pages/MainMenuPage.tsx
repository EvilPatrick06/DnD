import { useNavigate } from 'react-router'

const menuItems = [
  {
    label: 'View Characters',
    path: '/characters',
    description: 'Browse your heroes from past and present campaigns'
  },
  {
    label: 'Join Game',
    path: '/join',
    description: 'Connect to a game hosted by your Dungeon Master'
  },
  {
    label: 'Make Game',
    path: '/make',
    description: 'Create and host a new campaign as the Dungeon Master'
  },
  {
    label: 'About',
    path: '/about',
    description: 'About D&D Virtual Tabletop'
  }
]

export default function MainMenuPage(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-wider text-amber-400 mb-2">
          D&D Virtual Tabletop
        </h1>
        <p className="text-gray-400 text-lg">Your adventure awaits</p>
      </div>

      <nav className="flex flex-col gap-4 w-full max-w-md mt-8">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="group flex items-center gap-4 p-5 rounded-lg border border-gray-800
                       bg-gray-900/50 hover:bg-gray-800/80 hover:border-amber-600/50
                       transition-all duration-200 text-left cursor-pointer"
          >
            <div>
              <div className="text-xl font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {item.label}
              </div>
              <div className="text-sm text-gray-500 mt-1">{item.description}</div>
            </div>
          </button>
        ))}
      </nav>

      <p className="text-gray-600 text-sm mt-8">v1.0.0</p>
    </div>
  )
}
