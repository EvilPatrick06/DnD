// 5e XP thresholds: XP required to reach each level (index = level)
const XP_THRESHOLDS_5E = [
  0, // Level 0 (unused)
  0, // Level 1
  300, // Level 2
  900, // Level 3
  2700, // Level 4
  6500, // Level 5
  14000, // Level 6
  23000, // Level 7
  34000, // Level 8
  48000, // Level 9
  64000, // Level 10
  85000, // Level 11
  100000, // Level 12
  120000, // Level 13
  140000, // Level 14
  165000, // Level 15
  195000, // Level 16
  225000, // Level 17
  265000, // Level 18
  305000, // Level 19
  355000 // Level 20
]

export function xpThresholdForLevel(level: number): number {
  return XP_THRESHOLDS_5E[Math.min(level, 20)] ?? 0
}

export function xpThresholdForNextLevel(currentLevel: number): number {
  if (currentLevel >= 20) return Infinity
  return xpThresholdForLevel(currentLevel + 1)
}

export function shouldLevelUp(currentLevel: number, xp: number): boolean {
  if (currentLevel >= 20) return false
  return xp >= xpThresholdForNextLevel(currentLevel)
}

// PHB 2024 p.43: After level 20, gain 1 feat per 30,000 XP above 355,000
export function getBonusFeatCount(xp: number): number {
  if (xp <= 355000) return 0
  return Math.floor((xp - 355000) / 30000)
}
