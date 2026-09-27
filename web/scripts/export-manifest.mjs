import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { deployment } from './deployment.ts'

const root = new URL('../../dist/', import.meta.url)
const manifest = await deployment()
async function inventory(directory = '') {
  const result = []
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const path = directory + entry.name
    if (entry.isSymbolicLink()) throw new Error(`Symlink in export: ${path}`)
    if (entry.isDirectory()) result.push(...await inventory(path + '/'))
    else if (path !== 'imd-deployment.json') {
      const bytes = await readFile(new URL(path, root))
      if (bytes.length > 8388608) throw new Error(`Asset too large: ${path}`)
      result.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path))
}
manifest.assets = await inventory()
if (manifest.assets.length > 128 || !manifest.assets.some(a => a.path === 'index.html')) throw new Error('Invalid export inventory')
for (const c of manifest.contracts) {
  const bytes = await readFile(new URL(c.abiPath, root))
  const source = await readFile(new URL(`../public/${c.abiPath}`, import.meta.url))
  if (!bytes.equals(source)) throw new Error(`Export ABI differs: ${c.name}`)
}
const serialized = JSON.stringify(manifest, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (await readFile(new URL('imd-deployment.json', root), 'utf8') !== serialized) throw new Error('Stale deployment manifest')
  console.log(`Verified pinned ABIs, deployment, network and all ${manifest.assets.length} asset hashes.`)
} else {
  await writeFile(new URL('imd-deployment.json', root), serialized)
  console.log(`Wrote deployment manifest with ${manifest.assets.length} hashed assets.`)
}
