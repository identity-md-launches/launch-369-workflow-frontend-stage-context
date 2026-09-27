import {
  createPublicClient, createWalletClient, custom, defineChain, fallback, http,
  formatUnits, type Address, type EIP1193Provider, type Hash,
} from 'viem'
import type { Config } from './config'

declare global { interface Window { ethereum?: EIP1193Provider } }

export function createService(config: Config, provider?: EIP1193Provider) {
  const d = config.deployment
  const chain = defineChain({ id: d.chainId, name: d.network.name,
    nativeCurrency: d.network.nativeCurrency, rpcUrls: { default: { http: d.network.rpcUrls } },
    testnet: d.network.testnet })
  const transports = d.network.rpcUrls.map(url => http(url, { timeout: 8000, retryCount: 0 }))
  const client = createPublicClient({ chain, transport: fallback([
    ...transports, ...(provider ? [custom(provider, { retryCount: 0 })] : []),
  ], { retryCount: 0 }), pollingInterval: 2500 })
  const readNft = (functionName: string, args?: readonly unknown[], blockNumber?: bigint) =>
    client.readContract({ ...config.nft, functionName, args, blockNumber })
  // The token address is obtained from token(); its attested binding is verified before any token read/write.
  async function verify() {
    if (await client.getChainId() !== d.chainId) throw new Error('RPC returned the wrong network. Refresh to retry.')
    const code = await Promise.all(d.contracts.map(c => client.getCode({ address: c.address })))
    if (code.some(c => !c || c === '0x')) throw new Error('Deployed contract code is missing. Minting is unavailable.')
    const address = await readNft('token') as Address
    if (address.toLowerCase() !== config.token.address.toLowerCase()) throw new Error('GRAD token binding does not match the deployment.')
    return address
  }
  async function snapshot(account?: Address) {
    const tokenAddress = await verify()
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
    const [total, max, price, burned, maxPerMint, decimals, balance, allowance] = await Promise.all([
      ...['totalMinted', 'MAX_SUPPLY', 'PRICE', 'burnedTotal', 'MAX_PER_MINT'].map(fn => readNft(fn, [], blockNumber)),
      client.readContract({ ...config.token, address: tokenAddress, functionName: 'decimals', blockNumber }),
      account ? client.readContract({ ...config.token, address: tokenAddress, functionName: 'balanceOf', args: [account], blockNumber }) : undefined,
      account ? client.readContract({ ...config.token, address: tokenAddress, functionName: 'allowance', args: [account, config.nft.address], blockNumber }) : undefined,
    ])
    if (Number(decimals) !== 18 || Number(maxPerMint) !== 10 || Number(max) !== 1000 ||
      Number(total) < 0 || Number(total) > Number(max)) throw new Error('Unexpected contract state. Minting is unavailable.')
    return { total: Number(total), max: Number(max), price: price as bigint, burned: burned as bigint,
      decimals: Number(decimals), balance: balance as bigint | undefined, allowance: allowance as bigint | undefined,
      tokenAddress, blockNumber, account, checkedAt: Date.now() }
  }
  async function walletGuard(account: Address) {
    if (!provider) throw new Error('Open this page in a browser with an Ethereum wallet.')
    const [chainId, accounts] = await Promise.all([
      provider.request({ method: 'eth_chainId' }), provider.request({ method: 'eth_accounts' }),
    ])
    if (Number(chainId) !== d.chainId) throw new Error(`Switch to ${d.network.name} before continuing.`)
    if (accounts[0]?.toLowerCase() !== account.toLowerCase()) throw new Error('Wallet account changed. Refresh and try again.')
  }
  async function transact(kind: 'approve' | 'mint', quantity: number, account: Address, onHash: (hash: Hash) => void) {
    await walletGuard(account)
    const current = await snapshot(account)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Choose 1–10 gradients.')
    if (quantity > current.max - current.total) throw new Error('Not enough gradients remain. Choose a smaller quantity.')
    const cost = current.price * BigInt(quantity)
    if (current.balance === undefined || current.balance < cost) throw new Error('Insufficient GRAD. Get GRAD from the launch pool, then refresh.')
    if (kind === 'mint' && (current.allowance === undefined || current.allowance < cost)) throw new Error('Approve the mint cost in GRAD first.')
    const contract = kind === 'approve' ? { ...config.token, address: current.tokenAddress } : config.nft
    const { request } = await client.simulateContract({ ...contract, account,
      functionName: kind === 'approve' ? 'approve' : 'mint',
      args: kind === 'approve' ? [config.nft.address, cost] : [BigInt(quantity)],
    })
    await walletGuard(account)
    const wallet = createWalletClient({ chain, transport: custom(provider!) })
    const hash = await wallet.writeContract(request)
    onHash(hash)
    let replaced = false
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180000,
      onReplaced: replacement => { onHash(replacement.transaction.hash); replaced = replacement.reason !== 'repriced' },
    })
    if (replaced) throw new Error('Transaction was replaced or cancelled. Check it in the explorer and refresh before trying again.')
    if (receipt.status !== 'success') throw new Error('Transaction reverted. Refresh balances and try again.')
    return receipt
  }
  return { snapshot, transact, tokenURI: (id: number) => readNft('tokenURI', [BigInt(id)]) as Promise<string> }
}
export type Service = ReturnType<typeof createService>
export type Snapshot = Awaited<ReturnType<Service['snapshot']>>

export async function switchNetwork(provider: EIP1193Provider, config: Config) {
  const id = config.deployment.walletAddChain.chainId as `0x${string}`
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: id }] }) }
  catch (error) {
    const e = error as { code?: number; message?: string; data?: { originalError?: { code?: number } } }
    if (e.code !== 4902 && e.data?.originalError?.code !== 4902 && !/unknown chain|unrecognized chain|not added/i.test(e.message ?? '')) throw error
    await provider.request({ method: 'wallet_addEthereumChain', params: [config.deployment.walletAddChain as never] })
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: id }] })
  }
}
export function amount(value: bigint, decimals: number) {
  const [whole, fraction] = formatUnits(value, decimals).split('.')
  return BigInt(whole).toLocaleString('en-US') + (fraction ? `.${fraction}` : '')
}
export function errorMessage(error: unknown) {
  const e = error as { code?: number; shortMessage?: string; message?: string }
  const message = e.shortMessage || e.message || 'Request failed. Check your connection and try again.'
  if (e.code === 4001 || /user rejected|user denied/i.test(message)) return 'Request declined in your wallet. You can try again when ready.'
  return message.length > 320 ? message.slice(0, 320) + '…' : message
}
