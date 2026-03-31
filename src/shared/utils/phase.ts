// ============================================================================
// Phase Detection Utility
// Determines the current development phase from a list of filenames.
// Plan files follow the naming convention: Phase{N}_Plan.md
// ============================================================================

const PHASE_PLAN_PATTERN = /^Phase(\d+)_Plan\.md$/i

/**
 * Determines the current phase from a list of filenames.
 * Scans for files matching "Phase{N}_Plan.md" and returns the highest
 * phase number found, or null if no plan files are present.
 */
export function getCurrentPhaseFromFiles(filenames: string[]): number | null {
  let maxPhase: number | null = null

  for (const filename of filenames) {
    const match = filename.match(PHASE_PLAN_PATTERN)
    if (match) {
      const phaseNum = parseInt(match[1], 10)
      if (!isNaN(phaseNum) && (maxPhase === null || phaseNum > maxPhase)) {
        maxPhase = phaseNum
      }
    }
  }

  return maxPhase
}
