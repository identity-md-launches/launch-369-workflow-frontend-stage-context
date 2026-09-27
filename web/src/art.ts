import { keccak256, encodePacked } from 'viem'

export interface Artwork { id: number; name: string; image: string; colourA: string; colourB: string; angle: number }
export function decodeTokenURI(uri: string, id: number): Artwork {
  const prefix = 'data:application/json;base64,'
  if (!uri.startsWith(prefix) || uri.length > 100000) throw new Error(`Gradient #${id} has unsupported metadata.`)
  const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(uri.slice(prefix.length)), c => c.charCodeAt(0))))
  const colourA = json.attributes?.find((a: { trait_type: string }) => a.trait_type === 'Colour A')?.value
  const colourB = json.attributes?.find((a: { trait_type: string }) => a.trait_type === 'Colour B')?.value
  const angle = json.attributes?.find((a: { trait_type: string }) => a.trait_type === 'Angle')?.value
  if (json.name !== `Gradient #${id}` || !/^#[0-9a-f]{6}$/.test(colourA) || !/^#[0-9a-f]{6}$/.test(colourB) ||
      !Number.isInteger(angle) || angle < 0 || angle > 359 || !json.image?.startsWith('data:image/svg+xml;base64,'))
    throw new Error(`Gradient #${id} has invalid metadata.`)
  // SVG is displayed only as an image, never injected as HTML or loaded as an active document.
  return { id, name: json.name, image: json.image, colourA, colourB, angle }
}

// A clearly labelled unminted preview, derived from the pinned artOf/svgOf algorithm.
export function previewArt(id: number): Artwork {
  const hash = keccak256(encodePacked(['uint256'], [BigInt(id)])).slice(2)
  const colourA = `#${hash.slice(0, 6)}`, colourB = `#${hash.slice(6, 12)}`
  const angle = parseInt(hash.slice(12, 16), 16) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0" stop-color="${colourA}"/><stop offset="1" stop-color="${colourB}"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/></svg>`
  return { id, name: `Gradient #${id}`, colourA, colourB, angle, image: `data:image/svg+xml;base64,${btoa(svg)}` }
}
