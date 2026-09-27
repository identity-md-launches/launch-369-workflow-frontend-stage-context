# Frontend validation

## Outcome and scope

The implemented mint/gallery page, production static export, pinned ABI verification and worker-side checks are complete within `web/`, `dist/` and `docs/`. This is the worker's evidence, not an independent certification. No contract was modified or redeployed, no live transaction was broadcast, and no site was published.

The approved workflow says **no in-page swap**. Primary application actions are GRAD approval and GradientNFT mint; inherited ERC-20/ERC-721 transfer and operator-management functions are outside this mint/gallery assignment. The root `DESIGN.md` criterion conflicts with the overriding write scope. The full design document is therefore delivered at [DESIGN.md](DESIGN.md), with no root-file change.

**Commit limitation:** `git add -- web dist docs && git commit -m "Build Gradients mint frontend and verified static export"` failed before staging, exit 128: `.git/index.lock: Read-only file system`. The working-tree deliverables are complete, but this worker could not create the requested repository commit. No attempt was made to change protected Git permissions. A separate temporary repository is used only to measure a complete candidate submission bundle, not to claim the original repository was committed. Delivery cannot be described as fully committed until the publisher or a writable checkout commits these files.

## Commands and evidence

Validated using Node 22.22.2, npm 10.9.7, TypeScript 5.9.3, Vite 7.1.12, React 19.2.0, viem 2.38.5, Playwright 1.56.1 and Chromium 141.0.7390.37. Dependency versions and integrity records are pinned in `web/package-lock.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build --prefix web` | Exit 0; includes `tsc --noEmit`, production export and manifest emission | [build.txt](evidence/build.txt) |
| `npm run typecheck --prefix web` | Passed as the explicit build prerequisite on every production build | [build.txt](evidence/build.txt) |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/gradients-browsers npm test --prefix web` | Exit 0; 11/11 tests passed on final export | [test.txt](evidence/test.txt), [structured results](evidence/interactions.json) |
| `npm run validate:export --prefix web` | Exit 0; pinned ABIs, exact handoff/network, six asset hashes verified | [export.txt](evidence/export.txt) |
| Desktop/mobile axe scan | No automated WCAG A/AA violations; 28 rules passed at each width | [accessibility.json](evidence/accessibility.json) |
| Render/contrast/reflow checks | Passed at 320, 390, 600, 790, 1024 and 1440px | [render-checks.json](evidence/render-checks.json) |
| Public RPC chain and code probes | Unconfirmed: every endpoint returned HTTP 403 | [live-rpc.json](evidence/live-rpc.json) |

The supplied MCP browser could not initialize: `EROFS: read-only file system` while opening its cache under `/home/imd/.cache/ms-playwright/`. Its failed call did not produce a screenshot. Local Playwright was installed under `/tmp` and successfully exercised the built export instead. Playwright's foreground test runner manages and shuts down the static preview server. Tests serve `dist/` under `/preview/` to validate relative paths and plain static hosting.

Screenshots are real Chromium captures of the production bundle with mocked onchain data. They show fixture supply of 28 after a mocked two-token mint, not a live-chain count:

- [Desktop full page, 1440px](evidence/desktop.png) and [desktop viewport](evidence/desktop-viewport.png)
- [Mobile full page, 390px](evidence/mobile.png) and [mobile viewport](evidence/mobile-viewport.png)

The worker visually inspected both full-page and viewport captures. The art grid, mint panel and explanatory content remain in their intended reading order; headings wrap cleanly and no horizontal page overflow was found at checked widths.

## Interaction coverage

`web/tests/app.spec.ts` operates the final production JavaScript. `web/tests/fixtures.ts` intercepts only configured RPC endpoints, decodes real ABI calls, returns ABI-encoded contract results and injects a mock EIP-1193 wallet. It records transaction destinations, arguments and native value. Test fixtures and mock injection are absent from `dist/`.

1. Static subpath loading; no-wallet guidance; disabled actions; 24 decoded `tokenURI` images; rendered SVG image; next/previous page boundaries; no console errors or HTTP resource failures in the fixture run.
2. Connection, decimal balance, quantity 10, total 100,000 GRAD, separate exact-cost approval to the deployed NFT address, ten-token mint to the deployed NFT contract, zero native transaction value, receipt link, refreshed supply/balance/allowance, and disconnect.
3. Wrong chain blocks actions. A simulated 4902 triggers exactly switch → add → switch; the added parameters equal the pinned `walletAddChain` object.
4. Connection and approval rejection can be retried. A mint simulation revert does not call `eth_sendTransaction`.
5. Insufficient balance, 1–10 option bounds, disabled decrement/increment at limits, rejection of quantity 10 with only five remaining, smaller quantity recovery, and sold-out state.
6. Missing code, wrong `token()` binding and RPC failure prevent transactions. Failed refresh clears old balances; recovery restores eligibility.
7. A reverted receipt is reported as an error, never mint success.
8. Chain/account events invalidate action eligibility and wallet data.
9. Empty gallery, one malformed token metadata record, partial artwork failure and successful retry.
10. A tampered implementation ABI fails its canonical hash check before transaction UI is available.
11. Skip link, keyboard activation of wallet/quantity/approval/mint, desktop/mobile axe audit, screenshots, six viewport widths, 200% root text resizing at 720px, RTL overflow check, reduced motion and measured foreground/background pairs.

## Deployment integrity

The handoff's launch ID, chain ID, source commit, attestation hash and exact two-contract set are copied to `dist/imd-deployment.json`. Contract addresses and ABI hashes are not invented or independently duplicated in source components. The network object is structurally unchanged from the supplied JSON, including all public RPCs, explorer, native currency, faucets and Uniswap v4 addresses. Exact chain-add parameters are included as an additional manifest field.

ABI files are raw JSON arrays copied from `docs/abi/` at deployed commit `75fbd25eab2092bec9409a31a5e2d9977f339aa4`. The build verifies their bytes against `git show` and their recursive-key-sorted canonical Keccak hashes against the handoff. Both passed. The app fetches the same exported manifest and referenced ABI JSON and checks those ABI hashes again. Before any transaction it also checks RPC chain, nonempty code, `token()` binding, wallet chain/account, live state and simulation.

The manifest lists all six other exported files, including `index.html`, both ABI arrays, two JS chunks and the CSS file. Each path is relative to `dist/`, with lowercase SHA-256 hashes and no URLs or parent traversal. The manifest excludes itself. The final production export is about 0.52 MB, far below 128 assets, 8 MiB per file and the HTTP response budget. No source maps, dependency archives or registry mirrors are exported.

## Better Interface consolidated review

The pinned workflow and core principles from all six domains were read and applied during construction. Ordinary choices were inferred from the collection: light gallery palette, system fonts, no modal, no theme switch and no animation-heavy entrance. The approved mint workflow and transaction prerequisites took precedence over generic advice to keep submission buttons enabled.

| Domain | Coverage and evidence | Remaining limits |
| --- | --- | --- |
| Accessibility | Native controls, visible quantity label plus described hint, named controls, skip link, landmarks, image alt text, persistent status/error messages, keyboard flow, axe audit, 2px focus styling, reduced motion | No screen-reader session, native mobile device or full forced-colors visual audit |
| Layout | Source grid/spacing review; actual desktop/mobile screenshots; width measurements 320–1440; 200% text resizing; basic RTL reflow check | Full browser UI zoom and pseudo-localization were not tested; RTL overflow alone is not linguistic localization |
| Writing | Approval/mint labels match actions; total burn and gas units separated; errors give retry/switch/funding steps; preview explicitly labelled; order-dependent art explained | Wallet extension's own copy is outside the app |
| Typography | System font stacks, bounded scale, 12px caption floor, 16px select, tabular numbers, full-precision amounts, visible heading hierarchy and wrapping | Other OS font renderings and non-English content not tested |
| Colors | Semantic token review; eight actual computed text/background pairs, all ≥4.5:1 for enabled opaque text; no labels over gradient images; status also uses words | Not every hover/focus/disabled composite pair measured; no dark theme (not applicable) |
| UI | Actual initial/loading/empty/error/disabled/success/retry states; component radii and image outlines; responsive payment layout; reduced-motion check | Replacement/cancellation and receipt timeout are source-reviewed, not exhaustively simulated; no animation-panel slow playback |

Axe left two manual contrast flags for non-text decorative arrows (`.inline-link > span[aria-hidden="true"]` and `.text-button > span[aria-hidden="true"]`), not violations. They are redundant with visible link/button labels and inherit their text color; they do not carry meaning alone. Raw audit flags are retained rather than presented as an unconditional accessibility certification.

### Findings fixed before final export

| Severity / domain | Final source reference | Observation and impact | Correction and check |
| --- | --- | --- | --- |
| Medium / accessibility | `web/src/App.tsx:190` | Quantity's hint was nested inside the label, making its computed name “Quantity Up to 10 per transaction.” Exact-label and keyboard-flow tests could not address “Quantity.” | Separated visible label and `aria-describedby` hint. Final browser tests pass. |
| Medium / observability, UI | `web/src/App.tsx:80` and `:98` | Source review found 15-second polling could supersede a slower fallback read repeatedly, delaying error/recovery state. | Track reads in flight and suppress overlapping background refreshes; failed-read/retry tests pass. Slow real RPC timing remains untested. |
| Low / typography | `web/src/styles.css:38`, `:77`, `:80` and compact responsive rules | First rendered review used 9–11px compact metadata. It was unnecessarily small, especially on mobile. | Raised captions to 12px, rebuilt, rechecked screenshots and 320px overflow. |
| Medium / writing, layout | `web/src/App.tsx:186` | Header's secondary network label hides on compact layouts; the mint panel needed persistent chain context. | Added the runtime network name to the edition badge at every width. Verified final mobile rendering. |
| Medium / observability | `web/src/chain.ts:69` | Source review found successful cancellation/replacement receipts could otherwise be described as the requested action's success. | Track replacement reason, preserve replacement explorer hash, and report non-repricing replacement separately. Receipt reversion tested; actual replacement path remains untested. |
| Low / writing, observability | `web/src/App.tsx:107` and `:158` | Account-change handling could clear the link to an in-flight transaction or imply it belonged to a newly selected account. | Preserve transaction status across provider account events and include the initiating address in confirmation text. |

No unresolved applicable visual defect was observed in the final checked states. Unperformed checks above remain limitations, not passes.

## Live-chain and publication limitations

All three supplied public RPC endpoints returned HTTP 403 to worker probes for `eth_chainId` and each contract's `eth_getCode`. The live chain, code and balances therefore remain **unverified on this worker**. The pinned ABI/source binding is verified independently of those failed network requests. Runtime checks keep approval/mint disabled until the visitor's RPC/provider can supply valid data.

Real browser-extension signing, actual funded minting, gas estimation by a real wallet, receipt replacement, reorgs, long receipt timeouts, live public-RPC fallback latency, native-device rendering, Safari/Firefox, screen readers and publisher CID/named-entrypoint checks were not performed. No site URL, CID, pool execution, transaction hash or live balance is represented as a completed network result. The mocked transaction links in tests are fixtures only.

IPFS pinning, naming, publication integrity/RPC checks and hosting are downstream publisher responsibilities. Worker submission does not depend on their URLs or success.

## Packaging and final delivery state

Only allowed paths changed; no contract source, root configuration, root lockfile, `lib/`, `.github/` or submodule was modified. Recursive `web/.gitignore` exclusions keep dependencies, caches and test reports out of Git. Its explicit budget is 512 bytes; actual size is 103 bytes. The export contains seven files including the manifest, totaling **515,881 bytes**. Source, export and evidence together are about 2.92 MB before Git compression.

A temporary candidate commit in `test/scratch/` was packaged as a delta bundle requiring the pinned deployed source commit. `git bundle verify` passed, and a separate clone of the supplied base successfully imported the bundle and read its complete submitted tree (388 files). The candidate bundle is about **2.35 MB**, below a checked 3,000,000-byte packaging bound and the assignment's **8,388,608-byte** limit. All frontend source, export and evidence are included. A standalone history bundle was not usable because the supplied Git database lacks an older-history blob; the verified delta bundle explicitly declares the existing deployed source commit as its prerequisite. See [delivery.json](evidence/delivery.json).

The original repository's `.git` is still read-only and its HEAD is unchanged. Files are delivered in the working tree, but **the requested repository commit remains incomplete** because staging itself was denied. This is an environmental limitation, not a claim that a commit or publication succeeded. The temporary bundle is scratch verification material and is not shipped as a redundant archive.
