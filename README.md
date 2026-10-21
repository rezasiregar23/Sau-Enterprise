# SAU Enterprise · Portal page

HTML + Tailwind CSS v4 build of **Portal / Desktop SAU V2 Soft** from Figma
(`SAU Portal - UI/UX Design`, node `64:912`, page *Portal*).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page: navbar, hero, My Task And Notification, Jelajahi Semua Aplikasi, Ajukan akses, footer |
| `styles.css` | Compiled, minified Tailwind output; works as-is, no build needed |
| `src/input.css` | Tailwind source: design tokens (`@theme`), components, hero and calendar animation |
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
  the button) and when tabbing away. On phones they open full-width under the navbar. The bell menu lists
  the unread items of the Notifikasi panel ("N baru"); opening one marks it read.
- **Search**: the hero search filters the "Jelajahi Semua Aplikasi" list (name, description, category and the
  keywords in each row's `data-keywords`) and scrolls to it, with a result bar and an empty state. The
  "Sering dicari" chips run a search. Press `/` anywhere to focus the box. "Cari aplikasi" in the Jelajahi
  header filters as you type (Escape clears); both boxes share one query.
- **Hero "Add" tile** (orbit/+ future): links to the Ajukan akses panel, which rings briefly on arrival.
- **Tugas Saya: week calendar** (Monday–Sunday):
  - Click a day to see its tasks. The blue tile slides to that day, the list slides in from the direction
    you moved and its height eases to fit. Days without tasks show an empty state.
  - ‹ › move a week (the same weekday stays selected; the days slide in), **Hari ini** jumps back to today.
    On touch screens, swipe the day strip sideways to change week.
  - Keyboard: ←/→ a day (crossing into the next/previous week), Home/End the start/end of the week,
    PageUp/PageDown a week.
  - Dots under each date show its number of tasks (max 3). The pill counts the week's tasks ("10 minggu ini",
    "… minggu lalu", "… minggu depan"). When another day is selected, today's date is shown in blue.
  - Tasks are the `<li data-task data-date="YYYY-MM-DD">` rows in `index.html`; `data-done` marks a finished
    one. The demo's "today" is fixed to 19 Oct 2026 (the Figma date) by `data-today` on the panel; remove it
    to use the real date.
- **Notifikasi**: Semua / Sudah Dibaca / Belum Dibaca filters (rows animate in), **Tandai dibaca** marks all
  read with an **Urungkan** (undo) toast; opening a notification marks it read. Rows that drop out of the
  current filter fold away. `data-read` on a row marks it read.
- **Pin / unpin**: every app row in Jelajahi has a pin next to its name: red when pinned, grey on hover
  (always visible on touch screens). A toast confirms each change, with **Urungkan** (undo). Pins are saved
  in `localStorage` (`sau-portal:pins`; default MySAU, Moover, SAUpay) and listed by the "Disematkan" filter.
- **Jelajahi**: category filter chips (combine with an active search), sort (Terakhir dibuka uses the apps
  you actually opened, including from tasks and notifications, saved in `sau-portal:last-opened`; Nama A–Z,
  Z–A), grid/list toggle.
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
| 1024–1279 | Hero text and orbit side by side (orbit scaled to fit); Tugas Saya and Notifikasi side by side (7 : 5) |
| 640–1023 | Orbit below the hero text; Tugas Saya above Notifikasi; category panels in 2 columns |
| < 640 | Single column; orbit scaled to the screen width with labels kept at 11px; task deadline pills move under the task text and notification text wraps instead of being cut; "Cari aplikasi" takes the full width; filter chips scroll sideways |
| < 360 | The "10 minggu ini" pill and "Tandai dibaca" move under the panel description |

The orbit scales with a container query (`tan(atan2(100cqw, …))`), so there's no JavaScript. Older browsers
show it at full size, clipped.

## Notes on fidelity

- **Tokens** from Figma variables: `text-ink` (`color/ink` #0B2A5B), `text-body` (`color/body` #4C6589),
  plus the page palette. Fonts: Plus Jakarta Sans 400–800, and Inter 800 (subset) for the Digital Patrol
  wordmark.
- **Icons** are the SVG exports of each Figma node.
- **Raster images** were downscaled for the web (Figma exports were up to 4096 px and 2.6 MB for a 44 px
  logo): logos to 240 px wide, the hero woman to 512 × 768. Task rows reuse the same logo files as the list.
- **Tasks outside 19 Oct**: Figma only shows the list for Senin 19. The other days' tasks are sample data
  that match the dot counts in Figma (2, 0, 3, 1, 0, 0) plus a few in the weeks before and after, so the
  week navigation has something to show. Task indicator dots are drawn in CSS (same 5px dots, 3px gap,
  #2F86F0) because their number changes per day.
- **Selected day**: Figma's selected tile is 71px high (no border) against 73px for the others; here all
  tiles are 73px so the sliding tile keeps one size.
- **Disc mask**: Figma masks the woman with a 200px circle; this uses `clip-path` with the same circle
  (plus the area above the waist, see above), because `mask-image` doesn't load from `file://`.
- **Counts** are computed from the list, so "Semua" shows 16 apps and "SDM & Karyawan" 4 (the Figma chips say
  6 and 1). "Recruitment· 2" and "Others· 1" get their missing space. To keep the eight chips on one row
  with the longer counts, their gap is 8px instead of 10px at ≥ 1280px.
- **1.5px strokes** are inset shadows (`.stroke-15`), because Chrome rounds 1.5px borders to 1px.
- **Shadows on translucent surfaces** use `.sb`, because Figma draws them *behind* see-through fills too.
- The hero disc uses Figma's "Glass" effect, which has no CSS equivalent; it renders as its plain
  translucent circle.
