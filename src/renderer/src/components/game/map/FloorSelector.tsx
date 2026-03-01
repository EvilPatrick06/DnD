interface Floor {
  id: string
  name: string
}

interface FloorSelectorProps {
  floors: Floor[]
  currentFloor: string
  onFloorChange: (floorId: string) => void
}

export default function FloorSelector({ floors, currentFloor, onFloorChange }: FloorSelectorProps): JSX.Element | null {
  if (floors.length <= 1) return null

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
      {floors.map((floor) => (
        <button
          key={floor.id}
          onClick={() => onFloorChange(floor.id)}
          className={`px-2 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
            currentFloor === floor.id
              ? 'bg-amber-600 border-amber-500 text-white'
              : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
          title={floor.name}
        >
          {floor.name}
        </button>
      ))}
    </div>
  )
}
