import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { mockChain, nft, token, price, account } from './fixtures'

test('subpath export, no wallet, live gallery decoding and 24-item pagination', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const failed: string[] = []
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()) })
  await mockChain(page, {}, false)
  await page.goto('./')
  await expect(page.getByText('Verified at block', { exact: false })).toBeVisible()
  await expect(page.locator('.art-card')).toHaveCount(24)
  await expect(page.locator('.art-card img').first()).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  expect(await page.locator('.art-card img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 512)).toBe(true)
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('alert')).toContainText('No browser wallet found')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('.art-card')).toHaveCount(2)
  await expect(page.locator('.art-card').first()).toContainText('Gradient #25')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.locator('.art-card')).toHaveCount(24)
  expect(errors).toEqual([]); expect(failed).toEqual([])
})

test('connect, exact-cost approval, mint 10, receipt and refreshed balances', async ({ page }) => {
  const state = await mockChain(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.locator('.wallet-stats')).toContainText('200,000')
  await page.getByLabel('Quantity', { exact: true }).selectOption('10')
  await expect(page.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
  await expect(page.locator('.total-row')).toContainText('100,000')
  await expect(page.getByRole('button', { name: 'Mint 10 gradients' })).toBeDisabled()
  await page.getByRole('button', { name: 'Approve GRAD' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Approval confirmed' })).toBeVisible()
  expect(state.sends).toHaveLength(1)
  expect(state.sends[0].to.toLowerCase()).toBe(token.address.toLowerCase())
  expect(state.sends[0].args).toEqual([expect.stringMatching(new RegExp(nft.address, 'i')), price * 10n])
  await expect(page.getByRole('button', { name: 'Mint 10 gradients' })).toBeEnabled()
  await page.getByRole('button', { name: 'Mint 10 gradients' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Mint confirmed' })).toBeVisible()
  expect(state.sends[1].to.toLowerCase()).toBe(nft.address.toLowerCase())
  expect(state.sends[1].args).toEqual([10n])
  expect(state.sends.every(send => !send.value || send.value === '0x0')).toBe(true)
  await expect(page.locator('.wallet-stats')).toContainText('100,000')
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  await expect(page.locator('.supply-row')).toContainText('36')
  await expect(page.getByRole('link', { name: /View transaction/ })).toHaveAttribute('href', /\/tx\/0x/)
  await page.getByRole('button', { name: /Disconnect/ }).click()
  await expect(page.locator('.wallet-stats')).not.toContainText('100,000')
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
})

test('unknown wallet chain offers exact add-chain parameters, then switches again', async ({ page }) => {
  const state = await mockChain(page, { chain: '0x1', missingChain: true })
  await page.goto('./')
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  await page.getByRole('button', { name: 'Switch to Sepolia' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  const calls = state.calls.filter(c => c.method.startsWith('wallet_'))
  expect(calls.map(c => c.method)).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain'])
  const pinned = JSON.parse(readFileSync(new URL('../deployment/network.json', import.meta.url), 'utf8'))
  expect(calls[1].params).toEqual([pinned.walletAddChain])
})

test('wallet rejection is recoverable; simulation revert prevents signing', async ({ page }) => {
  const state = await mockChain(page, { reject: true })
  await page.goto('./')
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('alert')).toContainText('Request declined')
  state.reject = false
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  state.reject = true
  await page.getByRole('button', { name: 'Approve GRAD' }).click()
  await expect(page.getByRole('alert')).toContainText('Request declined')
  expect(state.sends).toHaveLength(0)
  state.reject = false; state.allowance = price; state.revert = true
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByRole('button', { name: 'Mint gradient', exact: false })).toBeEnabled()
  await page.getByRole('button', { name: 'Mint gradient', exact: false }).click()
  await expect(page.getByRole('alert')).toContainText('reverted')
  expect(state.sends).toHaveLength(0)
})

test('insufficient balance, quantity boundaries, cap and sold-out state', async ({ page }) => {
  const state = await mockChain(page, { connected: true, balance: price - 1n, total: 995 })
  await page.goto('./')
  await expect(page.getByText('You need more GRAD', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled()
  await expect(page.getByLabel('Quantity', { exact: true }).locator('option')).toHaveCount(10)
  state.balance = price * 10n
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await page.getByLabel('Quantity', { exact: true }).selectOption('10')
  await expect(page.getByText('Only 5 remain.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  await page.getByLabel('Quantity', { exact: true }).selectOption('5')
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  state.total = 1000
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByText('All 1,000 gradients have been minted.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  expect(state.sends).toHaveLength(0)
})

test('verification fails closed for missing code, wrong binding and RPC failure; retry recovers', async ({ page }) => {
  const state = await mockChain(page, { connected: true, noCode: true })
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('code is missing')
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  state.noCode = false; state.tokenMismatch = true
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByRole('alert')).toContainText('binding does not match')
  state.tokenMismatch = false
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  state.failRpc = true
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByText('Live reads unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  await expect(page.locator('.wallet-stats')).not.toContainText('200,000')
  state.failRpc = false
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
})

test('receipt revert is not reported as success', async ({ page }) => {
  await mockChain(page, { connected: true, allowance: price, receiptReverts: true })
  await page.goto('./')
  await page.getByRole('button', { name: 'Mint gradient', exact: false }).click()
  await expect(page.getByRole('alert')).toContainText('Transaction reverted')
  await expect(page.getByText('Mint confirmed.', { exact: false })).toHaveCount(0)
})

test('chain and account events invalidate balances and pending eligibility', async ({ page }) => {
  const state = await mockChain(page, { connected: true })
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  state.chain = '0x1'
  await page.evaluate(() => (window as any).__emit('chainChanged', '0x1'))
  await expect(page.getByRole('button', { name: 'Switch to Sepolia' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeDisabled()
  await page.getByRole('button', { name: 'Switch to Sepolia' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  state.connected = false
  await page.evaluate(() => (window as any).__emit('accountsChanged', []))
  await expect(page.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
  await expect(page.locator('.wallet-stats')).not.toContainText('200,000')
})

test('empty gallery, malformed metadata and retry', async ({ page }) => {
  const state = await mockChain(page, { total: 0 })
  await page.goto('./')
  await expect(page.getByText('A collection waiting to begin.')).toBeVisible()
  state.total = 2; state.malformedArt = true
  await page.getByRole('button', { name: 'Refresh live data' }).click()
  await expect(page.getByText('Artwork unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('.art-card img')).toHaveCount(1)
  state.malformedArt = false
  await page.getByRole('button', { name: 'Retry artwork' }).click()
  await expect(page.locator('.art-card img')).toHaveCount(2)
})

test('tampered implementation ABI prevents the app from enabling transactions', async ({ page }) => {
  await page.route('**/abi/GradientNFT.json', route => route.fulfill({ json: [] }))
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('ABI verification failed')
  await expect(page.getByRole('button', { name: 'Reload configuration' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toHaveCount(0)
})

test('desktop/mobile render, keyboard flow, contrast, overflow and reduced motion', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await mockChain(page)
  await page.goto('./')
  await expect(page.locator('.art-card')).toHaveCount(24)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Connect wallet' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  const accessibility = []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    accessibility.push({ width, violations: audit.violations, incomplete: audit.incomplete.map(rule => ({ id: rule.id, description: rule.description, nodes: rule.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), passes: audit.passes.length })
    expect(audit.violations).toEqual([])
  }
  writeFileSync('../docs/evidence/accessibility.json', JSON.stringify(accessibility, null, 2))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByLabel('Quantity', { exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2')
  await page.getByRole('button', { name: 'Approve GRAD' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Mint 2 gradients' })).toBeEnabled()
  await page.getByRole('button', { name: 'Mint 2 gradients' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Mint confirmed.', { exact: false })).toBeVisible()
  await expect(page.locator('.art-card')).toHaveCount(24)
  await page.getByRole('button', { name: /Disconnect/ }).click()
  await expect(page.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
  await page.locator('body').click({ position: { x: 0, y: 0 } })
  const widths = [1440, 1024, 790, 600, 390, 320]
  const metrics = []
  for (const width of widths) {
    await page.setViewportSize({ width, height: 960 })
    const measurement = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      h1: getComputedStyle(document.querySelector('h1')!).fontSize,
      quantitySize: getComputedStyle(document.querySelector('select')!).fontSize }))
    expect(measurement.scrollWidth).toBeLessThanOrEqual(width)
    metrics.push(measurement)
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: `../docs/evidence/${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true })
      await page.screenshot({ path: `../docs/evidence/${width === 1440 ? 'desktop' : 'mobile'}-viewport.png` })
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.getByRole('button', { name: 'Connect wallet' }).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
  await page.setViewportSize({ width: 720, height: 500 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720)
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; document.documentElement.dir = 'rtl' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720)
  await page.evaluate(() => { document.documentElement.dir = 'ltr' })
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Approve GRAD' })).toBeEnabled()
  const contrast = await page.evaluate(() => {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
    }
    return ['body', '.intro-copy .muted', '.mint-panel .muted', '.mint-panel .primary', '.action-hint', '.live-strip', '.art-caption', '.mint-footnote'].map(selector => {
      const el = document.querySelector(selector)!
      let node: Element | null = el, background = 'rgba(0, 0, 0, 0)'
      while (node && background === 'rgba(0, 0, 0, 0)') { background = getComputedStyle(node).backgroundColor; node = node.parentElement }
      const foreground = getComputedStyle(el).color
      const l1 = luminance(foreground), l2 = luminance(background)
      return { selector, foreground, background, ratio: (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) }
    })
  })
  for (const pair of contrast) expect(pair.ratio).toBeGreaterThanOrEqual(4.5)
  writeFileSync('../docs/evidence/render-checks.json', JSON.stringify({ widths: metrics, contrast, textZoom: '200% at 720px', rtl: '720px overflow check', reducedMotion: '0s button transition', errors }, null, 2))
  expect(errors).toEqual([])
})
