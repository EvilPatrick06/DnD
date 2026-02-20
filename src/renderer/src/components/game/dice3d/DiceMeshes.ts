import * as THREE from 'three'

// ─── Constants ────────────────────────────────────────────────

const DIE_SCALE = 1.0

// ─── Types ────────────────────────────────────────────────────

export interface DiceColors {
  bodyColor: string  // hex e.g. '#1a1a2e'
  numberColor: string // hex e.g. '#f5c542'
}

export const DEFAULT_DICE_COLORS: DiceColors = {
  bodyColor: '#1a1a2e',
  numberColor: '#f5c542'
}

export const DICE_COLOR_PRESETS = [
  { label: 'Obsidian', bodyColor: '#1a1a2e', numberColor: '#f5c542' },
  { label: 'Classic White', bodyColor: '#f0f0f0', numberColor: '#111111' },
  { label: 'Classic Black', bodyColor: '#222222', numberColor: '#ffffff' },
  { label: 'Ruby', bodyColor: '#9b1b30', numberColor: '#ffd700' },
  { label: 'Sapphire', bodyColor: '#1a3a6e', numberColor: '#e0e8ff' },
  { label: 'Emerald', bodyColor: '#1a5e3a', numberColor: '#c0ffd0' },
  { label: 'Amethyst', bodyColor: '#4a1a6e', numberColor: '#e8c0ff' },
  { label: 'Gold', bodyColor: '#8b7320', numberColor: '#1a1a1a' }
] as const

export interface DieDefinition {
  sides: number
  mesh: THREE.Mesh
  faceNormals: THREE.Vector3[] // one per face value (index 0 → face "1")
  wireframe?: THREE.LineSegments
}

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

// ─── Canvas texture generator ─────────────────────────────────

function createDieTexture(
  faceText: string,
  bgColor: string,
  textColor: string,
  size: number = 256
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, size, size)

  // Text
  const fontSize = faceText.length > 2 ? size * 0.3 : faceText.length > 1 ? size * 0.38 : size * 0.5
  ctx.fillStyle = textColor
  ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(faceText, size / 2, size / 2)

  // Underline 6 and 9 to distinguish them
  if (faceText === '6' || faceText === '9') {
    const metrics = ctx.measureText(faceText)
    const underY = size / 2 + fontSize * 0.35
    const hw = metrics.width / 2
    ctx.strokeStyle = textColor
    ctx.lineWidth = Math.max(2, fontSize * 0.06)
    ctx.beginPath()
    ctx.moveTo(size / 2 - hw, underY)
    ctx.lineTo(size / 2 + hw, underY)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Create a hidden die texture with '?' and glow effect */
function createHiddenTexture(bgColor: string, size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, size, size)

  // Glow effect
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.4)
  gradient.addColorStop(0, 'rgba(138, 43, 226, 0.4)')
  gradient.addColorStop(1, 'rgba(138, 43, 226, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const fontSize = size * 0.45
  ctx.fillStyle = '#bb88ff'
  ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', size / 2, size / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// ─── Material factories ──────────────────────────────────────

function createFaceMaterials(
  faceLabels: string[],
  colors: DiceColors,
  isHidden: boolean = false
): THREE.MeshStandardMaterial[] {
  return faceLabels.map((label) => {
    const texture = isHidden
      ? createHiddenTexture(colors.bodyColor)
      : createDieTexture(label, colors.bodyColor, colors.numberColor)
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.15,
      flatShading: false
    })
  })
}

function createSolidMaterial(colors: DiceColors): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.bodyColor),
    roughness: 0.35,
    metalness: 0.15,
    flatShading: false
  })
}

function createWireMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: 0x3a3a5e, linewidth: 1 })
}

// ─── D4 (Tetrahedron) ────────────────────────────────────────
// D4 corner-number: each face shows the number at the TOP vertex

function createD4(colors: DiceColors, isHidden: boolean): DieDefinition {
  const radius = 0.8 * DIE_SCALE
  const geo = new THREE.TetrahedronGeometry(radius)
  geo.computeVertexNormals()

  // D4 uses a single material; we paint numbers at face centers via UV
  // For simplicity, use per-face group materials
  const faceLabels = ['1', '2', '3', '4']

  // TetrahedronGeometry is non-indexed with 12 vertices (4 faces × 3 verts)
  // Assign material groups: each face = 1 triangle = 3 vertices
  const nonIndexedGeo = geo.toNonIndexed()
  for (let i = 0; i < 4; i++) {
    nonIndexedGeo.addGroup(i * 3, 3, i)
  }

  // Create UV coordinates for each face triangle - center the texture
  const uvs = new Float32Array(12 * 2)
  for (let f = 0; f < 4; f++) {
    const base = f * 6
    // Equilateral triangle UVs
    uvs[base] = 0.5; uvs[base + 1] = 1.0   // top
    uvs[base + 2] = 0.0; uvs[base + 3] = 0.0 // bottom-left
    uvs[base + 4] = 1.0; uvs[base + 5] = 0.0 // bottom-right
  }
  nonIndexedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  const materials = createFaceMaterials(faceLabels, colors, isHidden)
  const mesh = new THREE.Mesh(nonIndexedGeo, materials)
  mesh.castShadow = true

  // D4: result = face pointing DOWN (resting face) — value on top vertex
  const faceNormals = computeFaceNormalsFromGeo(nonIndexedGeo, 4)

  const wireGeo = new THREE.EdgesGeometry(nonIndexedGeo)
  const wireframe = new THREE.LineSegments(wireGeo, createWireMaterial())

  return { sides: 4, mesh, faceNormals, wireframe }
}

// ─── D6 (Cube) ───────────────────────────────────────────────

function createD6(colors: DiceColors, isHidden: boolean): DieDefinition {
  const size = 0.7 * DIE_SCALE
  const geo = new THREE.BoxGeometry(size, size, size)

  // BoxGeometry has 6 groups (one per face) by default
  // Face order: +x, -x, +y, -y, +z, -z
  // Standard die: opposite faces sum to 7
  // Map group index to die number
  const faceMap = [4, 3, 5, 2, 1, 6] // +x=4, -x=3, +y=5, -y=2, +z=1, -z=6
  const faceLabels = faceMap.map(String)

  const materials = createFaceMaterials(faceLabels, colors, isHidden)
  const mesh = new THREE.Mesh(geo, materials)
  mesh.castShadow = true

  // Face normals for reading results
  const faceNormals = [
    new THREE.Vector3(0, 0, 1),   // 1 (front, +z)
    new THREE.Vector3(0, -1, 0),  // 2 (bottom, -y)
    new THREE.Vector3(-1, 0, 0),  // 3 (left, -x)
    new THREE.Vector3(1, 0, 0),   // 4 (right, +x)
    new THREE.Vector3(0, 1, 0),   // 5 (top, +y)
    new THREE.Vector3(0, 0, -1)   // 6 (back, -z)
  ]

  const wireGeo = new THREE.EdgesGeometry(geo)
  const wireframe = new THREE.LineSegments(wireGeo, createWireMaterial())

  return { sides: 6, mesh, faceNormals, wireframe }
}

// ─── D8 (Octahedron) ─────────────────────────────────────────

function createD8(colors: DiceColors, isHidden: boolean): DieDefinition {
  const radius = 0.75 * DIE_SCALE
  const geo = new THREE.OctahedronGeometry(radius)

  const nonIndexedGeo = geo.toNonIndexed()
  // 8 triangular faces → 24 vertices
  for (let i = 0; i < 8; i++) {
    nonIndexedGeo.addGroup(i * 3, 3, i)
  }

  // Set UVs for each face
  const uvs = new Float32Array(24 * 2)
  for (let f = 0; f < 8; f++) {
    const base = f * 6
    uvs[base] = 0.5; uvs[base + 1] = 1.0
    uvs[base + 2] = 0.0; uvs[base + 3] = 0.0
    uvs[base + 4] = 1.0; uvs[base + 5] = 0.0
  }
  nonIndexedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  const faceLabels = ['1', '2', '3', '4', '5', '6', '7', '8']
  const materials = createFaceMaterials(faceLabels, colors, isHidden)
  const mesh = new THREE.Mesh(nonIndexedGeo, materials)
  mesh.castShadow = true

  const faceNormals = computeFaceNormalsFromGeo(nonIndexedGeo, 8)

  const wireGeo = new THREE.EdgesGeometry(nonIndexedGeo)
  const wireframe = new THREE.LineSegments(wireGeo, createWireMaterial())

  return { sides: 8, mesh, faceNormals, wireframe }
}

// ─── D10 (Pentagonal Trapezohedron) ──────────────────────────

function createD10(colors: DiceColors, isHidden: boolean, isPercentile: boolean = false): DieDefinition {
  const radius = 0.7 * DIE_SCALE
  const vertices: number[] = []
  const indices: number[] = []

  // Geometry: top apex, upper ring (5), lower ring (5), bottom apex
  const topY = radius * 0.9
  const botY = -radius * 0.9
  const upperY = radius * 0.3
  const lowerY = -radius * 0.3
  const ringR = radius * 0.85

  // Vertex 0: top apex
  vertices.push(0, topY, 0)
  // Vertices 1-5: upper ring
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    vertices.push(Math.cos(angle) * ringR, upperY, Math.sin(angle) * ringR)
  }
  // Vertices 6-10: lower ring (offset by 36°)
  for (let i = 0; i < 5; i++) {
    const angle = ((i + 0.5) / 5) * Math.PI * 2
    vertices.push(Math.cos(angle) * ringR, lowerY, Math.sin(angle) * ringR)
  }
  // Vertex 11: bottom apex
  vertices.push(0, botY, 0)

  // 10 kite faces, each split into 2 triangles
  // Upper 5 kites
  for (let i = 0; i < 5; i++) {
    const u0 = 1 + i
    const u1 = 1 + ((i + 1) % 5)
    const l0 = 6 + i
    indices.push(0, u0, l0)
    indices.push(0, l0, u1)
  }
  // Lower 5 kites
  for (let i = 0; i < 5; i++) {
    const l0 = 6 + i
    const l1 = 6 + ((i + 1) % 5)
    const u1 = 1 + ((i + 1) % 5)
    indices.push(11, l0, l1)
    indices.push(11, l1, u1)
  }

  const baseGeo = new THREE.BufferGeometry()
  baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  baseGeo.setIndex(indices)
  baseGeo.computeVertexNormals()

  // Convert to non-indexed for per-face materials
  const nonIndexedGeo = baseGeo.toNonIndexed()
  // 10 faces × 2 triangles = 20 triangles × 3 verts = 60 vertices
  for (let i = 0; i < 10; i++) {
    nonIndexedGeo.addGroup(i * 6, 6, i)
  }

  // UVs for each kite (2 triangles per face)
  const uvs = new Float32Array(60 * 2)
  for (let f = 0; f < 10; f++) {
    const base = f * 12
    // Triangle 1
    uvs[base] = 0.5; uvs[base + 1] = 1.0
    uvs[base + 2] = 0.0; uvs[base + 3] = 0.5
    uvs[base + 4] = 0.5; uvs[base + 5] = 0.0
    // Triangle 2
    uvs[base + 6] = 0.5; uvs[base + 7] = 1.0
    uvs[base + 8] = 0.5; uvs[base + 9] = 0.0
    uvs[base + 10] = 1.0; uvs[base + 11] = 0.5
  }
  nonIndexedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  // D10 labels: 0-9 for units, 00-90 for percentile (tens)
  const faceLabels = isPercentile
    ? ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90']
    : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

  const materials = createFaceMaterials(faceLabels, colors, isHidden)
  const mesh = new THREE.Mesh(nonIndexedGeo, materials)
  mesh.castShadow = true

  const faceNormals = computeFaceNormalsFromGeo(nonIndexedGeo, 10)

  const wireGeo = new THREE.EdgesGeometry(nonIndexedGeo)
  const wireframe = new THREE.LineSegments(wireGeo, createWireMaterial())

  return { sides: 10, mesh, faceNormals, wireframe }
}

// ─── D12 (Dodecahedron) ──────────────────────────────────────

function createD12(colors: DiceColors, isHidden: boolean): DieDefinition {
  const radius = 0.75 * DIE_SCALE
  const geo = new THREE.DodecahedronGeometry(radius)

  const nonIndexedGeo = geo.toNonIndexed()
  // Dodecahedron: 12 pentagonal faces → each tessellated to 3 triangles = 36 triangles
  const totalVerts = nonIndexedGeo.getAttribute('position').count
  const trisPerFace = totalVerts / (12 * 3) > 1 ? 3 : 1
  const vertsPerFace = trisPerFace * 3

  for (let i = 0; i < 12; i++) {
    nonIndexedGeo.addGroup(i * vertsPerFace, vertsPerFace, i)
  }

  // UVs
  const uvCount = totalVerts
  const uvs = new Float32Array(uvCount * 2)
  for (let f = 0; f < 12; f++) {
    for (let t = 0; t < trisPerFace; t++) {
      const base = (f * vertsPerFace + t * 3) * 2
      uvs[base] = 0.5; uvs[base + 1] = 1.0
      uvs[base + 2] = 0.0; uvs[base + 3] = 0.0
      uvs[base + 4] = 1.0; uvs[base + 5] = 0.0
    }
  }
  nonIndexedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  const faceLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  const materials = createFaceMaterials(faceLabels, colors, isHidden)
  const mesh = new THREE.Mesh(nonIndexedGeo, materials)
  mesh.castShadow = true

  const faceNormals = computeFaceNormalsFromGeo(nonIndexedGeo, 12)

  const wireGeo = new THREE.EdgesGeometry(nonIndexedGeo)
  const wireframe = new THREE.LineSegments(wireGeo, createWireMaterial())

  return { sides: 12, mesh, faceNormals, wireframe }
}

// ─── D20 (Icosahedron) ───────────────────────────────────────

function createD20(colors: DiceColors, isHidden: boolean): DieDefinition {
  const radius = 0.8 * DIE_SCALE
  const geo = new THREE.IcosahedronGeometry(radius)

  const nonIndexedGeo = geo.toNonIndexed()
  // 20 triangular faces → 60 vertices
  for (let i = 0; i < 20; i++) {
    nonIndexedGeo.addGroup(i * 3, 3, i)
  }

  const uvs = new Float32Array(60 * 2)
  for (let f = 0; f < 20; f++) {
    const base = f * 6
    uvs[base] = 0.5; uvs[base + 1] = 1.0
    uvs[base + 2] = 0.0; uvs[base + 3] = 0.0
    uvs[base + 4] = 1.0; uvs[base + 5] = 0.0
  }
  nonIndexedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  const faceLabels = Array.from({ length: 20 }, (_, i) => String(i + 1))
  const materials = createFaceMaterials(faceLabels, colors, isHidden)
  const mesh = new THREE.Mesh(nonIndexedGeo, materials)
  mesh.castShadow = true

  const faceNormals = computeFaceNormalsFromGeo(nonIndexedGeo, 20)

  const wireGeo = new THREE.EdgesGeometry(nonIndexedGeo)
  const wireframe = new THREE.LineSegments(wireGeo, createWireMaterial())

  return { sides: 20, mesh, faceNormals, wireframe }
}

// ─── Face normal extraction ──────────────────────────────────

function computeFaceNormalsFromGeo(geo: THREE.BufferGeometry, faceCount: number): THREE.Vector3[] {
  const pos = geo.getAttribute('position')
  const normals: THREE.Vector3[] = []
  const totalVerts = pos.count
  const vertsPerFace = Math.floor(totalVerts / faceCount)

  for (let f = 0; f < faceCount; f++) {
    const normal = new THREE.Vector3()
    const tris = Math.floor(vertsPerFace / 3)

    for (let t = 0; t < tris; t++) {
      const base = f * vertsPerFace + t * 3
      if (base + 2 >= totalVerts) break
      const a = new THREE.Vector3().fromBufferAttribute(pos, base)
      const b = new THREE.Vector3().fromBufferAttribute(pos, base + 1)
      const c = new THREE.Vector3().fromBufferAttribute(pos, base + 2)
      const e1 = new THREE.Vector3().subVectors(b, a)
      const e2 = new THREE.Vector3().subVectors(c, a)
      normal.add(new THREE.Vector3().crossVectors(e1, e2))
    }

    normals.push(normal.normalize())
  }

  return normals
}

// ─── Die creation API ────────────────────────────────────────

export interface CreateDieOptions {
  colors?: DiceColors
  isHidden?: boolean
}

export function createDie(type: DieType, options: CreateDieOptions = {}): DieDefinition {
  const colors = options.colors || DEFAULT_DICE_COLORS
  const isHidden = options.isHidden || false

  switch (type) {
    case 'd4': return createD4(colors, isHidden)
    case 'd6': return createD6(colors, isHidden)
    case 'd8': return createD8(colors, isHidden)
    case 'd10': return createD10(colors, isHidden, false)
    case 'd12': return createD12(colors, isHidden)
    case 'd20': return createD20(colors, isHidden)
    case 'd100': return createD10(colors, isHidden, true)
  }
}

// ─── Read face result from orientation ────────────────────────

/**
 * Given a die definition and its current quaternion, determine which face
 * value is pointing UP (highest dot product with world UP vector).
 * For d4, we read the bottom face instead.
 */
export function readDieResult(def: DieDefinition, quaternion: THREE.Quaternion): number {
  const up = new THREE.Vector3(0, 1, 0)

  // For D4, the result is printed at the TOP of the resting face
  // The resting face is the one pointing DOWN
  const isD4 = def.sides === 4

  let bestValue = 1
  let bestDot = isD4 ? Infinity : -Infinity

  for (let i = 0; i < def.faceNormals.length; i++) {
    const normal = def.faceNormals[i].clone().applyQuaternion(quaternion)
    const dot = normal.dot(up)

    if (isD4) {
      if (dot < bestDot) {
        bestDot = dot
        bestValue = i + 1
      }
    } else {
      if (dot > bestDot) {
        bestDot = dot
        bestValue = i + 1
      }
    }
  }

  return bestValue
}

// ─── Color helpers ────────────────────────────────────────────

/** Tint a die with crit/fumble highlight */
export function tintDie(def: DieDefinition, color: number): void {
  const materials = Array.isArray(def.mesh.material)
    ? def.mesh.material
    : [def.mesh.material]

  for (const mat of materials) {
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.emissive.setHex(color)
      mat.emissiveIntensity = 0.4
    }
  }
}

/** Highlight color for nat 20 / crit */
export const CRIT_COLOR = 0x22c55e // green-500
export const FUMBLE_COLOR = 0xef4444 // red-500
