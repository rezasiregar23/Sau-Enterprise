# SAU Enterprise · Portal page

HTML + Tailwind CSS v4 build of **Portal / Desktop SAU V2 Soft** from Figma
(`SAU Portal - UI/UX Design`, node `64:912`, page *Portal - Glass*).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page: navbar, hero, Berita & Update, Favorit Harian, Jelajahi Semua Aplikasi, Ajukan akses, footer |
| `styles.css` | Compiled, minified Tailwind output; works as-is, no build needed |
| `src/input.css` | Tailwind source: design tokens (`@theme`), glass/gradient components, hero animation |
| `main.js` | All interactions (no dependencies) |
| `assets/` | 51 SVG icons + 3 PNG images exported from Figma |
| `package.json` | Tailwind CLI scripts |

Open `index.html` directly in a browser.

```bash
npm install
npm run build   # or: npm run dev  (watch mode)
```

## Features

- **Navbar dropdowns**: Notifikasi (latest updates), Organisasi (active org), Profil (account links).
  They close on outside click, Escape (focus returns to the button) and when tabbing away. On phones they
  open full-width under the navbar, so the org name and profile details hidden there are still reachable.
- **Search**: the hero search filters the "Jelajahi Semua Aplikasi" list (name, description, category and
  keywords in each row's `data-keywords`) and scrolls to it, with a result bar and an empty state.
  The "Sering dicari" chips run a search. Press `/` anywhere to focus the box.
- **Hero orbit**: each app tile is a link, with hover and keyboard focus states.
- **Berita carousel**: 3 slides with arrows, dots, left/right keys and swipe. It autoplays every 7s and
  pauses on hover/focus, when the tab is hidden, and under reduced motion. "Baca Selengkapnya" follows the
  current slide's `data-href`.
- **Jelajahi**: category filter chips (combine with an active search), sort (Terakhir dibuka by
  `data-order`, Nama A–Z, Z–A), grid/list toggle.
- All links use `href="#"`; point them at the real apps and pages.

Content not in the Figma file: carousel slides 2 and 3 (written from the "Update Terbaru" items), the
dropdown contents, the sort options and the search keywords. Replace them with the real copy.

## Hero animation

- **Entrance**: the status chip, both headline lines, subtitle, search and chips rise in one after
  another. The avatar lifts into the disc and the six app tiles pop in clockwise.
- **Idle**: the dashed ring slowly turns, the tiles bob out of step with each other, and the avatar
  floats. A soft pulse ring spreads from the disc to the orbit, the status dot pings, and the 👋 waves once
  (and again on hover).
- **Pointer parallax** (mouse only): ring, disc, avatar and tiles drift at different depths toward the
  cursor.
- `prefers-reduced-motion: reduce` turns all of it off. The page then shows the exact Figma layout.

## Responsive behaviour

| Width | Layout |
| --- | --- |
| ≥ 1280px | Identical to the Figma frame (checked to within 1px at 1440) |
| 1024–1279 | Hero text and orbit side by side (orbit scaled to fit); banner above a 3-column update strip |
| 640–1023 | Hero orbit below the text at full size; Favorit 2 + 1 cards; category panels in 2 columns |
| < 640 | Single column; orbit scaled to the screen width with labels kept at 11px; filter chips scroll sideways; banner icon shrinks to the corner |

The orbit scales with a container query (`tan(atan2(100cqw, 440px))`), so there's no JavaScript. Older
browsers show it at full size, clipped.

## Notes on fidelity

- **Tokens** from Figma variables: `text-ink` (`color/ink` #0B2A5B), `text-body` (`color/body` #4C6589),
  plus the page palette (`heading`, `muted`, `subtle`, `brand`, tints…). Font: Plus Jakarta Sans
  400–800 via Google Fonts.
- **Icons** are the exact SVG exports of each Figma node (verified byte-for-byte).
- **Raster images** (`logo-sau.png`, `avatar-head.png`, `avatar-body.png`) are 1× renders, so they look
  slightly soft on high-DPI screens. Swap in 2× exports when you have them.
- **Background blobs** are CSS (`blur(60px)` = Figma layer blur 120). Figma's SVG export crops them at the
  frame edge.
- **1.5px strokes** are inset shadows (`.stroke-15`), because Chrome rounds 1.5px borders to 1px and
  shifts layout.
- **Shadows on translucent surfaces** use `.sb`, because Figma draws them *behind* see-through fills
  too, which `box-shadow` can't do.
- Figma clips the shadows under the news banner and Favorit cards at the section edge; here they're left
  whole.
- The hero disc uses Figma's "Glass" effect, which has no CSS equivalent; it renders as its plain
  translucent circle.
