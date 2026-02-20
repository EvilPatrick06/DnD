export const CURRENT_SCHEMA_VERSION = 3

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS: Record<number, Migration> = {
  2: (data) => {
    if (!data.schemaVersion) {
      data.schemaVersion = 2
    }
    if (data.gameSystem === 'dnd5e' && !data.conditions) {
      data.conditions = []
    }
    return data
  },
  3: (data) => {
    if (data.gameSystem === 'dnd5e' && !Array.isArray(data.hitDice)) {
      const classes = data.classes as Array<{ name: string; level: number; hitDie: number }> | undefined
      const level = (data.level as number) || 1
      const remaining =
        typeof data.hitDiceRemaining === 'number' ? (data.hitDiceRemaining as number) : level
      if (classes && classes.length > 0) {
        let distributed = 0
        data.hitDice = classes.map((cls, i) => {
          const proportion = cls.level / level
          const classRemaining =
            i === classes.length - 1
              ? remaining - distributed
              : Math.round(remaining * proportion)
          distributed += classRemaining
          return {
            current: Math.max(0, Math.min(cls.level, classRemaining)),
            maximum: cls.level,
            dieType: cls.hitDie
          }
        })
      } else {
        data.hitDice = [{ current: remaining, maximum: level, dieType: 8 }]
      }
      delete data.hitDiceRemaining
    }
    return data
  }
}

export function migrateData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data as Record<string, unknown>
  }

  const record = data as Record<string, unknown>
  let version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1

  while (version < CURRENT_SCHEMA_VERSION) {
    const nextVersion = version + 1
    const migration = MIGRATIONS[nextVersion]
    if (migration) {
      migration(record)
    }
    version = nextVersion
  }

  record.schemaVersion = CURRENT_SCHEMA_VERSION
  return record
}
