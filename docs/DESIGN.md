# Gradients design system

## Overview

The page serves collectors minting and browsing the Gradients Sepolia collection. Warm neutral surfaces frame the contract's saturated artwork. A large mixed sans/italic-serif title introduces the collection; the preview and payment panel sit together, followed by a quiet artwork grid and a short explanation. The generous outer spacing belongs to this gallery; the mint panel deliberately uses a denser hierarchy for supply, quantity, cost, balance, allowance and actions.

Source of truth: `web/src/styles.css` (tokens, layered CSS and responsive rules), `web/src/App.tsx` (semantic components and states), and `web/src/art.ts` (algorithm preview and metadata decoder). This document lives here because the assignment's strict path allowance excludes root `DESIGN.md`.

## Colors

Hex primitives are defined once in `:root`; components use their semantic aliases. No dark theme or unused status palette is supplied.

| Semantic token | Value | Use |
| --- | --- | --- |
| `--color-page` | `#f6f5f0` | Warm page background |
| `--color-surface` | `#fffefb` | Mint panel, skip link |
| `--color-soft` | `#eeede6` | Art mat, placeholders, neutral hover |
| `--color-ink` | `#252820` | Primary text and solid structural marks |
| `--color-muted` | `#5d6255` | Supporting prose, metadata and labels |
| `--color-line` | `#d7d8cd` | Quiet structural separators |
| `--color-control-line` | `#74786a` | Interactive borders |
| `--color-accent` | `#dceca2` | Current approval/mint action fill |
| `--color-accent-hover` | `#cbdf88` | Enabled primary hover |
| `--color-success` | `#3d5d28` | Live network indicator |
| `--color-error` | `#9a332d` | Error text and failed-read indicator |
| `--color-focus` | `#252820` | Focus perimeter; system Highlight in forced colors |

Artwork colors come from token metadata and do not define UI states. No text is overlaid on gallery gradients. Status always includes words, not color alone. Browser-computed opaque text pairs measured 13.71:1 (ink/page), 5.75:1 (muted/page), 6.23:1 (muted/surface), and 11.81:1 (ink/enabled accent); details and coverage limits are in `evidence/render-checks.json`. Disabled controls intentionally use reduced opacity and are excluded from enabled-text contrast claims.

## Typography

The system stack is `Arial, Helvetica, sans-serif`. The headline emphasis uses `Georgia, 'Times New Roman', serif` in italic, weight 400. Metadata swatches use `ui-monospace, monospace`. No font downloads or font binaries are required; platform fallback glyphs can differ. CSS requests weights 400–600 and does not disable native synthesis.

- `--text-display`: `clamp(3.3rem, 6.5vw, 5.7rem)`; main title line-height 1.04, letter-spacing −.065em; italic −.06em.
- `--text-heading`: `clamp(1.65rem, 3vw, 2.25rem)`; section headings line-height 1.15, letter-spacing −.035em. The mint title is 1.6rem (1.5rem on small screens); the explanatory section uses a 2–2.75rem scale.
- Body: 1rem, line-height 1.55. Intro lead: 1.375rem, reduced to 1.125rem on compact layouts. Supporting interface text: .875rem (14px); small text: .8125rem (13px); compact captions/eyebrows: .75rem or 12px.
- Quantity select: 16px on every viewport. Changing values use tabular numbers. Headings use `text-wrap: balance`; prose uses `pretty`. Account and transaction identifiers have visible short forms and full explorer destinations; balance/allowance values wrap without losing precision.

## Layout

`.shell` centers content within 1280px, including 48px inline padding. Use this shared alignment for new sections. Gaps normally progress through 6/8/12/16/20/24/28/32px; sections use 40–72px. Logical margin/padding properties preserve reading direction.

The desktop preview/mint grid is `1.16fr 1fr` with a 24px gap. Gallery columns are equal `minmax(0, 1fr)` tracks. Mint controls remain in document flow; there are no sticky panels or modal layers.

| Breakpoint | Behavior |
| --- | --- |
| Up to 1050px | Shell padding 32px, equal mint columns, compact panel padding; header's secondary network label hides |
| Up to 790px | Shell padding 24px; preview and mint stack; redundant header navigation hides; gallery becomes 3 columns |
| Up to 520px | Shell padding 20px; intro/explanation/footer stack; gallery becomes 2 columns; compact control spacing |

The network name stays in the mint panel's edition badge on all widths. Images retain square aspect ratios. The gallery loads exactly 24 IDs per page except the last page. Checked rendered widths: 320, 390, 600, 790, 1024 and 1440px, plus text resizing to 200% at 720px. No horizontal overflow was observed. RTL mirroring received an overflow check, not a translation audit.

## Elevation & Depth

The interface is mostly flat. Tone separates the preview mat from the page and mint surface; single-pixel dividers organize dense payment information. Only the featured image has a two-layer shadow (`0 8px 28px #25282016`, `0 2px 6px #2528200a`). Images have a 1px 10% black outline. There is no blur or floating modal treatment. The skip link uses the only explicit positive z-index, 5.

## Shapes

Mint panel and preview mat use 12px radii. Buttons and the stepper use 7px, empty states 8px, gallery images 2px. A small four-square CSS mark identifies the collection. Step numbers and live indicators are circular; neither carries meaning without adjacent text. Native select affordances are retained.

## Components

These are actual page patterns, not a separate component library:

- `App` in `web/src/App.tsx`: wallet header, intro, mint panel, live-read strip, explanatory content and contract footer. Native buttons carry actions; links navigate. One main landmark, one h1, nested h2/h3 headings and the skip link establish reading order.
- `Gallery` in the same file accepts a contract service, live total, explorer and NFT address. It manages page/retry/loading state, missing-art slots, empty/unavailable states, decoded image cards and pagination. Cards link to individual token explorer pages. Loading placeholders do not pretend to be minted art.
- `.primary`, base `button`, `.text-button`: the current approval or mint step receives the accent fill. Disabled controls have adjacent explanatory text. Hover alters the background; focus uses a 2px outline with 4px offset. Active press scales to .96 with a 120ms transition only when reduced motion is not requested. Reduced motion has no transition. No entrance animation is used.
- `.stepper`: native quantity select with 1–10 options plus labelled increment/decrement buttons. Its visible label and `aria-describedby` hint are separate. Inputs and ordinary buttons are at least 44px high; mobile side buttons are 40px wide and 44px high.
- `.wallet-stats` and `.total-row`: full-precision numeric values with token-specific labels. Refresh failure or wallet changes invalidate eligibility and clear stale balances.
- `.transaction-status`, `.error`, `.gallery-status`: persistent nearby text, polite transaction updates, alert errors, and explicit retry controls. Each transaction links to the configured explorer.

## Do's and Don'ts

Start additional content in `.shell`, use the existing semantic tokens and match the existing h2/h3 hierarchy. Keep interpretation text separate from the numeric payment summary. Reuse native controls and show the reason for disabled actions. Keep deployment configuration in the manifest loader; do not put addresses in visual components.

Keep art inside image elements and label any simulated preview. Do not overlay readable text on unverified gradient colors, invent live counts, imply that an ID can be reserved, or add competing accent actions. Preserve the relative asset paths and anchor navigation if extending this static page.

## Design-reference attribution

Design review applies the assignment's pinned Better Interface guidance, adapted from Jakub Krehel's Better Interface, MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation follows the pinned method adapted from Paul Bakaus's Impeccable, Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. The original guides were supplied as task inputs; they are not copied or relicensed in this implementation.

Sources: [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), [Impeccable documentation method](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md).
