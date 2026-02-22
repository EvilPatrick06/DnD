import { useCallback, useRef, useState } from 'react'
import type { Handout } from '../../../../types/game-state'

interface HandoutViewerModalProps {
  handout: Handout
  onClose: () => void
}

export default function HandoutViewerModal({ handout, onClose }: HandoutViewerModalProps): JSX.Element {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    setScale((prev) => {
      const next = prev + (e.deltaY < 0 ? 0.1 : -0.1)
      return Math.max(0.25, Math.min(5, next))
    })
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (handout.contentType !== 'image') return
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      offsetStart.current = { ...offset }
    },
    [handout.contentType, offset]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      setOffset({
        x: offsetStart.current.x + (e.clientX - dragStart.current.x),
        y: offsetStart.current.y + (e.clientY - dragStart.current.y)
      })
    },
    [dragging]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const resetView = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 max-w-3xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm font-semibold text-gray-200 truncate">{handout.title}</h3>
          <div className="flex items-center gap-2">
            {handout.contentType === 'image' && (
              <>
                <span className="text-[10px] text-gray-500">{Math.round(scale * 100)}%</span>
                <button
                  onClick={resetView}
                  className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
                >
                  Reset
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer" aria-label="Close">
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className={`flex-1 overflow-hidden rounded-lg border border-gray-700/40 bg-gray-800/50 min-h-0 ${
            handout.contentType === 'image' ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          onWheel={handout.contentType === 'image' ? handleWheel : undefined}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {handout.contentType === 'image' ? (
            <div className="w-full h-full flex items-center justify-center overflow-hidden select-none">
              <img
                src={handout.content}
                alt={handout.title}
                draggable={false}
                className="max-w-none"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center center'
                }}
              />
            </div>
          ) : (
            <div className="p-4 overflow-y-auto h-full">
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {handout.content}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
