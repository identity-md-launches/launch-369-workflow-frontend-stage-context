import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'
import type { Config } from './config'
import { amount, createService, errorMessage, switchNetwork, type Service, type Snapshot } from './chain'
import { decodeTokenURI, previewArt, type Artwork } from './art'

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
const preview = previewArt(1)

function Gallery({ service, total, explorer, address }: { service: Service; total?: number; explorer: string; address: Address }) {
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const [items, setItems] = useState<{ id: number; art?: Artwork }[]>([])
  const [loading, setLoading] = useState(false)
  const pages = Math.max(1, Math.ceil((total ?? 0) / 24))
  const currentPage = Math.min(page, pages - 1)
  useEffect(() => {
    let stopped = false
    setItems([])
    if (!total) { setLoading(false); return }
    setLoading(true)
    const ids = Array.from({ length: Math.min(24, total - currentPage * 24) }, (_, i) => currentPage * 24 + i + 1)
    void (async () => {
      const result: { id: number; art?: Artwork }[] = []
      for (let start = 0; start < ids.length; start += 6) {
        if (stopped) return
        const batch = await Promise.all(ids.slice(start, start + 6).map(async id => {
          try { return { id, art: decodeTokenURI(await service.tokenURI(id), id) } }
          catch { return { id } }
        }))
        result.push(...batch)
      }
      if (!stopped) { setItems(result); setLoading(false) }
    })()
    return () => { stopped = true }
  }, [service, total, currentPage, retry])
  const failed = items.some(item => !item.art)
  return <section id="collection" className="collection" aria-labelledby="collection-title">
    <div className="section-heading">
      <div><span className="eyebrow">The onchain collection</span><h2 id="collection-title">Every shade has a number.</h2></div>
      <span className="meta">{total === undefined ? 'Waiting for live supply' : `${total.toLocaleString('en-US')} minted`} · 24 per page</span>
    </div>
    <div aria-live="polite" className="gallery-status">
      {loading && <p>Loading gradients from the contract…</p>}
      {failed && <p role="alert">Some artwork could not load. <button className="text-button" onClick={() => setRetry(r => r + 1)}>Retry artwork</button></p>}
    </div>
    {total === 0 && <div className="empty-state"><span className="empty-art" aria-hidden="true" /><h3>A collection waiting to begin.</h3><p>The first minted gradient will appear here. <a href="#mint">Mint a gradient</a> to start the collection.</p></div>}
    {total === undefined && <div className="empty-state"><h3>The gallery is waiting for a connection.</h3><p>Refresh live data above to load the minted collection.</p></div>}
    <div className="gallery-grid" aria-busy={loading}>
      {loading ? Array.from({ length: Math.min(24, (total ?? 24) - currentPage * 24) }, (_, id) => <div className="skeleton" key={id} aria-hidden="true" />) : items.map(({ id, art }) => <article className="art-card" key={id}>
        {art ? <img width="512" height="512" loading="lazy" src={art.image} alt={`${art.name}: ${art.colourA} to ${art.colourB}, ${art.angle} degrees`} /> : <div className="unavailable">Artwork unavailable</div>}
        <div className="art-caption"><h3><a href={`${explorer}/nft/${address}/${id}`} target="_blank" rel="noreferrer">Gradient #{id}<span aria-hidden="true"> ↗</span></a></h3><span className="meta">{art ? `${art.angle}°` : '—'}</span></div>
        {art && <p className="colour-pair"><span><i style={{ background: art.colourA }} />{art.colourA}</span><span><i style={{ background: art.colourB }} />{art.colourB}</span></p>}
      </article>)}
    </div>
    {!!total && <nav className="pagination" aria-label="Gallery pages">
      <button disabled={currentPage === 0 || loading} onClick={() => setPage(currentPage - 1)}>← Previous</button>
      <span role="status">Page {currentPage + 1} of {pages}</span>
      <button disabled={currentPage + 1 >= pages || loading} onClick={() => setPage(currentPage + 1)}>Next →</button>
    </nav>}
  </section>
}

export default function App({ config }: { config: Config }) {
  const provider = window.ethereum
  const service = useMemo(() => createService(config, provider), [config, provider])
  const [account, setAccount] = useState<Address>()
  const [walletChain, setWalletChain] = useState<number>()
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [readError, setReadError] = useState('')
  const [reading, setReading] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [txError, setTxError] = useState('')
  const [txHash, setTxHash] = useState<Hash>()
  const sequence = useRef(0)
  const readInFlight = useRef(false)
  const locallyDisconnected = useRef(false)
  const d = config.deployment
  const rightChain = walletChain === d.chainId
  const refresh = useCallback(async () => {
    const id = ++sequence.current
    readInFlight.current = true
    setReading(true)
    try {
      const next = await service.snapshot(account)
      if (sequence.current === id) { setSnapshot(next); setReadError('') }
    } catch (error) {
      if (sequence.current === id) { setSnapshot(undefined); setReadError(errorMessage(error)) }
    } finally { if (sequence.current === id) { readInFlight.current = false; setReading(false) } }
  }, [service, account])
  useEffect(() => {
    setSnapshot(undefined)
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden && !busy && !readInFlight.current) void refresh() }, 15000)
    const onVisible = () => { if (!document.hidden && !busy && !readInFlight.current) void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { sequence.current++; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh, walletChain, busy])

  useEffect(() => {
    if (!provider) return
    let alive = true
    const onAccounts = (accounts: string[]) => {
      sequence.current++; setSnapshot(undefined)
      if (!locallyDisconnected.current) setAccount(accounts[0] as Address | undefined)
    }
    const onChain = (id: string) => { sequence.current++; setSnapshot(undefined); setWalletChain(Number(id)); setWalletError('') }
    const onDisconnect = () => { onAccounts([]); setWalletChain(undefined) }
    void Promise.all([provider.request({ method: 'eth_accounts' }), provider.request({ method: 'eth_chainId' })])
      .then(([accounts, chain]) => { if (alive) { onAccounts(accounts); onChain(chain) } }).catch(() => {})
    provider.on('accountsChanged', onAccounts)
    provider.on('chainChanged', onChain)
    provider.on('disconnect', onDisconnect)
    return () => {
      alive = false; provider.removeListener('accountsChanged', onAccounts)
      provider.removeListener('chainChanged', onChain); provider.removeListener('disconnect', onDisconnect)
    }
  }, [provider])

  async function connect() {
    setWalletError('')
    if (!provider) { setWalletError('No browser wallet found. Open this page in an Ethereum wallet browser, or install a browser wallet and reload.'); return }
    setWalletBusy(true)
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      if (!accounts.length) throw new Error('No account selected. Choose an account in your wallet and try again.')
      locallyDisconnected.current = false
      setAccount(accounts[0]); setWalletChain(Number(await provider.request({ method: 'eth_chainId' })))
    } catch (error) { setWalletError(errorMessage(error)) }
    finally { setWalletBusy(false) }
  }
  async function switchChain() {
    if (!provider) return
    setWalletBusy(true); setWalletError('')
    try { await switchNetwork(provider, config); setWalletChain(Number(await provider.request({ method: 'eth_chainId' }))) }
    catch (error) { setWalletError(errorMessage(error)) }
    finally { setWalletBusy(false) }
  }
  const walletData = snapshot?.account === account && !!account
  const cost = (snapshot?.price ?? 0n) * BigInt(quantity)
  const remaining = snapshot ? snapshot.max - snapshot.total : undefined
  const balance = walletData ? snapshot?.balance : undefined
  const allowance = walletData ? snapshot?.allowance : undefined
  const approved = allowance !== undefined && allowance >= cost && cost > 0n
  const insufficient = balance !== undefined && balance < cost
  const canAct = !!account && rightChain && !!snapshot && walletData && !busy && !reading && !readError &&
    balance !== undefined && !insufficient && quantity <= (remaining ?? 0)

  async function transact(kind: 'approve' | 'mint') {
    if (!canAct || !account || (kind === 'mint' && !approved)) return
    setBusy(true); setTxError(''); setTxHash(undefined); setStatus('Checking current state and simulating your transaction. Then confirm in your wallet.')
    try {
      await service.transact(kind, quantity, account, hash => { setTxHash(hash); setStatus('Transaction submitted. Waiting for confirmation…') })
      setStatus(kind === 'approve' ? `Approval confirmed. ${short(account)} can now mint with this allowance.` : `Mint confirmed. ${quantity} ${quantity === 1 ? 'gradient' : 'gradients'} minted to ${short(account)}.`)
    } catch (error) { setStatus(''); setTxError(errorMessage(error)) }
    finally { setBusy(false); void refresh() }
  }
  const money = (value: bigint | undefined) => value === undefined ? '—' : amount(value, snapshot?.decimals ?? 18)
  const hint = !account ? 'Connect a wallet to check your GRAD and start minting.' : !rightChain ? `Your wallet is on another network. Switch to ${d.network.name} to mint.` : !snapshot ? 'Waiting for verified contract reads. Use Refresh live data to retry.' : remaining === 0 ? 'All 1,000 gradients have been minted.' : quantity > (remaining ?? 0) ? `Only ${remaining} remain. Choose a smaller quantity.` : insufficient ? 'You need more GRAD for this quantity. Get GRAD from the launch pool, then refresh.' : approved ? 'Allowance is ready. Minting permanently burns the total below.' : 'First, approve the exact mint cost. Then mint in a separate transaction.'

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header shell">
      <a href="#" className="wordmark" aria-label="Gradients home"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>gradients</a>
      <nav className="header-nav" aria-label="Main navigation"><a href="#collection">Collection</a><a href="#about">The idea</a></nav>
      <div className="wallet-control"><span className="network-tag"><i />{d.network.name} testnet</span>
        {account ? <button disabled={busy || walletBusy} onClick={() => { locallyDisconnected.current = true; sequence.current++; setAccount(undefined); setSnapshot(undefined); setWalletError(''); setStatus(''); setTxError(''); setTxHash(undefined) }} aria-label={`Disconnect ${account}`}>{short(account)} <span aria-hidden="true">×</span></button>
          : <button onClick={() => void connect()} disabled={walletBusy}>{walletBusy ? 'Connecting…' : 'Connect wallet'} <span aria-hidden="true">↗</span></button>}
      </div>
    </header>
    <main id="main" className="shell">
      <section className="intro" aria-labelledby="page-title">
        <div><span className="eyebrow"><span className="tiny-square" /> An experiment in onchain color</span><h1 id="page-title">Color, made<br /><em>permanent.</em></h1></div>
        <div className="intro-copy"><p>Two colors. One gradient.<br />A small piece of the spectrum, yours to keep.</p><p className="muted">1,000 editions. Generated and stored entirely onchain.</p><a className="inline-link" href="#collection">Explore the collection <span aria-hidden="true">↓</span></a></div>
      </section>
      <section className="mint-layout" aria-label="Artwork preview and mint">
        <figure className="featured-art">
          <div className="art-stage"><img width="512" height="512" src={preview.image} alt={`Algorithm preview for Gradient #1: ${preview.colourA} to ${preview.colourB}`} /><div className="art-stamp" aria-hidden="true">G / 001</div></div>
          <figcaption><div><span className="eyebrow">Algorithm preview · #001</span><p>Art follows the number.</p></div><div className="preview-colors"><span><i style={{ background: preview.colourA }} />{preview.colourA}</span><span><i style={{ background: preview.colourB }} />{preview.colourB}</span><span>{preview.angle}°</span></div></figcaption>
        </figure>
        <section id="mint" className="mint-panel" aria-labelledby="mint-title">
          <div className="mint-heading"><h2 id="mint-title">Make one yours.</h2><span className="edition-tag">{d.network.name} · 1,000 editions</span></div>
          <p className="muted">Mint 1–10 gradients. Each edition burns {snapshot ? money(snapshot.price) : '10,000'} GRAD.</p>
          <div className="supply-row"><span>{snapshot ? <><strong>{snapshot.total.toLocaleString('en-US')}</strong> / {snapshot.max.toLocaleString('en-US')} minted</> : 'Loading live supply…'}</span><span>{remaining === undefined ? '— remaining' : `${remaining.toLocaleString('en-US')} remaining`}</span></div>
          <progress aria-label="Minted supply" value={snapshot?.total ?? 0} max={snapshot?.max ?? 1000} />
          <div className="quantity-row"><div><label htmlFor="quantity">Quantity</label><span id="quantity-hint" className="muted small">Up to 10 per transaction</span></div><div className="stepper"><button aria-label="Decrease quantity" disabled={quantity <= 1 || busy} onClick={() => setQuantity(q => q - 1)}>−</button><select id="quantity" aria-describedby="quantity-hint" value={quantity} disabled={busy} onChange={e => setQuantity(Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select><button aria-label="Increase quantity" disabled={quantity >= 10 || busy} onClick={() => setQuantity(q => q + 1)}>+</button></div></div>
          <div className="total-row"><span>Total burn</span><strong>{snapshot ? money(cost) : '—'} <span>GRAD</span></strong></div>
          <p className="gas-note">Plus network gas in Sepolia ETH</p>
          <dl className="wallet-stats"><div><dt>GRAD balance</dt><dd>{money(balance)}</dd></div><div><dt>Mint allowance</dt><dd>{money(allowance)}</dd></div></dl>
          <p className="action-hint" id="action-hint">{hint}</p>
          {account && !rightChain && <button className="primary full" disabled={walletBusy || busy} onClick={() => void switchChain()}>{walletBusy ? 'Switching…' : `Switch to ${d.network.name}`}</button>}
          <div className="action-buttons" aria-describedby="action-hint">
            <button className={approved ? '' : 'primary'} disabled={!canAct || approved} onClick={() => void transact('approve')}><span className="step-number" aria-hidden="true">1</span>{approved ? 'GRAD approved' : 'Approve GRAD'}</button>
            <button className={approved ? 'primary' : ''} disabled={!canAct || !approved} onClick={() => void transact('mint')}><span className="step-number" aria-hidden="true">2</span>Mint {quantity === 1 ? 'gradient' : `${quantity} gradients`}</button>
          </div>
          <div className="transaction-status" role="status" aria-live="polite">{status}</div>
          {txError && <p className="error" role="alert">{txError}</p>}
          {walletError && <p className="error" role="alert">{walletError}</p>}
          {txHash && <a className="transaction-link" href={`${d.network.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction {short(txHash)} ↗</a>}
          <p className="mint-footnote">GRAD comes from swapping Sepolia ETH in the launch pool. Swaps happen outside this page. <a href="#about">How minting works</a></p>
        </section>
      </section>
      <div className="live-strip"><div><span className={readError ? 'live-indicator failed' : 'live-indicator'} />{readError ? 'Live reads unavailable' : snapshot ? `Verified at block ${snapshot.blockNumber.toLocaleString('en-US')}` : 'Verifying deployment…'}<span className="burn-stat"> {snapshot ? `${money(snapshot.burned)} GRAD burned` : 'Supply and balances from contract views'}</span></div><button className="text-button" onClick={() => void refresh()} disabled={reading || busy}>{reading ? 'Refreshing…' : 'Refresh live data'} <span aria-hidden="true">↻</span></button></div>
      {readError && <p className="error read-error" role="alert">{readError}</p>}
      <Gallery service={service} total={snapshot?.total} explorer={d.network.explorer} address={config.nft.address} />
      <section id="about" className="about" aria-labelledby="about-title">
        <div><span className="eyebrow">Simple by design</span><h2 id="about-title">Nothing added.<br />Nothing offchain.</h2><p className="muted">A study in color with a permanent home.</p></div>
        <div className="about-notes"><article><span className="note-number">01</span><div><h3>The number makes the art.</h3><p>Each token ID determines two colors and an angle. Mint order decides the art you receive; the preview is not a reservation. Every SVG and its metadata live in the contract.</p></div></article><article><span className="note-number">02</span><div><h3>Approve. Mint. Keep.</h3><p>Get GRAD by swapping Sepolia ETH in the launch pool outside this page. Approve the displayed total, then mint. Each gradient sends 10,000 GRAD directly to the burn address. Payment is permanent.</p></div></article><article><span className="note-number">03</span><div><h3>A finite spectrum.</h3><p>Only 1,000 tokens can be minted, at most 10 at a time. There is no owner, pause, or upgrade control. This is a Sepolia testnet collection; you also need test ETH for gas.</p><a href={d.network.faucets[0]} target="_blank" rel="noreferrer">Get Sepolia test ETH ↗</a></div></article></div>
      </section>
    </main>
    <footer className="site-footer shell"><div><a className="footer-brand" href="#">gradients</a><p>Made of color. Kept onchain.</p></div><div className="contract-links"><span className="eyebrow">Explore the contracts</span>{d.contracts.map(contract => <a key={contract.name} href={`${d.network.explorer}/address/${contract.address}`} target="_blank" rel="noreferrer">{contract.name === 'LaunchToken' ? 'GRAD token' : 'GradientNFT'} <span>{short(contract.address)} ↗</span></a>)}<a href="./imd-deployment.json">Deployment record ↗</a></div><span className="footer-network">{d.network.name}<br />An onchain color study, № 001</span></footer>
  </>
}
