import { useEffect, useRef, useState } from 'react'
import { rollDice } from '../../utils/dice-utils'
import DiceResult from './DiceResult'

export interface GameChatMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
  isSystem: boolean
  isDM: boolean
  isAiDm?: boolean
  isWhisper: boolean
  whisperTarget?: string
  isDiceRoll?: boolean
  diceResult?: { formula: string; total: number; rolls: number[] }
}

interface ChatPanelProps {
  messages: GameChatMessage[]
  onSendMessage: (content: string) => void
  localPlayerName: string
}

export default function ChatPanel({ messages, onSendMessage, localPlayerName }: ChatPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<'chat' | 'dice'>('chat')
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  const handleSend = (): void => {
    const trimmed = input.trim()
    if (!trimmed) return

    // Handle /roll commands
    if (trimmed.startsWith('/roll ')) {
      const formula = trimmed.slice(6).trim()
      const result = rollDice(formula)
      if (result) {
        onSendMessage(
          JSON.stringify({
            type: 'dice',
            formula: result.formula,
            total: result.total,
            rolls: result.rolls
          })
        )
      }
      setInput('')
      return
    }

    // Handle /w whisper
    if (trimmed.startsWith('/w ')) {
      const rest = trimmed.slice(3).trim()
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx > 0) {
        const target = rest.slice(0, spaceIdx)
        const msg = rest.slice(spaceIdx + 1)
        onSendMessage(JSON.stringify({ type: 'whisper', target, message: msg }))
      }
      setInput('')
      return
    }

    onSendMessage(trimmed)
    setInput('')
  }

  const chatMessages = messages.filter((m) => !m.isDiceRoll)
  const diceMessages = messages.filter((m) => m.isDiceRoll)

  const displayMessages = activeTab === 'chat' ? chatMessages : diceMessages

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 text-xs font-semibold transition-colors cursor-pointer
            ${
              activeTab === 'chat' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('dice')}
          className={`flex-1 py-1.5 text-xs font-semibold transition-colors cursor-pointer
            ${
              activeTab === 'dice' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          Dice
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {displayMessages.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">
            {activeTab === 'chat' ? 'No messages yet' : 'No dice rolls yet'}
          </p>
        ) : (
          displayMessages.map((msg) => {
            // Dice roll display
            if (msg.isDiceRoll && msg.diceResult) {
              return (
                <DiceResult
                  key={msg.id}
                  formula={msg.diceResult.formula}
                  rolls={msg.diceResult.rolls}
                  total={msg.diceResult.total}
                  rollerName={msg.senderName}
                />
              )
            }

            // System message
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-[10px] text-gray-500 text-center italic py-0.5">
                  {msg.content}
                </div>
              )
            }

            // Whisper
            if (msg.isWhisper) {
              return (
                <div key={msg.id} className="bg-purple-900/20 border border-purple-700/30 rounded p-1.5">
                  <span className="text-[10px] text-purple-400 font-medium">
                    {msg.senderName} whispers to {msg.whisperTarget}:
                  </span>
                  <p className="text-xs text-purple-200">{msg.content}</p>
                </div>
              )
            }

            // AI DM message — distinct purple styling
            if (msg.isAiDm) {
              const displayName = msg.senderName.includes('(AI)') ? msg.senderName : `${msg.senderName} (AI)`
              return (
                <div key={msg.id} className="bg-purple-900/10 border-l-2 border-purple-500 pl-2 py-1">
                  <span className="text-[10px] text-purple-400 font-semibold">{displayName}</span>
                  <p className="text-xs text-gray-200">{msg.content}</p>
                </div>
              )
            }

            // Human DM message
            if (msg.isDM) {
              return (
                <div key={msg.id} className="bg-amber-900/10 border-l-2 border-amber-500 pl-2 py-1">
                  <span className="text-[10px] text-amber-400 font-semibold">{msg.senderName} (DM)</span>
                  <p className="text-xs text-gray-200">{msg.content}</p>
                </div>
              )
            }

            // Normal message
            return (
              <div key={msg.id} className="py-0.5">
                <span className="text-[10px] text-gray-400 font-medium">{msg.senderName}:</span>
                <span className="text-xs text-gray-200 ml-1">{msg.content}</span>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-2">
        <div className="flex gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
            placeholder={activeTab === 'chat' ? 'Type a message... (/roll 1d20, /w name msg)' : '/roll 2d6+3'}
            className="flex-1 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
              placeholder-gray-600 focus:outline-none focus:border-amber-500 text-xs"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white
              font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
