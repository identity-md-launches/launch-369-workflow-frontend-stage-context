import { keccak256, toBytes, isAddress, type Abi, type Address } from 'viem'
import { canonical } from './canonical'

export interface Deployment {
  version: 1
  launchId: string
  chainId: number
  sourceCommit: string
  attestationHash: string
  contracts: { name: string; address: Address; abiHash: string; abiPath: string }[]
  assets: { path: string; sha256: string }[]
  network: {
    chainId: number; name: string; testnet: boolean; rpcUrls: string[]; explorer: string
    nativeCurrency: { name: string; symbol: string; decimals: number }
    faucets: string[]; uniswapV4: Record<string, Address>
  }
  walletAddChain: {
    chainId: string; chainName: string; rpcUrls: string[]
    nativeCurrency: Deployment['network']['nativeCurrency']; blockExplorerUrls: string[]
  }
}
export interface Config {
  deployment: Deployment
  nft: { address: Address; abi: Abi }
  token: { address: Address; abi: Abi }
}
const safePath = (path: string) => /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..')

export async function loadConfig(): Promise<Config> {
  const response = await fetch(new URL('imd-deployment.json', document.baseURI))
  if (!response.ok) throw new Error('Deployment configuration could not load. Reload to try again.')
  const d: Deployment = await response.json()
  if (d.version !== 1 || !Number.isSafeInteger(d.chainId) || d.network.chainId !== d.chainId ||
      Number(d.walletAddChain.chainId) !== d.chainId || !d.network.rpcUrls.length ||
      d.contracts.length !== 2 || new Set(d.contracts.map(c => c.name)).size !== 2)
    throw new Error('Deployment configuration is invalid. Minting is unavailable.')
  const contracts = await Promise.all(d.contracts.map(async contract => {
    if (!safePath(contract.abiPath) || !isAddress(contract.address)) throw new Error('Invalid deployment contract.')
    const response = await fetch(new URL(contract.abiPath, document.baseURI))
    if (!response.ok) throw new Error(`Could not load ${contract.name} ABI. Reload to try again.`)
    const abi: Abi = await response.json()
    if (!Array.isArray(abi) || keccak256(toBytes(canonical(abi))).slice(2) !== contract.abiHash)
      throw new Error(`${contract.name} ABI verification failed. Minting is unavailable.`)
    return { ...contract, abi }
  }))
  const nft = contracts.find(c => c.name === 'GradientNFT')
  const token = contracts.find(c => c.name === 'LaunchToken')
  if (!nft || !token) throw new Error('Required deployment contracts are missing.')
  return { deployment: d, nft, token }
}
