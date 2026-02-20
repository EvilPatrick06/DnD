/**
 * Vehicle types — DMG 2024 Ch.6 / PHB 2024 Ch.6
 */

export interface VehicleData {
  id: string
  name: string
  type: 'water' | 'land' | 'air'
  size: string
  speed: string
  speedFeet: number
  hp: number
  ac: number
  crew: number
  passengers: number
  cargo: string
  cost: string
  reference: string
}

/**
 * Mount rules — PHB 2024 p.368
 * A controlled mount acts on its rider's initiative and can only Dash, Disengage, or Dodge.
 * An independent mount acts on its own initiative with its full range of actions.
 */
export interface MountState {
  mountTokenId: string
  riderTokenId: string
  controlled: boolean
}
