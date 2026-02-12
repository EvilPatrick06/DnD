import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCharacterStore } from '../stores/useCharacterStore'
import { useBuilderStore } from '../stores/useBuilderStore'
import { CharacterCard } from '../components/character'
import { is5eCharacter, isPf2eCharacter } from '../types/character'
import { exportCharacterToFile, importCharacterFromFile } from '../services/character-io'

type StatusFilter = 'active' | 'retired' | 'deceased' | 'all'

export default function ViewCharactersPage(): JSX.Element {
  const navigate = useNavigate()
  const { characters, loading, loadCharacters, deleteCharacter, saveCharacter } = useCharacterStore()
  const loadCharacterForEdit = useBuilderStore((s) => s.loadCharacterForEdit)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    loadCharacters()
  }, [loadCharacters])

  const handleDelete = async (id: string): Promise<void> => {
    await deleteCharacter(id)
    setShowDeleteConfirm(null)
  }

  const handleExport = async (characterId: string): Promise<void> => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return
    try {
      await exportCharacterToFile(character)
    } catch (err) {
      console.error('Failed to export character:', err)
    }
  }

  const handleImport = async (): Promise<void> => {
    setImportError(null)
    try {
      const character = await importCharacterFromFile()
      if (character) {
        await saveCharacter(character)
        await loadCharacters()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import character'
      setImportError(message)
      setTimeout(() => setImportError(null), 5000)
    }
  }

  // Filter characters by status (backward compat: treat undefined status as 'active')
  const filteredCharacters = statusFilter === 'all'
    ? characters
    : characters.filter((c) => {
        const status = (c as unknown as Record<string, unknown>).status as string | undefined
        return (status ?? 'active') === statusFilter
      })

  const filterTabs: Array<{ key: StatusFilter; label: string }> = [
    { key: 'active', label: 'Active' },
    { key: 'retired', label: 'Retired' },
    { key: 'deceased', label: 'Deceased' },
    { key: 'all', label: 'All' }
  ]

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <button
        onClick={() => navigate('/')}
        className="text-amber-400 hover:text-amber-300 hover:underline mb-6 block cursor-pointer"
      >
        &larr; Back to Menu
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Your Characters</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="px-4 py-2 border border-gray-600 hover:border-amber-600 hover:bg-gray-800
                       text-gray-300 hover:text-amber-400 rounded-lg font-semibold text-sm
                       transition-colors cursor-pointer"
          >
            Import
          </button>
          <button
            onClick={() => navigate('/characters/create')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg
                       font-semibold text-sm transition-colors cursor-pointer"
          >
            + New Character
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {importError}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              statusFilter === tab.key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1.5 text-xs text-gray-600">
                {characters.filter((c) => {
                  const s = (c as unknown as Record<string, unknown>).status as string | undefined
                  return (s ?? 'active') === tab.key
                }).length}
              </span>
            )}
            {tab.key === 'all' && (
              <span className="ml-1.5 text-xs text-gray-600">{characters.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading characters...</div>
      ) : characters.length === 0 ? (
        <div className="border border-dashed border-gray-700 rounded-lg p-12 text-center text-gray-500">
          <div className="text-4xl mb-4">&#9876;</div>
          <p className="text-xl mb-2">No characters yet</p>
          <p className="mb-4">Create your first character to begin your adventure.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/characters/create')}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg
                         font-semibold transition-colors cursor-pointer"
            >
              Create Character
            </button>
            <button
              onClick={handleImport}
              className="px-5 py-2.5 border border-gray-600 hover:border-amber-600 hover:bg-gray-800
                         text-gray-300 hover:text-amber-400 rounded-lg font-semibold
                         transition-colors cursor-pointer"
            >
              Import Character
            </button>
          </div>
        </div>
      ) : filteredCharacters.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p className="text-lg mb-1">No {statusFilter} characters</p>
          <p className="text-sm">Try a different filter or create a new character.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCharacters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onClick={() => {
                loadCharacterForEdit(char)
                navigate('/characters/create')
              }}
              onDelete={() => setShowDeleteConfirm(char.id)}
              onExport={() => handleExport(char.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Character?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This action cannot be undone. The character will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800
                           transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg
                           transition-colors cursor-pointer text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
