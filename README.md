# SAU Enterprise · Portal page

HTML + Tailwind CSS v4 build of **Portal / Desktop SAU V2 Soft** from Figma
(`SAU Portal - UI/UX Design`, node `64:912`, page *Portal*).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page: navbar, hero, Berita & Update, Favorit Harian, Jelajahi Semua Aplikasi, Ajukan akses, footer |
| `styles.css` | Compiled, minified Tailwind output; works as-is, no build needed |
| `src/input.css` | Tailwind source: design tokens (`@theme`), components, hero and carousel animation |
| `main.js` | All interactions (no dependencies) |
| `assets/` | SVG icons, app logos and images exported from Figma |
| `package.json` | Tailwind CLI scripts |

Open `index.html` directly in a browser.

```bash
npm install
npm run build   # or: npm run dev  (watch mode)
```

## Features

- **Navbar dropdowns**: Notifikasi, Organisasi, Profil. They close on outside click, Escape (focus returns to
  the button) and when tabbing away. On phones they open full-width under the navbar.
- **Search**: the hero search filters the "Jelajahi Semua Aplikasi" list (name, description, category and the
  keywords in each row's `data-keywords`) and scrolls to it, with a result bar and an empty state. The
  "Sering dicari" chips run a search. Press `/` anywhere to focus the box.
- **Berita carousel** (stacked deck, as in Figma): the front card swipes away and the next one moves forward.
  - Autoplays every 5 s and loops; the active dot fills up as the time runs.
  - Arrows, dots, ←/→ keys, and drag/swipe on the front card (it follows the finger or mouse).
  - Pauses on hover, on keyboard focus, while dragging and when the tab is hidden. No autoplay under reduced
    motion.
- **Pin / unpin** (Favorit Harian Anda):
  - Every app row in Jelajahi has a pin next to its name: red when pinned, grey on hover (always visible on
    touch screens). The pin on a Favorit card unpins it.
  - Pinned apps appear in Favorit in the order they were pinned. A toast confirms each change, with
    **Urungkan** (undo).
  - The pins are saved in `localStorage` (`sau-portal:pins`); the default is MySAU, Moover, SAUpay.
  - The "Disematkan" filter and all chip counts update live. With nothing pinned, Favorit shows an empty state.
  - Cards for apps the Figma file has no Favorit card for use their category's colours and the icon or logo
    from the list.
- **Jelajahi**: category filter chips (combine with an active search), sort (Terakhir dibuka uses the apps
  you actually opened, saved in `sau-portal:last-opened`; Nama A–Z, Z–A), grid/list toggle.
- All links use `href="#"`; point them at the real apps and pages.

## Hero animation

- **Entrance**: the status chip, headline, subtitle, search and chips rise in one after another. The
  woman rises into the disc and the six app tiles pop in clockwise.
- **Resonance**: rings keep spreading out of the disc towards the app tiles, and the disc pulses with each
  one. The dashed ring slowly turns and the tiles bob out of step with each other.
- **Greeting**: the woman floats gently and alternates between the salam pose and an open-hand welcome
  (9 s cycle, quick crossfade with a small lift at each change). The open hands reach slightly out of
  the disc. If `hero-woman-welcome.png` is missing, she stays in salam and gives a small bow instead.
- **Pointer parallax** (mouse only): ring, disc and tiles drift at different depths toward the cursor.
- `prefers-reduced-motion: reduce` turns all of it off and shows the exact Figma layout.

### The two poses

- `hero-woman-salam.png` is the Figma image (107:957).
- `hero-woman-welcome.png` is the open-hand pose supplied separately. Its checkerboard background was
  baked into the pixels, so it was cut out (cuffs and shirt kept), then scaled ×1.01 and shifted so
  the face lands exactly on the salam face. Its canvas is 528 × 768 (32 source px wider on the left so
  the fingertips aren't cut); `.hero-pose--welcome` places it.
- To replace either pose, keep the face in the same place, or the crossfade will jump.
- The disc clip is the 200px circle plus everything above the waist, so the open hands can reach past
  the disc edge; the salam pose is entirely inside the circle.

## Responsive behaviour

| Width | Layout |
| --- | --- |
| ≥ 1280px | As the Figma frame |
| 1024–1279 | Hero text and orbit side by side (orbit scaled to fit); news controls in a column beside the deck; Favorit in 2 columns |
| 640–1023 | Orbit below the hero text; news controls in a row under the deck; category panels in 2 columns |
| < 640 | Single column; orbit scaled to the screen width with labels kept at 11px; smaller deck offsets; filter chips scroll sideways |

The orbit and the HTML news banners scale with container queries (`tan(atan2(100cqw, …))`), so there's no
JavaScript. Older browsers show them at full size, clipped.

## Notes on fidelity

- **Tokens** from Figma variables: `text-ink` (`color/ink` #0B2A5B), `text-body` (`color/body` #4C6589),
  plus the page palette. Fonts: Plus Jakarta Sans 400–800, and Inter 800 (subset) for the Digital Patrol
  wordmark.
- **Icons** are the SVG exports of each Figma node.
- **Raster images** were downscaled for the web (Figma exports were up to 4096 px and 2.6 MB for a 44 px
  logo): logos to 240 px wide, the hero woman to 512 × 768, the news banner to a 1920 px JPEG.
- **News slides 2–4** are HTML banners (written from the old "Update Terbaru" items) because the Figma file
  has one banner image, repeated in all four cards. Replace them with real banner images by swapping the
  `news-canvas` block for an `<img class="news-photo">`, as in slide 1.
- **Disc mask**: Figma masks the woman with a 200px circle; this uses `clip-path` with the same circle
  (plus the area above the waist, see above), because `mask-image` doesn't load from `file://`.
- **Counts** are computed from the list, so "Semua" shows 16 apps and "SDM & Karyawan" 4 (the Figma chips say
  6 and 1). "Recruitment· 2" and "Others· 1" get their missing space. To keep the eight chips on one row
  with the longer counts, their gap is 8px instead of 10px at ≥ 1280px.
- **Carousel dots** are white on a light background in Figma; they get a faint shadow so they stay visible.
- **1.5px strokes** are inset shadows (`.stroke-15`), because Chrome rounds 1.5px borders to 1px.
- **Shadows on translucent surfaces** use `.sb`, because Figma draws them *behind* see-through fills too.
- The hero disc uses Figma's "Glass" effect, which has no CSS equivalent; it renders as its plain
  translucent circle.
