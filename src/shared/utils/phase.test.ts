import { describe, expect, it } from 'vitest'
import { getCurrentPhaseFromFiles } from './phase'

describe('getCurrentPhaseFromFiles', () => {
  it('returns null for an empty list', () => {
    expect(getCurrentPhaseFromFiles([])).toBeNull()
  })

  it('returns null when no plan files are present', () => {
    expect(getCurrentPhaseFromFiles(['README.md', 'package.json', 'src'])).toBeNull()
  })

  it('returns the phase number when a single plan file is present', () => {
    expect(getCurrentPhaseFromFiles(['Phase1_Plan.md'])).toBe(1)
  })

  it('returns the highest phase number when multiple plan files are present', () => {
    const files = ['Phase1_Plan.md', 'Phase2_Plan.md', 'Phase10_Plan.md', 'Phase3_Plan.md']
    expect(getCurrentPhaseFromFiles(files)).toBe(10)
  })

  it('ignores non-plan files mixed in with plan files', () => {
    const files = [
      'README.md',
      'Phase5_Plan.md',
      'Phase3_Plan.md',
      'package.json',
      'Phase5_GrokCode.md'
    ]
    expect(getCurrentPhaseFromFiles(files)).toBe(5)
  })

  it('ignores implementation note files (e.g. Phase1_GeminiPro.md)', () => {
    const files = ['Phase1_GeminiPro.md', 'Phase2_ClaudeOpus.md', 'Phase3_Kimi.md']
    expect(getCurrentPhaseFromFiles(files)).toBeNull()
  })

  it('handles files that partially match the pattern', () => {
    const files = ['Phase_Plan.md', 'PhaseX_Plan.md', 'Phase1Plan.md', 'Phase1_plan.md']
    // "Phase1_plan.md" matches because the pattern is case-insensitive
    expect(getCurrentPhaseFromFiles(files)).toBe(1)
  })

  it('handles a realistic root directory listing', () => {
    const files = [
      '.git',
      '.gitignore',
      'biome.json',
      'package.json',
      'Phase1_Plan.md',
      'Phase1_GeminiPro.md',
      'Phase27_Plan.md',
      'Phase27_ClaudeOpus.md',
      'Phase15_Plan.md',
      'Phase15_GrokCode.md',
      'src',
      'scripts',
      'Tests'
    ]
    expect(getCurrentPhaseFromFiles(files)).toBe(27)
  })

  it('returns the single phase when only one plan file exists', () => {
    expect(getCurrentPhaseFromFiles(['Phase27_Plan.md'])).toBe(27)
  })

  it('handles multi-digit phase numbers correctly', () => {
    const files = ['Phase9_Plan.md', 'Phase10_Plan.md', 'Phase27_Plan.md']
    expect(getCurrentPhaseFromFiles(files)).toBe(27)
  })
})
