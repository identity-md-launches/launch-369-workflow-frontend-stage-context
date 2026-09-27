import { readFileSync } from 'node:fs'
import { decodeFunctionData, encodeErrorResult, encodeFunctionResult, encodePacked, keccak256, type Abi, type Hex } from 'viem'
import type { Page } from '@playwright/test'

const manifest = JSON.parse(readFileSync(new URL('../../dist/imd-deployment.json', import.meta.url), 'utf8'))
export const token = manifest.contracts.find((c: { name: string }) => c.name === 'LaunchToken')
export const nft = manifest.contracts.find((c: { name: string }) => c.name === 'GradientNFT')
const tokenAbi: Abi = JSON.parse(readFileSync(new URL(`../../dist/${token.abiPath}`, import.meta.url), 'utf8'))
const nftAbi: Abi = JSON.parse(readFileSync(new URL(`../../dist/${nft.abiPath}`, import.meta.url), 'utf8'))
export const account = '0x1111111111111111111111111111111111111111'
export const price = 10000n * 10n ** 18n
export const txHash = `0x${'ab'.repeat(32)}`
const blockHash = `0x${'bc'.repeat(32)}`
export interface MockState {
  total: number; balance: bigint; allowance: bigint; connected: boolean; chain: string
  missingChain: boolean; failRpc: boolean; noCode: boolean; tokenMismatch: boolean
  reject: boolean; revert: boolean; receiptReverts: boolean; malformedArt: boolean
  calls: { method: string; params: unknown[] }[]
  sends: { to: string; functionName: string; args: unknown[]; value?: string }[]
}
export function metadata(id: number) {
  const hash = keccak256(encodePacked(['uint256'], [BigInt(id)])).slice(2)
  const a = `#${hash.slice(0, 6)}`, b = `#${hash.slice(6, 12)}`, angle = parseInt(hash.slice(12, 16), 16) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/></svg>`
  return 'data:application/json;base64,' + Buffer.from(JSON.stringify({
    name: `Gradient #${id}`, description: 'Contract-compatible fixture',
    attributes: [{ trait_type: 'Colour A', value: a }, { trait_type: 'Colour B', value: b }, { trait_type: 'Angle', value: angle }],
    image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'),
  })).toString('base64')
}
export async function mockChain(page: Page, options: Partial<MockState> = {}, wallet = true) {
  const state: MockState = { total: 26, balance: price * 20n, allowance: 0n, connected: false,
    chain: manifest.walletAddChain.chainId, missingChain: false, failRpc: false, noCode: false,
    tokenMismatch: false, reject: false, revert: false, receiptReverts: false, malformedArt: false,
    calls: [], sends: [], ...options }
  function rpc(method: string, params: any[] = []): any {
    state.calls.push({ method, params })
    if (state.failRpc && !['eth_accounts', 'eth_requestAccounts', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(method))
      return { error: { code: -32000, message: 'Fixture RPC unavailable. Refresh to retry.' } }
    if (method === 'eth_chainId') return state.chain
    if (method === 'eth_blockNumber') return '0xb40001'
    if (method === 'eth_getCode') return state.noCode ? '0x' : '0x6001600055'
    if (method === 'eth_accounts') return state.connected ? [account] : []
    if (method === 'eth_requestAccounts') {
      if (state.reject) return { error: { code: 4001, message: 'User rejected request' } }
      state.connected = true; return [account]
    }
    if (method === 'wallet_switchEthereumChain') {
      if (state.reject) return { error: { code: 4001, message: 'User rejected request' } }
      if (state.missingChain) return { error: { code: 4902, message: 'Unknown chain' } }
      state.chain = params[0].chainId; return null
    }
    if (method === 'wallet_addEthereumChain') { state.missingChain = false; return null }
    if (method === 'eth_sendTransaction') {
      if (state.reject) return { error: { code: 4001, message: 'User rejected request' } }
      const transaction = params[0]
      const abi = transaction.to.toLowerCase() === token.address.toLowerCase() ? tokenAbi : nftAbi
      const decoded = decodeFunctionData({ abi, data: transaction.data })
      state.sends.push({ to: transaction.to, functionName: decoded.functionName, args: [...decoded.args ?? []], value: transaction.value })
      if (!state.receiptReverts) {
        if (decoded.functionName === 'approve') state.allowance = decoded.args![1] as bigint
        if (decoded.functionName === 'mint') {
          const quantity = Number(decoded.args![0]); state.total += quantity; state.balance -= price * BigInt(quantity); state.allowance -= price * BigInt(quantity)
        }
      }
      return txHash
    }
    if (method === 'eth_getTransactionReceipt') return {
      transactionHash: txHash, transactionIndex: '0x0', blockHash, blockNumber: '0xb40001', from: account, to: nft.address,
      cumulativeGasUsed: '0x5208', gasUsed: '0x5208', effectiveGasPrice: '0x1', contractAddress: null,
      logs: [], logsBloom: `0x${'00'.repeat(256)}`, status: state.receiptReverts ? '0x0' : '0x1', type: '0x2',
    }
    if (method === 'eth_call') {
      const transaction = params[0]
      const abi = transaction.to.toLowerCase() === token.address.toLowerCase() ? tokenAbi : nftAbi
      const { functionName, args } = decodeFunctionData({ abi, data: transaction.data })
      if (functionName === 'mint' && state.revert) return { error: { code: 3, message: 'execution reverted', data: encodeErrorResult({ abi: nftAbi, errorName: 'ExceedsMaxSupply', args: [10n, 1n] }) } }
      const values: Record<string, unknown> = {
        token: state.tokenMismatch ? account : token.address,
        totalMinted: BigInt(state.total), MAX_SUPPLY: 1000n, MAX_PER_MINT: 10n,
        PRICE: price, burnedTotal: price * BigInt(state.total), decimals: 18,
        balanceOf: state.balance, allowance: state.allowance, approve: true,
      }
      if (functionName === 'tokenURI') values.tokenURI = state.malformedArt && Number(args![0]) === 1 ? 'data:application/json;base64,bad' : metadata(Number(args![0]))
      if (functionName === 'mint') return '0x'
      if (!(functionName in values)) throw new Error(`Unsupported fixture function: ${functionName}`)
      return encodeFunctionResult({ abi, functionName, result: values[functionName] })
    }
    throw new Error(`Unsupported fixture RPC: ${method}`)
  }
  for (const url of manifest.network.rpcUrls) await page.route(`${url}/**`, async route => {
    const payload = route.request().postDataJSON()
    const run = (request: any) => {
      // Public RPC remains on the configured chain regardless of wallet's selected chain.
      const result = request.method === 'eth_chainId' && !state.failRpc ? manifest.walletAddChain.chainId : rpc(request.method, request.params)
      return result?.error ? { jsonrpc: '2.0', id: request.id, error: result.error } : { jsonrpc: '2.0', id: request.id, result }
    }
    await route.fulfill({ json: Array.isArray(payload) ? payload.map(run) : run(payload) })
  })
  if (wallet) {
    await page.exposeFunction('__walletRequest', ({ method, params }: { method: string; params: unknown[] }) => rpc(method, params))
    await page.addInitScript(() => {
      const listeners: Record<string, ((value: any) => void)[]> = {}
      ;(window as any).__emit = (event: string, value: any) => (listeners[event] ?? []).forEach(fn => fn(value))
      ;(window as any).ethereum = {
        request: async (request: any) => {
          const result = await (window as any).__walletRequest(request)
          if (result?.error) throw Object.assign(new Error(result.error.message), result.error)
          return result
        },
        on: (event: string, fn: (value: any) => void) => { (listeners[event] ??= []).push(fn) },
        removeListener: (event: string, fn: (value: any) => void) => { listeners[event] = (listeners[event] ?? []).filter(f => f !== fn) },
      }
    })
  }
  return state
}
