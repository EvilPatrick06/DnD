interface VoiceAvatarProps {
  name: string
  color?: string
  isSpeaking: boolean
  isMuted: boolean
  isDeafened: boolean
}

export default function VoiceAvatar({ name, color, isSpeaking, isMuted, isDeafened }: VoiceAvatarProps): JSX.Element {
  const letter = name.charAt(0).toUpperCase()
  const borderColor = color || '#F59E0B'

  return (
    <div
      className={`flex items-center gap-2 transition-all duration-300 ${
        isSpeaking ? 'opacity-100' : isMuted || isDeafened ? 'opacity-25 grayscale' : 'opacity-40'
      }`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor,
          backgroundColor: `${borderColor}33`,
          boxShadow: isSpeaking ? `0 0 12px ${borderColor}99` : 'none'
        }}
      >
        {letter}
      </div>
      <span className="text-xs text-gray-300 truncate max-w-[80px]">{name}</span>
      {isMuted && !isDeafened && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-3 h-3 text-red-400 shrink-0"
        >
          <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
          <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
        </svg>
      )}
      {isDeafened && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-3 h-3 text-red-400 shrink-0"
        >
          <path d="M12 3a9 9 0 0 0-9 9v3.75A2.25 2.25 0 0 0 5.25 18h.75a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-.75C5.25 7.31 8.31 4.25 12 4.25S18.75 7.31 18.75 10.5h-.75a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h.75A2.25 2.25 0 0 0 21 15.75V12a9 9 0 0 0-9-9Z" />
          <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
        </svg>
      )}
    </div>
  )
}
