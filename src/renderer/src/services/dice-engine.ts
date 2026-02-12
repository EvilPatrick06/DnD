export interface DiceTermRoll {
  count: number
  sides: number
  modifier: number
  keep?: { highest?: number; lowest?: number }
}

export interface DiceTermConstant {
  constant: number
}

export type DiceTerm = DiceTermRoll | DiceTermConstant

export interface DiceResult {
  formula: string
  terms: DiceTerm[]
  rolls: number[][] // One array of individual die results per term
  total: number
  isCritical: boolean
  isFumble: boolean
}

function isConstantTerm(term: DiceTerm): term is DiceTermConstant {
  return 'constant' in term
}

/**
 * Parse a dice formula string into an array of DiceTerms.
 *
 * Supported formats:
 * - `1d20+5` - standard dice + modifier
 * - `2d6+3` - multiple dice
 * - `4d6kh3` - keep highest 3 of 4d6
 * - `2d20kl1` - keep lowest 1 of 2d20 (disadvantage)
 * - `1d20-2` - negative modifier
 * - `3d8+1d6+4` - compound formulas
 */
export function parseDiceFormula(formula: string): DiceTerm[] {
  const terms: DiceTerm[] = []
  const cleaned = formula.replace(/\s/g, '').toLowerCase()

  // Split on + or - while keeping the sign
  const segments = cleaned.match(/[+-]?[^+-]+/g)
  if (!segments) return []

  for (const segment of segments) {
    const sign = segment.startsWith('-') ? -1 : 1
    const raw = segment.replace(/^[+-]/, '')

    // Check if it's a dice term (contains 'd')
    const diceMatch = raw.match(/^(\d+)d(\d+)(?:k([hl])(\d+))?$/)
    if (diceMatch) {
      const count = parseInt(diceMatch[1], 10)
      const sides = parseInt(diceMatch[2], 10)
      const keepType = diceMatch[3] as 'h' | 'l' | undefined
      const keepCount = diceMatch[4] ? parseInt(diceMatch[4], 10) : undefined

      const term: DiceTermRoll = {
        count,
        sides,
        modifier: 0
      }

      if (keepType && keepCount !== undefined) {
        term.keep = keepType === 'h' ? { highest: keepCount } : { lowest: keepCount }
      }

      // Apply sign to dice term by adjusting modifier (negative dice not standard, but handle edge case)
      if (sign === -1) {
        // Negative dice rolls: treat as subtracting the rolled total
        // We'll handle this in evaluation by negating the result
        term.modifier = sign
      }

      terms.push(term)
    } else {
      // It's a constant
      const value = parseInt(raw, 10)
      if (!isNaN(value)) {
        terms.push({ constant: sign * value })
      }
    }
  }

  return terms
}

function rollSingleDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function evaluateTerm(term: DiceTerm): { rolls: number[]; subtotal: number } {
  if (isConstantTerm(term)) {
    return { rolls: [], subtotal: term.constant }
  }

  const rolls: number[] = []
  for (let i = 0; i < term.count; i++) {
    rolls.push(rollSingleDie(term.sides))
  }

  let keptRolls = [...rolls]

  if (term.keep) {
    const sorted = [...rolls].sort((a, b) => a - b)
    if (term.keep.highest !== undefined) {
      keptRolls = sorted.slice(sorted.length - term.keep.highest)
    } else if (term.keep.lowest !== undefined) {
      keptRolls = sorted.slice(0, term.keep.lowest)
    }
  }

  let subtotal = keptRolls.reduce((sum, r) => sum + r, 0)

  // Handle negation for negative dice terms
  if (term.modifier === -1) {
    subtotal = -subtotal
  }

  return { rolls, subtotal }
}

/**
 * Roll dice based on a formula string.
 *
 * Critical/fumble detection applies only when the formula involves a single d20 roll.
 */
export function rollDice(formula: string): DiceResult {
  const terms = parseDiceFormula(formula)
  const allRolls: number[][] = []
  let total = 0

  for (const term of terms) {
    const { rolls, subtotal } = evaluateTerm(term)
    allRolls.push(rolls)
    total += subtotal
  }

  // Determine crit/fumble: only for single d20 rolls
  let isCritical = false
  let isFumble = false

  const d20Terms = terms.filter(
    (t): t is DiceTermRoll => !isConstantTerm(t) && t.sides === 20
  )

  if (d20Terms.length === 1 && d20Terms[0].count === 1) {
    const d20Index = terms.indexOf(d20Terms[0])
    const d20Roll = allRolls[d20Index][0]
    isCritical = d20Roll === 20
    isFumble = d20Roll === 1
  }

  return {
    formula,
    terms,
    rolls: allRolls,
    total,
    isCritical,
    isFumble
  }
}

/**
 * Roll with advantage: 2d20, keep highest.
 */
export function rollWithAdvantage(): DiceResult {
  return rollDice('2d20kh1')
}

/**
 * Roll with disadvantage: 2d20, keep lowest.
 */
export function rollWithDisadvantage(): DiceResult {
  return rollDice('2d20kl1')
}
