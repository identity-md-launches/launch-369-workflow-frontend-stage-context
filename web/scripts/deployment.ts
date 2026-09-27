import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { keccak256, toBytes } from 'viem'
import { canonical } from '../src/canonical.ts'

export async function deployment() {
  const handoff = JSON.parse(await readFile(new URL('../deployment/handoff.json', import.meta.url), 'utf8'))
  const network = JSON.parse(await readFile(new URL('../deployment/network.json', import.meta.url), 'utf8'))
  if (handoff.chainId !== network.network.chainId || Number(network.walletAddChain.chainId) !== handoff.chainId)
    throw new Error('Handoff/network chain mismatch')
  const contracts = []
  for (const contract of handoff.contracts) {
    if (!/^[A-Za-z0-9_]+$/.test(contract.name)) throw new Error('Invalid contract name')
    const path = `abi/${contract.name}.json`
    const bytes = await readFile(new URL(`../public/${path}`, import.meta.url), 'utf8')
    const pinned = execFileSync('git', ['show', `${handoff.sourceCommit}:docs/${path}`], { encoding: 'utf8' })
    if (bytes !== pinned) throw new Error(`${path} differs from pinned source`)
    const abi = JSON.parse(bytes)
    if (!Array.isArray(abi) || keccak256(toBytes(canonical(abi))).slice(2) !== contract.abiHash)
      throw new Error(`${path} canonical ABI hash mismatch`)
    contracts.push({ name: contract.name, address: contract.address, abiHash: contract.abiHash, abiPath: path })
  }
  return {
    version: 1, launchId: handoff.launchId, chainId: handoff.chainId,
    sourceCommit: handoff.sourceCommit, attestationHash: handoff.attestationHash,
    contracts, assets: [] as { path: string; sha256: string }[],
    network: network.network, walletAddChain: network.walletAddChain,
  }
}
