# Gradients frontend

A single static page for the deployed GradientNFT collection on Sepolia. Approve GRAD, mint 1–10 NFTs, see balance/allowance and remaining supply, and browse minted artwork in pages of 24. The approved workflow explicitly excludes in-page swaps. GRAD comes from swapping Sepolia ETH in the launch pool outside this page.

## Install, build and preview

Requires Node **22.18+** (validated with 22.22.2), npm and Git with the deployed source commit available. Build scripts use Node's TypeScript stripping for the deployment verifier.

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run build --prefix web
npm run validate:export --prefix web
npm run preview --prefix web
```

The preview command reports its local URL. For the same gateway-style subpath used in browser validation:

```sh
node web/scripts/serve.mjs
# Open http://localhost:4173/preview/
```

`npm run dev --prefix web` starts Vite development mode. Its deployment middleware derives configuration from the same inputs and verifies the same ABIs as production. No environment variables or credentials are required.

The publisher hosts **the complete repository-root `dist/`**, including its ABI directory and `imd-deployment.json`. Serve over HTTP(S), not `file://`. Vite uses `base: './'`; navigation uses anchors, and configuration/ABI URLs resolve against the page directory. No backend, rewrite rules, external fonts, indexer, or CDN scripts are needed. Blockchain reads and wallet requests still require runtime network connectivity.

## Deployment and ABI provenance

`deployment/handoff.json` and `deployment/network.json` preserve the supplied public inputs. They are build inputs, not a second runtime address map. `scripts/deployment.ts`:

1. Checks the deployment and network chain IDs agree.
2. Reads each raw ABI array in `public/abi/` and compares its bytes with `git show <sourceCommit>:docs/abi/<Contract>.json`.
3. Recursively sorts object keys, preserves array order, serializes compact JSON, and compares its Keccak-256 hash with the attested `abiHash` (lowercase, no `0x`).
4. Copies the complete contract set, addresses, identifiers and hashes. Copies `network` unchanged and includes the exact supplied `walletAddChain` parameters.

The deployed source is `75fbd25eab2092bec9409a31a5e2d9977f339aa4`. No contract source was changed or deployed. ABI hashes are:

| Contract | Canonical Keccak-256 |
| --- | --- |
| LaunchToken | `f36d2fe28b62f817a4fba0b78bb501b41895eada3982280273c063ad8183f577` |
| GradientNFT | `2b71ce4e835c454c76b31a86f2a03f256056ffe3d5772983d8c8f1ccafb5902d` |

After Vite exports, `scripts/export-manifest.mjs` inventories **every exported file except the manifest itself**, hashes final bytes with SHA-256 and writes `dist/imd-deployment.json`. `--check` verifies all metadata and assets against a regenerated inventory. It rejects symlinks, excess assets, oversized files, changed ABI bytes and stale inventory. Always rebuild after any source or export change; do not edit the generated manifest manually.

`src/config.ts` fetches this same manifest at runtime and loads its referenced ABI JSON, verifying each canonical ABI hash again. Addresses, chain ID, RPCs, explorer and chain-add parameters all originate there. `src/chain.ts` verifies the RPC chain and nonempty deployed code, then reads the GRAD address from `GradientNFT.token()` and checks it against the attested LaunchToken address before using it. The attestation hash is an identifier; this browser does not independently verify an attestation signature. Deployment binding relies on the supplied handoff and subsequent publication integrity checks.

For a future authorized deployment, replace both build-input files together and obtain the corresponding pinned implementation ABIs; do not add hard-coded addresses to components. All Uniswap addresses remain in the unchanged network block. This mint-only UI does not call routers, quoters or Permit2.

## Wallet and payment behavior

- Uses the browser's EIP-1193 `window.ethereum` provider. No WalletConnect project ID was supplied, so QR/mobile remote sessions and multi-wallet chooser support are not included. A wallet's own browser is supported when it injects that provider. Adding WalletConnect is an optional future integration that would require a public project ID; it is not necessary to run this export.
- Shows the connected address, missing-wallet guidance, wrong-chain control, rejections, pending status, confirmations, errors and transaction explorer links. Disconnect clears this page's local connection; it does not revoke wallet permissions or GRAD allowance.
- Tries `wallet_switchEthereumChain`. On 4902/unknown chain, offers `wallet_addEthereumChain` with the exact supplied parameters, then switches again. Transactions stay disabled on the wrong chain.
- Reads through the configured public RPCs in order, with the injected wallet as a last fallback. Balance, allowance, supply, price and total burned are read at one block, refreshed after transactions, when the tab becomes visible, manually, and approximately every 15 seconds. Failed reads clear eligibility; overlapping background refreshes are suppressed.
- Approves **only the selected mint cost**, to GradientNFT. Existing sufficient allowance satisfies the approval step. The allowance is displayed in full decimal GRAD units. Mint is a separate signature and cannot proceed with insufficient allowance or balance. Native ETH is never sent to the mint contract; gas is paid separately.
- Both actions refresh and verify state, validate quantity/supply/balance, simulate the exact contract call, and recheck the signing account and chain before invoking the wallet. Receipt failure is not success. Replacement hashes update the explorer link; cancellation or non-repricing replacement reports a warning. Receipt timeout/replacement behavior is implemented but not exhaustively browser-tested.
- Supply can change after simulation. The deployed contract remains authoritative and can revert a competing mint. No real transactions were broadcast during validation.

Each NFT sends 10,000 GRAD directly to the dead address. Payment is permanent. The application has no owner, upgrade, pause, withdrawal, or payout flow. It does not custody mint payments. As with any Ethereum address, unsolicited/forced assets are outside the intended mint flow; this frontend does not offer recovery.

## Gallery and art

The contract has sequential IDs `1..totalMinted()`, so the gallery uses contract views only. It queries a page of 24 `tokenURI` values in groups of six; no event log scan or indexer is needed. Consequently there is no unbounded log query or dependency on a deployment-block scan. Metadata JSON and SVG data URIs are decoded/rendered in the page. Invalid entries have their own unavailable state and a retry control. SVG is displayed in an `<img>`, never injected into HTML.

Art is a pure function of token ID. **Mint order decides the art received.** The featured #1 image is a clearly labelled algorithm preview generated from the pinned `artOf`/`svgOf` logic, not a claim that an NFT exists or a reservation of an ID. Actual gallery images are loaded from `tokenURI` responses.

## Validation

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/gradients-browsers npm exec --prefix web -- playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/gradients-browsers npm test --prefix web
```

Playwright starts and stops a static server serving the built export at `/preview/`. Tests use the actual bundled page, ABI encoding/decoding, injected wallet requests and mocked RPC responses; fixture values are never included in the app bundle. Evidence is written to `docs/evidence/`. See [validation](../docs/FRONTEND_VALIDATION.md) and [design documentation](../docs/DESIGN.md) for scope, findings, screenshots and limitations.

Live requests to all three public RPCs received HTTP 403 on this worker. Actual chain ID, code and live contract state could therefore not be independently confirmed here. The app refuses transactions until its runtime verification succeeds. Publication checks and real wallet signing remain outside this worker's evidence.

## Scope and packaging

All frontend source, package manifests, lockfiles and build configuration live under `web/`; the complete static export is under `dist/`. Documentation is under `docs/` or `web/`. The root `DESIGN.md` request conflicts with the higher-priority allowed-path rule, so its full content is delivered as `docs/DESIGN.md`.

The explicit `web/.gitignore` allowance has a 512-byte budget (actual 103 bytes). It excludes dependency/cache/test-output directories recursively within `web/`. npm cache and Chromium binaries used for validation live under `/tmp`, never in Git. No root configuration, root lockfile, `lib/`, `.github/`, or submodule was added or modified.
