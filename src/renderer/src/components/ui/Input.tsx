import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, className = '', ...props }: InputProps): JSX.Element {
  return (
    <div>
      {label && <label className="block text-gray-400 mb-2 text-sm">{label}</label>}
      <input
        className={`w-full p-3 rounded-lg bg-gray-800 border text-gray-100
          placeholder-gray-600 focus:outline-none transition-colors
          ${error ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-amber-500'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  )
}
