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
- **Atur Akses Cepat** (Figma 154:290): the **Setting** tile on the hero circle opens a modal to choose which
  apps sit on the circle (up to 5) from the whole Jelajahi list.
  - Left: a live preview of the circle and the chosen apps. Drag a row by its grip (mouse or touch) or use
    ↑/↓ on the grip to reorder; × removes; the dashed "Slot kosong" row jumps to the search.
  - Right: search and category chips over all apps, grouped by category; + adds to the first free place,
    ✓ removes. With five chosen, the count pill shakes and the hint says the circle is full.
  - **Atur ulang ke default** restores MySAU, Moover, Digital Patrol, SAU Travel, Fintera. **Simpan
    Perubahan** updates the home circle (changed tiles pop in) with an **Urungkan** toast; **Batal**, ×,
    Escape or a click on the backdrop discard the changes. Saved in `localStorage` (`sau-portal:orbit`).
  - Places run clockwise from the top-left (`.orbit-pos-0`…`4`); Setting keeps the bottom place. Apps that
    have no orbit glyph in Figma show their list logo or icon on a white tile. An empty place shows a dashed
    "Kosong" tile that opens the modal.
- **Tambah Tugas** (Figma 155:558 Tugas Sendiri, 155:1293 Beri Tugas): the button in the Tugas Saya header.
  - Jenis Tugas (Tugas Sendiri / Beri Tugas: given to a colleague), Judul Tugas (max 100, with a
    counter), the person (only for Beri Tugas; "Ditugaskan kepada" (Figma still says "Ditugaskan oleh"); the people are the options in `#tf-by-list`), Tanggal and
    Deadline (the phone's or browser's date picker, shown formatted) with "N hari lagi" counted from today.
  - Required fields are checked on save; errors show under each field and focus the first one. A deadline
    before the date isn't accepted (changing the date moves an earlier deadline along).
  - The new task shows in Tugas Saya on every day from Tanggal to the deadline day, with "Tugas pribadi" or
    "Untuk <name>" and its deadline, on a clipboard tile (the form has no Aplikasi field; Figma does); the calendar jumps to it and it glows briefly. **Urungkan** in the toast
    removes it. Saved in `localStorage` (`sau-portal:tasks`).
- **Detail Tugas** (no Figma frame; built from the Tambah Tugas parts): click a task you added to see
  its status, type, Tanggal, Deadline (with days left) and colleague, then:
  - **Tandai Selesai**: the row greys out with a "Selesai" badge; on a done task the button is **Buka
    Kembali**.
  - **Edit**: the Tambah Tugas form opens filled in ("Edit Tugas" / "Simpan Perubahan"); the calendar
    jumps to the task's new first day.
  - **Hapus**: the row folds away.
  - Each action shows a toast with **Urungkan** (undo). The sample tasks in `index.html` keep linking to
    their apps.
  - The modals are `<dialog>`s: focus stays inside, Escape closes (an open option list first), the page
    behind doesn't scroll. On phones they slide up as full-width sheets.
- **Tugas Saya: week calendar** (Monday–Sunday):
  - Click a day to see its tasks. The blue tile slides to that day, the list slides in from the direction
    you moved and its height eases to fit. Days without tasks show an empty state.
  - ‹ › move a week (the same weekday stays selected; the days slide in), **Hari ini** jumps back to today.
    On touch screens, swipe the day strip sideways to change week.
  - Keyboard: ←/→ a day (crossing into the next/previous week), Home/End the start/end of the week,
    PageUp/PageDown a week.
  - Dots under each date show its number of tasks (max 3). When another day is selected, today's date is
    shown in blue.
  - Tasks are the `<li data-task data-date="YYYY-MM-DD">` rows in `index.html` (`data-due` makes one span
    several days); `data-done` marks a finished one. The demo's "today" is fixed to 19 Oct 2026 (the Figma date) by `data-today` on the panel; remove it
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
  woman rises into the disc and the six tiles pop in clockwise.
- **Resonance**: a ring spreads out of the disc every 2 s (6 s each) and the disc breathes slowly with them.
  The dashed ring turns once every 2 minutes and the tiles bob gently, out of step with each other.
- **Greeting**: the woman floats gently and alternates between the salam pose and an open-hand welcome
  (10 s cycle, one-second crossfades with a small lift at each change). The open hands reach slightly out
  of the disc. If `hero-woman-welcome.png` is missing, she stays in salam and gives a small bow instead.
- The circle stays put: it doesn't follow the pointer. All loops use long sine easing and move only
  transform/opacity, so they run on the compositor.
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
| < 1024 | Atur Akses Cepat stacks its two columns |
| < 640 | Tambah Tugas and Atur Akses Cepat open as bottom sheets; the Tambah Tugas button gets its own full-width row |
| < 360 | "Tandai dibaca" moves under the panel description |

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
