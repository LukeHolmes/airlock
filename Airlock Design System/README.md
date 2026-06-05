# Airlock — Design System

**The Local-First Disposable Workspace for High-Risk Digital Assets.**

Airlock is a lightweight, cross-platform desktop application that lets prosumers
instantly **detonate suspicious files** and **browse untrusted URLs** inside
temporary, hardware-isolated local containers — with zero configuration. It
bridges enterprise-grade Remote Browser Isolation (RBI) and consumer ease of
use, orchestrating ephemeral Docker containers directly on the user's machine so
nothing private ever touches a third-party server.

> Drag a file in → it opens inside a sealed, air-gapped container rendered to a
> low-latency canvas → close the window and the container is **atomically
> destroyed**, flushing memory and cache so a malicious payload never reaches the
> host OS.

**Audience:** prosumers — freelancers, crypto investors, syndicate directors,
independent consultants. Security-literate but not enterprise IT. They want
protection that feels as fast as a native double-click.

---

## Sources & provenance

This design system was created **from the product vision document only**. No
codebase, Figma file, fonts, logos, or slide decks were supplied.

- **Source material:** the Airlock project vision / PRD (objective, core problem,
  solution architecture, repository milestones, architectural philosophy).
- **Everything visual here is original**, inferred from the product's tone and
  purpose. All fonts, the logomark, the color system, and the UI kits are
  net-new and should be treated as a *proposed* identity, ready to iterate.
- **Fonts are Google Fonts substitutions** (see Visual Foundations → Type). Swap
  in licensed brand fonts when chosen.
- **Architecture referenced (for UI realism):** Electron UI shell, Docker
  Daemon + `dockerode`, isolated container running KasmVNC + a native viewer
  (chromium / evince), streamed over WebRTC/WebSocket to a `<canvas>`.

---

## The design concept

Airlock is a **precision containment instrument** — equal parts secure terminal
and laboratory clean-room console. The interface should make a nervous user feel
*calm and in control*, never alarmed. Three ideas drive every decision:

1. **Sealed by default.** The resting state is cool, quiet, and confident. Ice
   cyan is the color of *safety and containment*, not danger.
2. **Danger is hot and rare.** Hazard orange and threat red appear *only* around
   untrusted assets and destructive actions. Color is a signal, not decoration.
3. **Mechanical honesty.** Monospace readouts, hairline borders, sharp radii,
   and fast mechanical motion communicate that this is a real machine doing real
   isolation work — no soft, fuzzy "consumer app" gloss.

---

## CONTENT FUNDAMENTALS

How Airlock writes. Copy is **terse, technical, and reassuring** — the voice of a
competent operator, not a marketer and not a scary antivirus alert.

**Voice & tone**
- **Confident, calm, precise.** Short declaratives. State what happened, plainly.
  "Container sealed." "Payload contained." "Workspace destroyed."
- **Operator, not salesperson.** We describe mechanism, not hype. We say *what it
  does* ("launches in an air-gapped container") over *how it feels* ("amazingly
  secure!").
- **Never fear-mongering.** Even threats are reported flatly. We don't shout
  "DANGER!!!"; we report "2 outbound connection attempts blocked." Competence
  calms; alarm sells fear.

**Person & address**
- Address the user as **"you"**; the product refers to itself as **"Airlock"** or
  implicitly (imperative verbs). Avoid "we" in-product (reserve "we" for
  marketing/company voice).
- Prefer **imperative** for actions: "Drop a file to detonate." "Grant network
  access." "Destroy workspace."

**Casing**
- **Sentence case** for everything UI: buttons, menus, headings, tooltips.
  ("Open in airlock", not "Open In Airlock".)
- **UPPERCASE mono** reserved for eyebrows, status chips, and system labels:
  `SEALED`, `UNTRUSTED`, `AIR-GAPPED`, `WORKSPACE 04`.
- The brand name is **Airlock** (capital A) in prose; **AIRLOCK** only in the
  wordmark.

**Vocabulary — the lexicon**
A small, consistent set of metaphor-true verbs and nouns:
- **Detonate** — open a suspicious file inside a container.
- **Seal / Sealed** — the safe, contained state.
- **Air-gapped** — network adapter disabled (default).
- **Workspace / Container / Instance** — the ephemeral chamber.
- **Destroy / Atomic destruction** — kill the container, flush memory.
- **Untrusted** — the asset's classification before containment.
- **Host** — the user's real machine, which must stay clean.
- Avoid: "sandbox" (overused), "VM" (too heavy/scary), "delete" (use "destroy").

**Numbers & data**
- Always **tabular mono** for sizes, hashes, durations, counts: `1.4 MB`,
  `sha256:9f2a…`, `312 ms`, `0 host writes`.
- Brag in milliseconds. Speed is a feature: "Sealed in 312 ms."

**Emoji:** none. Ever. Airlock is an instrument. Status is communicated with
color, mono labels, and a tiny set of geometric icons — never emoji.

**Examples**
- Empty state: `Drop a file or paste a URL to open it in a sealed workspace.`
- Success toast: `Workspace 04 destroyed · memory flushed · 0 host writes`
- Permission prompt: `chrome.exe wants network access. Airlock is air-gapped by
  default. Grant for this session only?`
- Marketing hero: `Detonate anything. Touch nothing.`
- CTA: `Download for macOS` · `Seal a file now`

---

## VISUAL FOUNDATIONS

**Overall vibe:** industrial / utilitarian clean-room rendered in obsidian. Dark
UI, hairline structure, monospace data, generous breathing room around a few
glowing signal elements. Think flight-console minimalism — Teenage Engineering
restraint meets a security terminal — not "neon cyberpunk."

### Color
- **Obsidian base.** The app lives on near-black (`#08090B`) with a tight ladder
  of graphite surfaces (`#0C0E11 → #20242C`) for elevation. Elevation is shown by
  *lighter surface + 1px hairline*, not big shadows.
- **One calm signal: Ice Cyan (`#3DE8D4`).** This is *primary* and means
  **sealed / safe / active**. Used for primary buttons, the live container frame,
  focus rings, key data.
- **One hot signal: Hazard Orange (`#FF6A2B`).** Means **untrusted / detonate /
  caution**. Appears on the untrusted asset, the detonate affordance, the network
  prompt. Used sparingly — its rarity is what makes it legible.
- **Threat Red (`#F23D3D`).** Active threat + destructive confirm only.
- **Steel (`#7E8B9A`)** is the cool informational neutral for meta/secondary
  accents.
- **Imagery color vibe:** cool, low-key, slightly desaturated; faint cyan cast in
  the dark. No warm photography. Where "imagery" appears it's diagrammatic
  (architecture lines, grid fields), not stock photos.

### Type
- **Display / UI: Space Grotesk** — a technical neo-grotesque, tight tracking,
  used 500–600 weight. *(Google Fonts substitution — no brand font supplied.)*
- **Mono: JetBrains Mono** — every path, hash, ID, status chip, numeric readout,
  and terminal line. The mono is a load-bearing brand element, not a niche style.
  *(Google Fonts substitution.)*
- Headings track tight (−0.02 to −0.03em); mono tracks 0 to +0.04em. Eyebrows are
  uppercase mono at 0.18em.

### Spacing & layout
- **4px base grid.** Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.
- Dense but breathable: tool surfaces use 12–16px padding; marketing uses 64–96px
  rhythm.
- **Fixed chrome:** the desktop app uses a fixed top command bar (drag region +
  URL/drop input) and an optional left workspace rail. Marketing uses a fixed,
  blurred top nav.

### Backgrounds & texture
- **Signature clean-room grid:** a barely-there square grid
  (`rgba(255,255,255,0.022)`, ~32px cells) over obsidian — present on app canvas
  and marketing hero. Conveys "calibrated space."
- **Scanline / sweep:** a one-time cyan sweep animates across a container when it
  seals (the "scan"). Decorative loops are avoided.
- **Hazard stripe** (45° orange/obsidian) used *only* as a thin accent edge on
  untrusted assets — never as a large fill.
- No mesh gradients, no glassy blur-everywhere. Blur is used only for the fixed
  nav backdrop and modal scrims.

### Borders, radii, elevation
- **Hairline borders everywhere** (`#23272F`, 1px) — structure comes from lines,
  not shadows.
- **Sharp instrument radii:** 2 / 4 / 6 / 10px. Buttons and inputs sit at 6px;
  chips at 4px; large panels at 10px. Pills (999px) only for status dots/toggles.
- **Cards:** graphite surface (`--surface-1`), 1px hairline, radius 10px, a faint
  inset top highlight (`rgba(255,255,255,0.03–0.05)`), and only a soft drop shadow
  on floating elements (popovers/modals). Resting cards are nearly flat.
- **Glow** is reserved: a tight cyan glow ring marks the *live, sealed* container;
  a hazard glow marks an *armed detonate* button. Glow = "this is energized."

### Motion
- **Fast and mechanical.** Durations 120–260ms. Easing `cubic-bezier(0.16,1,0.3,1)`
  (snappy ease-out) for entrances; `cubic-bezier(0.65,0,0.35,1)` for moves.
- **Hover:** surfaces lighten one step (`--surface-1 → --surface-2`) and/or border
  brightens to `--line-strong`; signal buttons brighten fill + lift glow. No size
  change on hover for large elements.
- **Press:** quick scale to 0.97 + surface darkens one step. Buttons feel like
  physical keys.
- **Focus:** 2px ring in the relevant signal color at low alpha + solid 1px inner.
- **Signature transitions:** the *seal sweep* (cyan line crosses container, ~260ms)
  and *atomic destruction* (container collapses to a hairline + flush flash, then
  gone). Respect `prefers-reduced-motion` — fall back to instant state changes.

### Transparency & blur
- Used deliberately: fixed-nav backdrop (`backdrop-filter: blur(14px)` over an
  80% obsidian), modal scrims (`rgba(8,9,11,0.66)`), and tint washes
  (`--cyan-ghost`, `--hazard-ghost`) behind status. Never blur body content.

---

## ICONOGRAPHY

- **System:** **Lucide** (https://lucide.dev), loaded from CDN. *(Substitution —
  no brand icon set was supplied.)* Chosen for its thin, even **1.5–2px stroke,
  geometric, no-fill** style that matches Airlock's hairline aesthetic perfectly.
- **Why Lucide:** open-license, huge coverage, consistent stroke. Its outline-only
  look reads as "instrument," not "app." Avoid filled/duotone icon sets — they
  fight the hairline language.
- **Usage**
  - Default size **16px** in dense UI, **20px** in nav/marketing, **2px** stroke.
  - Inherit text color (`currentColor`); only *state* icons take signal color —
    a sealed lock in cyan, a hazard triangle in orange, a threat in red.
  - Keep icons monochrome. No multi-color icons except the **logomark**.
  - Key glyphs in the lexicon: `shield` / `shield-check` (sealed), `flame` or
    `zap` (detonate), `wifi-off` (air-gapped), `box` (workspace/container),
    `trash-2` / `x` (destroy), `file-down` (drop), `link` (URL), `hash` (digest).
- **Emoji:** never used.
- **Unicode as icons:** sparingly — `·` as a mono separator in metadata strings,
  `→` in CTAs. No other glyph-as-icon hacks.
- **The logomark** (`assets/airlock-mark.svg`) is the one bespoke two-color mark:
  a sealed hatch ring with a cyan diamond aperture and seal seam. Variants:
  `airlock-mark.svg` (full color), `airlock-mark-mono.svg` (single
  `currentColor`), `airlock-logo.svg` (mark + wordmark).

---

## Index — what's in this system

| Path | What it is |
|---|---|
| `README.md` | This file — context, content + visual foundations, iconography, index |
| `colors_and_type.css` | All design tokens: color, type families, semantic type roles, spacing, radii, elevation, motion |
| `SKILL.md` | Agent-Skill manifest so this system works inside Claude Code |
| `assets/` | Logomark + wordmark SVGs (full color, mono, lockup) |
| `preview/` | Small specimen cards rendered in the Design System tab |
| `ui_kits/desktop-app/` | The Airlock Electron app — drop zone, command bar, live sealed container, workspace rail, permission + destroy flows |
| `ui_kits/website/` | The Airlock marketing site — hero, how-it-works, pricing, footer |

**No slide template** was supplied, so no `slides/` were created.

### Open questions / to confirm with the team
- **Fonts** are substitutions (Space Grotesk + JetBrains Mono). Confirm or supply
  brand fonts.
- **Primary signal color** — ice cyan reads "clean-room / safe." If the brand
  prefers a warmer or single-hazard identity, this is the biggest lever to change.
- **Product surfaces** — desktop app + marketing site are assumed. Add docs,
  onboarding, or a settings surface if those exist.
