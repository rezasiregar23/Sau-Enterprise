// SAU Portal — interactions for the static page.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // localStorage can be unavailable (private mode, blocked storage): fall back to defaults.
  const store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* not persisted */
      }
    },
  };
  const KEY_PINS = "sau-portal:pins";
  const KEY_OPENED = "sau-portal:last-opened";
  const KEY_ORBIT = "sau-portal:orbit";
  const KEY_TASKS = "sau-portal:tasks";

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  // Figma exports have fractional sizes; set them as attributes (the properties round).
  const img = (src, w, h) => {
    const node = el("img");
    node.src = src;
    node.alt = "";
    node.setAttribute("width", String(w));
    node.setAttribute("height", String(h));
    return node;
  };

  // Dates (local time; keys are YYYY-MM-DD)
  const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const pad = (n) => String(n).padStart(2, "0");
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const weekIndex = (d) => (d.getDay() + 6) % 7;
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
  const longDate = (d) => `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const shortDate = (d) => `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  const clock = (d) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;

  // Run `done` once el's own animation ends, or after `ms` if it never does
  // (animation skipped, element hidden, tab in the background…).
  function afterAnimation(el, ms, done) {
    let called = false;
    const finish = () => {
      if (called) return;
      called = true;
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(timer);
      done();
    };
    const onEnd = (event) => event.target === el && finish();
    const timer = window.setTimeout(finish, ms);
    el.addEventListener("animationend", onEnd);
  }

  // (Re)start a one-shot animation class on el; only the latest run removes it.
  const replays = new WeakMap();
  function replay(el, className, ms) {
    const run = {};
    replays.set(el, run);
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    afterAnimation(el, ms, () => replays.get(el) === run && el.classList.remove(className));
  }

  /* ------------------------------------------------------------------
   * Dropdowns (notifikasi, organisasi, profil, urutkan)
   * ------------------------------------------------------------------ */
  const menus = $$("[data-menu]").map((root) => ({
    root,
    button: $("[data-menu-button]", root),
    panel: $("[data-menu-panel]", root),
  }));
  const isOpen = (m) => m.button.getAttribute("aria-expanded") === "true";
  const closeMenu = (m, returnFocus = false) => {
    m.button.setAttribute("aria-expanded", "false");
    m.panel.removeAttribute("data-open");
    if (returnFocus) m.button.focus();
  };
  const closeAllMenus = (except) => menus.forEach((m) => m !== except && isOpen(m) && closeMenu(m));

  menus.forEach((m) => {
    m.button.addEventListener("click", (event) => {
      const willOpen = !isOpen(m);
      closeAllMenus(m);
      m.button.setAttribute("aria-expanded", String(willOpen));
      m.panel.toggleAttribute("data-open", willOpen);
      // Opened from the keyboard: move focus into the panel.
      if (willOpen && event.detail === 0) $("a, button", m.panel)?.focus();
    });
    // Close when keyboard focus moves to something outside the dropdown
    // (outside clicks are handled by the document listener below).
    m.root.addEventListener("focusout", (event) => {
      if (isOpen(m) && event.relatedTarget && !m.root.contains(event.relatedTarget)) closeMenu(m);
    });
    // Clicking a link inside a dropdown closes it (delegated: the bell menu is re-rendered).
    m.panel.addEventListener("click", (event) => event.target.closest("a") && closeMenu(m));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-menu]")) closeAllMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = menus.find(isOpen);
    if (open) closeMenu(open, true);
  });

  /* ------------------------------------------------------------------
   * Modals: <dialog> that slides/fades in and out (a sheet on phones)
   * ------------------------------------------------------------------ */
  let escapeHandledAt = 0; // an open option list used this Escape; keep the dialog open
  const closeTimers = new WeakMap();

  function openModal(dialog) {
    window.clearTimeout(closeTimers.get(dialog));
    if (!dialog.open) {
      closeAllMenus();
      dialog.showModal();
      $("[data-modal-start]", dialog)?.focus();
    }
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.toggleAttribute("data-shown", true)));
  }
  function closeModal(dialog) {
    if (!dialog.open) return;
    dialog.removeAttribute("data-shown");
    dialog.dispatchEvent(new Event("modalclosing"));
    if (reduceMotion.matches) return dialog.close();
    window.clearTimeout(closeTimers.get(dialog));
    closeTimers.set(dialog, window.setTimeout(() => dialog.close(), 320));
  }

  $$("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (Date.now() - escapeHandledAt < 250) return;
      closeModal(dialog);
    });
    dialog.addEventListener("close", () => dialog.removeAttribute("data-shown"));
    // Press and release on the backdrop (outside the card) closes it.
    const outside = (event) => {
      const r = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
    };
    let downOutside = false;
    dialog.addEventListener("pointerdown", (event) => (downOutside = outside(event)));
    dialog.addEventListener("click", (event) => {
      if (downOutside && outside(event)) closeModal(dialog);
      downOutside = false;
    });
    $$("[data-modal-close]", dialog).forEach((button) => button.addEventListener("click", () => closeModal(dialog)));
  });

  /* ------------------------------------------------------------------
   * Toast (feedback with undo)
   * ------------------------------------------------------------------ */
  const toast = $("[data-toast]");
  const toastText = $("[data-toast-text]");
  const toastIcon = $("[data-toast-icon]");
  const toastAction = $("[data-toast-action]");
  let toastTimer = 0;
  let toastUndo = null;

  function showToast(message, { icon, light = false, undo }) {
    window.clearTimeout(toastTimer);
    toastText.textContent = message;
    toastIcon.src = icon;
    toastIcon.classList.toggle("toast-icon--light", light);
    toastUndo = undo;
    toastAction.hidden = !undo;
    // Restart the entrance animation when a toast replaces another one.
    toast.hidden = true;
    void toast.offsetWidth;
    toast.hidden = false;
    toastTimer = window.setTimeout(hideToast, 4500);
  }
  function hideToast() {
    toast.hidden = true;
    toastUndo = null;
  }
  toastAction.addEventListener("click", () => {
    const undo = toastUndo;
    hideToast();
    undo?.();
  });
  toast.addEventListener("pointerenter", () => window.clearTimeout(toastTimer));
  toast.addEventListener("pointerleave", () => (toastTimer = window.setTimeout(hideToast, 2500)));

  /* ------------------------------------------------------------------
   * App catalogue (read from the "Jelajahi" rows, the source of truth)
   * ------------------------------------------------------------------ */
  const panelsGrid = $("#app-panels");
  const panels = $$("#app-panels > [data-category]");
  const rows = $$("#app-panels [data-app]");
  const apps = new Map(
    rows.map((row) => {
      const panel = row.closest("[data-category]");
      const app = {
        id: row.dataset.app,
        row,
        name: row.dataset.name,
        order: Number(row.dataset.order),
        category: panel.dataset.category,
        categoryLabel: $("h3", panel).textContent.trim(),
        desc: $(".app-desc", row).textContent.trim(),
        href: $("[data-app-link]", row).getAttribute("href"),
        pinButton: $("[data-pin]", row),
      };
      return [app.id, app];
    })
  );
  const byOrder = (a, b) => apps.get(a).order - apps.get(b).order;
  // Categories in the list's own order, each with its apps in the default order.
  const categories = panels.map((panel) => ({
    id: panel.dataset.category,
    label: $("h3", panel).textContent.trim(),
    ids: $$("[data-app]", panel).map((row) => row.dataset.app).sort(byOrder),
  }));

  // A copy of an app's list icon: its logo, or its coloured tile.
  const appIcon = (id) => {
    const icon = $("[data-app-icon]", apps.get(id).row).cloneNode(true);
    icon.removeAttribute("data-app-icon");
    return icon;
  };
  // The icon on a white tile (Figma "Logo Aplikasi"), or the coloured tile itself.
  function logoTile(id) {
    const icon = appIcon(id);
    const tile = el("span", "logo-tile");
    if (icon.classList.contains("app-tile")) tile.classList.add("logo-tile--bare");
    tile.append(icon);
    return tile;
  }

  /* ------------------------------------------------------------------
   * "Terakhir dibuka": remember when each app was opened
   * (from the list, the hero orbit, tasks and notifications)
   * ------------------------------------------------------------------ */
  const lastOpened = store.get(KEY_OPENED, {});
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-app-link]");
    if (!link) return;
    const id = link.dataset.appLink || link.closest("[data-app]")?.dataset.app;
    if (!apps.has(id)) return;
    lastOpened[id] = Date.now();
    store.set(KEY_OPENED, lastOpened);
  });

  /* ------------------------------------------------------------------
   * Pin / unpin (the "Disematkan" filter)
   * ------------------------------------------------------------------ */
  const DEFAULT_PINS = ["mysau", "moover", "saupay"];
  const storedPins = store.get(KEY_PINS, DEFAULT_PINS);
  let pins = (Array.isArray(storedPins) ? storedPins : DEFAULT_PINS).filter((id, i, all) => apps.has(id) && all.indexOf(id) === i);

  function syncPinButtons() {
    apps.forEach((app) => {
      const on = pins.includes(app.id);
      app.row.dataset.pinned = String(on);
      app.pinButton.setAttribute("aria-pressed", String(on));
      app.pinButton.title = on ? "Lepas sematan" : "Sematkan";
    });
  }

  function setPinned(id, on, { at, notify = true } = {}) {
    const app = apps.get(id);
    const was = pins.indexOf(id);
    if (on === was > -1) return;
    if (on) {
      pins.splice(at == null ? pins.length : Math.min(at, pins.length), 0, id);
    } else {
      pins.splice(was, 1);
    }
    store.set(KEY_PINS, pins);
    syncPinButtons();
    updateCounts();
    applyList();
    if (on && !reduceMotion.matches) {
      app.pinButton.classList.remove("is-popping");
      void app.pinButton.offsetWidth;
      app.pinButton.classList.add("is-popping");
    }
    if (notify) {
      showToast(on ? `${app.name} disematkan` : `${app.name} dilepas dari sematan`, {
        icon: on ? "assets/fav-pin.svg" : "assets/fav-pin-white.svg",
        undo: () => setPinned(id, !on, { at: was > -1 ? was : undefined, notify: false }),
      });
    }
  }

  apps.forEach((app) =>
    app.pinButton.addEventListener("click", () => setPinned(app.id, !pins.includes(app.id)))
  );

  /* ------------------------------------------------------------------
   * Jelajahi Semua Aplikasi: search, filter, sort, view
   * ------------------------------------------------------------------ */
  const filterChips = $$("[data-filter]");
  const status = $("#search-status");
  const noResults = $("#no-results");
  const searchInput = $("#q");
  const searchForm = $("#search-form");
  const appSearch = $("#app-q");
  const state = { filter: "all", query: "", sort: "recent" };

  const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  rows.forEach((row) => {
    const panel = row.closest("[data-category]");
    row.dataset.haystack = normalize(
      [row.dataset.name, row.textContent, row.dataset.keywords || "", $("h3", panel)?.textContent || ""].join(" ")
    );
  });
  const matchesQuery = (id, words) => words.every((w) => apps.get(id).row.dataset.haystack.includes(w));

  function updateCounts() {
    const count = (filter) =>
      filter === "all" ? rows.length : filter === "pinned" ? pins.length : $$("[data-app]", $(`[data-category="${filter}"]`)).length;
    filterChips.forEach((chip) => (chip.textContent = `${chip.dataset.label} · ${count(chip.dataset.filter)}`));
    $$("[data-app-total]").forEach((node) => (node.textContent = String(rows.length)));
  }

  function applyList() {
    const words = normalize(state.query).split(" ").filter(Boolean);
    let total = 0;
    panels.forEach((panel) => {
      let visible = 0;
      $$("[data-app]", panel).forEach((row) => {
        const inFilter =
          state.filter === "all" ||
          (state.filter === "pinned" ? pins.includes(row.dataset.app) : panel.dataset.category === state.filter);
        row.hidden = !(inFilter && matchesQuery(row.dataset.app, words));
        if (!row.hidden) visible += 1;
      });
      panel.hidden = visible === 0;
      total += visible;
    });
    filterChips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === state.filter)));

    const searching = words.length > 0;
    status.hidden = !searching;
    if (searching) {
      $("[data-search-term]", status).textContent = state.query.trim();
      $("[data-search-count]", status).textContent = total === 0 ? "tidak ada aplikasi" : `${total} aplikasi`;
    }
    noResults.hidden = total > 0;
    const emptyPins = !searching && state.filter === "pinned";
    $("[data-empty-title]", noResults).textContent = emptyPins ? "Belum ada aplikasi yang disematkan" : "Aplikasi tidak ditemukan";
    $("[data-empty-text]", noResults).textContent = emptyPins
      ? "Tekan ikon pin di samping nama aplikasi untuk menyematkannya."
      : "Coba kata kunci lain, atau ajukan akses ke aplikasi yang Anda butuhkan.";
  }

  function applySort() {
    const label = { recent: "Terakhir dibuka", az: "Nama (A–Z)", za: "Nama (Z–A)" }[state.sort];
    $("[data-sort-label]").textContent = label;
    $$("[data-sort]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === state.sort)));
    panels.forEach((panel) => {
      const list = $("ul", panel);
      const items = $$("[data-app]", list);
      items.sort((a, b) => {
        if (state.sort === "recent") {
          const byOpened = (lastOpened[b.dataset.app] || 0) - (lastOpened[a.dataset.app] || 0);
          return byOpened || Number(a.dataset.order) - Number(b.dataset.order);
        }
        const cmp = a.dataset.name.localeCompare(b.dataset.name, "id");
        return state.sort === "az" ? cmp : -cmp;
      });
      items.forEach((item) => list.appendChild(item));
    });
  }

  // One query for both search boxes (hero and "Cari aplikasi").
  function setQuery(value) {
    state.query = value;
    if (appSearch.value !== value) appSearch.value = value;
    applyList();
  }

  filterChips.forEach((chip) =>
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      applyList();
    })
  );

  $$("[data-sort]").forEach((option) =>
    option.addEventListener("click", () => {
      state.sort = option.dataset.sort;
      applySort();
      const menu = menus.find((m) => m.root.contains(option));
      if (menu) closeMenu(menu, true);
    })
  );

  const viewButtons = $$("[data-set-view]");
  viewButtons.forEach((button) =>
    button.addEventListener("click", () => {
      viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      panelsGrid.dataset.view = button.dataset.setView;
    })
  );

  const scrollToApps = () =>
    $("#jelajahi").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });

  // Hero search filters the app list and jumps to it.
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.filter = "all";
    setQuery(searchInput.value);
    scrollToApps();
  });
  // Clearing the box clears the results.
  searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim() && state.query) setQuery("");
  });
  // "Cari aplikasi" filters as you type; Escape clears it.
  appSearch.addEventListener("input", () => setQuery(appSearch.value));
  appSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && appSearch.value) setQuery("");
  });
  $$("[data-clear-search]").forEach((button) =>
    button.addEventListener("click", () => {
      state.filter = "all";
      searchInput.value = "";
      setQuery("");
    })
  );

  // "Sering dicari" chips run a search.
  $$("[data-quick]").forEach((chip) =>
    chip.addEventListener("click", () => {
      searchInput.value = chip.dataset.quick;
      searchForm.requestSubmit();
    })
  );

  // "/" focuses the search box (unless already typing somewhere).
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const t = event.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    event.preventDefault();
    searchInput.focus();
  });

  syncPinButtons();
  updateCounts();
  applySort();
  applyList();

  /* ------------------------------------------------------------------
   * Hero orbit: the five app slots (chosen in "Atur Akses Cepat")
   * ------------------------------------------------------------------ */
  const ORBIT_SIZE = 5;
  const DEFAULT_ORBIT = ["mysau", "moover", "digital-patrol", "sau-travel", "fintera"];
  // Apps with an orbit glyph in Figma; the rest show their list icon on white.
  const ORBIT_GLYPHS = {
    mysau: ["grad-mysau", "assets/orbit-users.svg"],
    moover: ["grad-moover", "assets/orbit-car.svg"],
    "digital-patrol": ["grad-patrol", "assets/orbit-shield.svg"],
    "sau-travel": ["grad-travel", "assets/orbit-plane.svg"],
    fintera: ["grad-fintera", "assets/orbit-landmark.svg"],
    saupay: ["grad-saupay", "assets/orbit-wallet.svg"],
  };
  const cleanOrbit = (list) =>
    (Array.isArray(list) ? list : DEFAULT_ORBIT).filter((id, i, all) => apps.has(id) && all.indexOf(id) === i).slice(0, ORBIT_SIZE);
  let orbitApps = cleanOrbit(store.get(KEY_ORBIT, DEFAULT_ORBIT));
  const homeOrbit = $("[data-orbit-apps]");

  function orbitSlot(id, pos, preview) {
    const app = id ? apps.get(id) : null;
    const node = el(preview ? "span" : app ? "a" : "button", `orbit-app orbit-pos-${pos}`);
    node.dataset.slotApp = id;
    if (!app) node.classList.add("orbit-app--empty");
    if (!preview && app) {
      node.href = app.href;
      node.dataset.appLink = id;
    }
    if (!preview && !app) {
      node.type = "button";
      node.dataset.openOrbitSettings = "";
      node.setAttribute("aria-haspopup", "dialog");
    }
    const tile = el("span", app ? "orbit-tile" : "orbit-tile orbit-tile--empty");
    if (!app) {
      const plus = el("span");
      plus.append(img("assets/orbit-slot-plus.svg", 10.1667, 10.1667));
      tile.append(plus);
    } else if (ORBIT_GLYPHS[id]) {
      const [grad, glyph] = ORBIT_GLYPHS[id];
      const inner = el("span", grad);
      inner.append(img(glyph, 22, 22));
      tile.append(inner);
    } else {
      const inner = el("span", "orbit-logo");
      inner.append(appIcon(id));
      tile.append(inner);
    }
    const label = el("span", "orbit-label", app ? app.name : "Kosong");
    if (!preview && !app) label.append(el("span", "sr-only", ": tambah aplikasi ke lingkaran"));
    const bob = el("span", "orbit-bob");
    bob.append(tile, label);
    node.append(bob);
    return node;
  }

  // Replace only the slots whose app changed; those pop in, one after another.
  function renderOrbit(container, list, { preview = false, animate = false } = {}) {
    let k = 0;
    for (let pos = 0; pos < ORBIT_SIZE; pos++) {
      const id = list[pos] || "";
      const current = container.querySelector(`:scope > .orbit-pos-${pos}`);
      if (current && current.dataset.slotApp === id) continue;
      const node = orbitSlot(id, pos, preview);
      if (animate && !reduceMotion.matches) {
        node.classList.add("is-swapping");
        node.style.setProperty("--k", String(k++));
      }
      if (current) current.replaceWith(node);
      else container.append(node);
    }
  }
  if (homeOrbit) renderOrbit(homeOrbit, orbitApps);

  /* ------------------------------------------------------------------
   * Atur Akses Cepat: choose and order the apps on the circle
   * ------------------------------------------------------------------ */
  let openOrbitSettings = () => {};
  const osDialog = $("[data-orbit-settings]");
  if (osDialog && homeOrbit) {
    const preview = $("[data-os-preview]", osDialog);
    const slotList = $("[data-os-slots]", osDialog);
    const emptyButton = $("[data-os-empty]", osDialog);
    const countPill = $("[data-os-count]", osDialog);
    const hint = $("[data-os-hint]", osDialog);
    const live = $("[data-os-live]", osDialog);
    const search = $("[data-os-search]", osDialog);
    const filterBar = $("[data-os-filters]", osDialog);
    const listWrap = $("[data-os-list-wrap]", osDialog);
    const list = $("[data-os-list]", osDialog);
    const HINT = hint.textContent;
    const GAP = 8; // between slot rows
    let draft = [];
    let filter = "all";
    let hintTimer = 0;

    const announce = (text) => {
      live.textContent = "";
      window.setTimeout(() => (live.textContent = text), 30);
    };

    // Cards, grouped by category (Daftar Aplikasi 154:1118)
    const cards = new Map();
    function buildCard(id) {
      const app = apps.get(id);
      const card = el("button", "os-card");
      card.type = "button";
      card.dataset.app = id;
      card.setAttribute("aria-pressed", "false");
      const text = el("span", "os-card__text");
      text.append(el("span", "", app.name), el("span", "", app.desc));
      const act = el("span", "os-card__act");
      act.setAttribute("aria-hidden", "true");
      const plus = img("assets/icon-plus-brand.svg", 11.3333, 11.3333);
      plus.className = "is-plus";
      const check = img("assets/icon-check-white.svg", 12.6667, 9.33333);
      check.className = "is-check";
      act.append(plus, check);
      card.append(logoTile(id), text, act);
      card.addEventListener("click", () => toggle(id));
      return card;
    }
    const groupNodes = categories.map((group) => {
      const section = el("section", "os-group");
      const title = el("h4", "os-group__title", `${group.label} · ${group.ids.length}`);
      const grid = el("div", "os-grid");
      group.ids.forEach((id) => {
        const card = buildCard(id);
        cards.set(id, card);
        grid.append(card);
      });
      section.append(title, grid);
      return section;
    });
    const none = el("p", "os-none", "Aplikasi tidak ditemukan. Coba kata kunci lain.");
    none.hidden = true;
    list.append(...groupNodes, none);

    // Filter Kategori (154:1103)
    const chips = [{ id: "all", label: "Semua", n: apps.size }, ...categories.map((c) => ({ id: c.id, label: c.label, n: c.ids.length }))].map(
      (f) => {
        const chip = el("button", "chip-sm", `${f.label} · ${f.n}`);
        chip.type = "button";
        chip.dataset.osFilter = f.id;
        chip.setAttribute("aria-pressed", String(f.id === "all"));
        chip.addEventListener("click", () => {
          filter = f.id;
          chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
          applyFilter(true);
        });
        return chip;
      }
    );
    filterBar.append(...chips);

    const updateFade = () =>
      listWrap.toggleAttribute("data-at-end", list.scrollTop + list.clientHeight >= list.scrollHeight - 4);
    list.addEventListener("scroll", updateFade, { passive: true });

    function applyFilter(animate) {
      const words = normalize(search.value).split(" ").filter(Boolean);
      let any = false;
      groupNodes.forEach((section, gi) => {
        const group = categories[gi];
        const inGroup = filter === "all" || filter === group.id;
        let visible = 0;
        group.ids.forEach((id) => {
          const show = inGroup && matchesQuery(id, words);
          cards.get(id).hidden = !show;
          if (show) visible += 1;
        });
        section.hidden = visible === 0;
        if (visible) any = true;
        if (visible && animate && !reduceMotion.matches) replay(section, "list-enter", 800);
      });
      none.hidden = any;
      list.scrollTop = 0;
      updateFade();
    }
    search.addEventListener("input", () => applyFilter(false));

    // Aplikasi di Lingkaran (154:1002): keyed rows, moved with FLIP
    const slotNodes = new Map();
    function slotItem(id) {
      const app = apps.get(id);
      const li = el("li", "os-slot");
      li.dataset.app = id;
      const grip = el("button", "os-grip");
      grip.type = "button";
      grip.setAttribute("aria-label", `Ubah urutan ${app.name} (panah atas/bawah)`);
      grip.append(img("assets/icon-grip.svg", 6.13333, 11.4667));
      const remove = el("button", "os-remove");
      remove.type = "button";
      remove.setAttribute("aria-label", `Hapus ${app.name} dari lingkaran`);
      const x = el("span", "ico ico-14");
      x.append(img("assets/icon-x-sm.svg", 9, 9));
      remove.append(x);
      remove.addEventListener("click", () => {
        const at = draft.indexOf(id);
        toggle(id);
        // keep keyboard focus nearby
        const next = slotNodes.get(draft[Math.min(at, draft.length - 1)]);
        (next ? $(".os-remove", next) : emptyButton).focus();
      });
      li.append(grip, logoTile(id), el("span", "os-slot__name", app.name), remove);
      return li;
    }

    function syncSlots(animate) {
      const motion = animate && !reduceMotion.matches;
      const focused = slotList.contains(document.activeElement) ? document.activeElement : null;
      const before = new Map();
      if (motion) slotNodes.forEach((li, id) => before.set(id, li.getBoundingClientRect().top));
      // Rows that left fade out where they were, out of the flow.
      slotNodes.forEach((li, id) => {
        if (draft.includes(id)) return;
        slotNodes.delete(id);
        if (!motion) return li.remove();
        const top = li.offsetTop;
        Object.assign(li.style, { position: "absolute", left: "0", right: "0", top: `${top}px`, pointerEvents: "none" });
        li.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.96)" }], {
          duration: 220,
          easing: "ease",
        }).onfinish = () => li.remove();
      });
      slotNodes.forEach((li) => {
        li.classList.remove("is-shifting");
        li.style.translate = "";
      });
      const added = [];
      draft.forEach((id) => {
        let li = slotNodes.get(id);
        if (!li) {
          li = slotItem(id);
          slotNodes.set(id, li);
          added.push(li);
        }
        slotList.append(li);
      });
      if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
      if (!motion) return;
      slotNodes.forEach((li, id) => {
        const old = before.get(id);
        if (old === undefined) return;
        const dy = old - li.getBoundingClientRect().top;
        if (Math.abs(dy) > 0.5) {
          li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
            duration: 380,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          });
        }
      });
      added.forEach((li, i) => {
        li.style.setProperty("--i", String(i));
        replay(li, "list-enter", 800);
      });
    }

    function syncAll({ animate = true } = {}) {
      syncSlots(animate);
      renderOrbit(preview, draft, { preview: true, animate });
      cards.forEach((card, id) => card.setAttribute("aria-pressed", String(draft.includes(id))));
      list.toggleAttribute("data-full", draft.length >= ORBIT_SIZE);
      countPill.textContent = `${draft.length}/${ORBIT_SIZE} slot`;
      emptyButton.hidden = draft.length >= ORBIT_SIZE;
    }

    function warnFull() {
      hint.textContent = "Lingkaran sudah penuh. Hapus satu aplikasi dulu untuk menambah yang lain.";
      hint.dataset.warn = "";
      if (!reduceMotion.matches) replay(countPill, "is-nudging", 600);
      announce(hint.textContent);
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => {
        hint.textContent = HINT;
        delete hint.dataset.warn;
      }, 2800);
    }

    function toggle(id) {
      const at = draft.indexOf(id);
      const name = apps.get(id).name;
      if (at > -1) {
        draft.splice(at, 1);
        announce(`${name} dihapus dari lingkaran.`);
      } else if (draft.length < ORBIT_SIZE) {
        draft.push(id);
        announce(`${name} ditambahkan ke lingkaran, posisi ${draft.length}.`);
      } else {
        return warnFull();
      }
      syncAll();
    }

    function move(from, to) {
      const [id] = draft.splice(from, 1);
      draft.splice(to, 0, id);
      announce(`${apps.get(id).name} dipindah ke posisi ${to + 1} dari ${draft.length}.`);
      syncAll();
    }

    // Drag a row by its grip (mouse, touch or pen); the others make room.
    let drag = null;
    slotList.addEventListener("pointerdown", (event) => {
      const grip = event.target.closest(".os-grip");
      if (!grip || event.button !== 0) return;
      const li = grip.closest(".os-slot");
      const items = draft.map((id) => slotNodes.get(id));
      event.preventDefault();
      grip.setPointerCapture(event.pointerId);
      const from = items.indexOf(li);
      drag = { li, items, from, to: from, y: event.clientY, id: event.pointerId, step: li.offsetHeight + GAP, moved: false };
    });
    slotList.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { li, items, from, step } = drag;
      let dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dy) < 4) return;
        drag.moved = true;
        li.classList.add("is-dragging");
        items.forEach((n) => n !== li && n.classList.add("is-shifting"));
      }
      dy = Math.max(-from * step - 10, Math.min((items.length - 1 - from) * step + 10, dy));
      li.style.translate = `0 ${dy}px`;
      const to = Math.max(0, Math.min(items.length - 1, from + Math.round(dy / step)));
      if (to === drag.to) return;
      drag.to = to;
      items.forEach((n, i) => {
        if (n === li) return;
        const shift = from < to && i > from && i <= to ? -step : from > to && i >= to && i < from ? step : 0;
        n.style.translate = shift ? `0 ${shift}px` : "";
      });
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { li, from, to, moved } = drag;
      drag = null;
      if (!moved) return;
      li.classList.remove("is-dragging");
      if (to !== from) move(from, to);
      else syncSlots(true); // glide back into place
    };
    slotList.addEventListener("pointerup", endDrag);
    slotList.addEventListener("pointercancel", endDrag);

    // Keyboard: ↑/↓ on a grip moves that app.
    slotList.addEventListener("keydown", (event) => {
      const grip = event.target.closest(".os-grip");
      const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (!grip || !step) return;
      event.preventDefault();
      const id = grip.closest(".os-slot").dataset.app;
      const from = draft.indexOf(id);
      const to = from + step;
      if (to < 0 || to >= draft.length) return;
      move(from, to);
      $(".os-grip", slotNodes.get(id)).focus({ preventScroll: true });
    });

    emptyButton.addEventListener("click", () => {
      search.focus({ preventScroll: true });
      search.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
    });

    $("[data-os-reset]", osDialog).addEventListener("click", () => {
      draft = [...DEFAULT_ORBIT];
      announce("Lingkaran dikembalikan ke aplikasi default.");
      syncAll();
    });

    $("[data-os-save]", osDialog).addEventListener("click", () => {
      const before = [...orbitApps];
      const next = [...draft];
      closeModal(osDialog);
      if (before.join() === next.join()) return;
      const apply = (list) => {
        orbitApps = list;
        store.set(KEY_ORBIT, orbitApps);
        renderOrbit(homeOrbit, orbitApps, { animate: true });
      };
      // Let the modal fade first, so the new tiles pop in where you can see them.
      window.setTimeout(() => {
        apply(next);
        showToast("Lingkaran beranda diperbarui", {
          icon: "assets/orbit-setting.svg",
          light: true,
          undo: () => apply(before),
        });
      }, 240);
    });

    openOrbitSettings = () => {
      draft = [...orbitApps];
      filter = "all";
      search.value = "";
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.osFilter === "all")));
      window.clearTimeout(hintTimer);
      hint.textContent = HINT;
      delete hint.dataset.warn;
      slotNodes.forEach((li) => li.remove());
      slotNodes.clear();
      preview.replaceChildren();
      syncAll({ animate: false });
      applyFilter(false);
      openModal(osDialog);
      requestAnimationFrame(updateFade);
    };
  }
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-orbit-settings]")) openOrbitSettings();
  });

  /* ------------------------------------------------------------------
   * Tasks: the demo's "today", people who hand out tasks, saved tasks
   * ------------------------------------------------------------------ */
  const cal = $("[data-calendar]");
  // data-today pins the demo to the Figma date; without it, the real date is used.
  const today = cal?.dataset.today ? fromKey(cal.dataset.today) : startOfDay(new Date());
  const people = new Map(
    $$("#tf-by-list [role='option']").map((o) => [o.dataset.value, { name: o.dataset.name, role: o.dataset.role, initials: o.dataset.initials }])
  );
  const storedTasks = store.get(KEY_TASKS, []);
  let customTasks = (Array.isArray(storedTasks) ? storedTasks : []).filter(
    (t) =>
      t && (!t.app || apps.has(t.app)) && typeof t.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.start) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t.due)
  );

  // Same markup as the task rows in index.html. New tasks have no app (the form
  // has no Aplikasi field); ones saved by an earlier version may still name one.
  function taskRow(task) {
    const app = task.app ? apps.get(task.app) : null;
    const due = new Date(task.due);
    const dueKey = task.due.slice(0, 10);
    const li = el("li", "task-row");
    Object.assign(li.dataset, { task: "", date: task.start, due: dueKey, custom: task.id });
    const text = el("span", "task-text");
    const link = el("a", "task-link", task.title);
    link.href = app ? app.href : "#";
    if (app) link.dataset.appLink = app.id;
    // "given": handed to a colleague (Beri Tugas); "assigned": received (saved by an earlier version)
    const person = people.get(task.by);
    const who = person && task.kind === "given" ? `Untuk ${person.name}` : person && task.kind === "assigned" ? `Dari ${person.name}` : "Tugas pribadi";
    text.append(link, el("span", "task-meta", app ? `${app.name} · ${who}` : who));
    const left = daysBetween(today, due);
    const tone = left <= 0 ? "urgent" : left <= 2 ? "soon" : "later";
    const label = task.start === dueKey ? `Batas ${clock(due)}` : `Batas ${due.getDate()} ${MONTHS_SHORT[due.getMonth()]} · ${clock(due)}`;
    const pill = el("span", `task-due task-due--${tone}`, label);
    pill.title = `Deadline ${shortDate(due)} · ${clock(due)}`;
    const go = el("span", "task-go");
    go.setAttribute("aria-hidden", "true");
    go.append(img("assets/arrow-users.svg", 14, 14));
    let icon;
    if (app) {
      icon = appIcon(app.id);
    } else {
      icon = el("span", "app-tile bg-brand-soft");
      icon.append(img("assets/panel-clipboard.svg", 20, 20));
    }
    li.append(icon, text, pill, go);
    return li;
  }

  /* ------------------------------------------------------------------
   * Tugas Saya: week calendar (Monday–Sunday)
   * A task shows on every day from data-date to data-due; the strip shows
   * one dot per task (max 3).
   * ------------------------------------------------------------------ */
  let calendar = null;
  if (cal) {
    const strip = $("[data-cal-days]", cal);
    const days = $$("[data-cal-day]", cal);
    const taskList = $("[data-task-list]", cal);
    const taskPanel = $("[data-task-panel]", cal);
    const taskEmpty = $("[data-task-empty]", cal);
    const monthLabel = $("[data-cal-month]", cal);
    const dateLabel = $("[data-cal-label]", cal);
    const countLabel = $("[data-cal-count]", cal);

    customTasks.forEach((task) => {
      const row = taskRow(task);
      row.hidden = true;
      taskList.append(row);
    });
    let tasks = $$("[data-task]", cal);
    const isOn = (task, key) => task.dataset.date <= key && key <= (task.dataset.due || task.dataset.date);
    days.forEach((day, i) => day.style.setProperty("--i", String(i)));

    let weekStart = mondayOf(today);
    let selected = today;
    let slideTimer = 0;

    const setText = (node, text, animate) => {
      if (node.textContent === text) return;
      node.textContent = text;
      if (animate && !reduceMotion.matches) replay(node, "text-swap", 500);
    };

    function renderWeek(slide) {
      days.forEach((day, i) => {
        const date = addDays(weekStart, i);
        const key = toKey(date);
        const n = tasks.filter((task) => isOn(task, key)).length;
        day.dataset.date = key;
        $(".cal-day__date", day).textContent = String(date.getDate());
        $(".cal-dots", day).replaceChildren(...Array.from({ length: Math.min(n, 3) }, () => el("i")));
        day.setAttribute("aria-label", `${longDate(date)}, ${n ? `${n} tugas` : "tidak ada tugas"}`);
        day.toggleAttribute("data-today", key === toKey(today));
      });
      if (!slide || reduceMotion.matches) return;
      window.clearTimeout(slideTimer);
      strip.removeAttribute("data-slide");
      void strip.offsetWidth;
      strip.dataset.slide = slide;
      slideTimer = window.setTimeout(() => strip.removeAttribute("data-slide"), 700);
    }

    // Show the tasks of the selected day. The list slides in from the
    // direction of travel and its height eases to the new size.
    function showTasks(direction) {
      const key = toKey(selected);
      const list = tasks.filter((task) => isOn(task, key));
      setText(countLabel, list.length ? `${list.length} tugas` : "Tidak ada tugas", direction !== 0);
      const update = () => {
        tasks.forEach((task) => (task.hidden = !isOn(task, key)));
        taskEmpty.hidden = list.length > 0;
      };
      if (direction === 0 || reduceMotion.matches) return update();

      const from = taskPanel.offsetHeight;
      update();
      const to = taskPanel.offsetHeight;
      taskPanel.style.setProperty("--from-x", `${direction * 18}px`);
      (list.length ? list : [taskEmpty]).forEach((node, i) => {
        node.style.setProperty("--i", String(i));
        replay(node, "list-enter", 1000);
      });
      if (from !== to) {
        taskPanel.style.overflowY = "clip";
        const anim = taskPanel.animate([{ height: `${from}px` }, { height: `${to}px` }], {
          duration: 420,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
        anim.onfinish = anim.oncancel = () => (taskPanel.style.overflowY = "");
      }
    }

    function select(date, { focus = false, animate = true } = {}) {
      const index = weekIndex(date);
      if (animate && date.getTime() === selected.getTime()) {
        if (focus) days[index].focus();
        return;
      }
      const direction = animate ? Math.sign(date - selected) : 0;
      const week = mondayOf(date);
      selected = date;
      if (week.getTime() !== weekStart.getTime()) {
        const slide = animate ? (week > weekStart ? "next" : "prev") : null;
        weekStart = week;
        renderWeek(slide);
      }
      days.forEach((day, i) => {
        day.setAttribute("aria-selected", String(i === index));
        day.tabIndex = i === index ? 0 : -1;
      });
      strip.style.setProperty("--sel", String(index));
      setText(monthLabel, `${MONTHS[date.getMonth()]} ${date.getFullYear()}`, animate);
      setText(dateLabel, longDate(date), animate);
      showTasks(direction);
      if (focus) days[index].focus();
    }

    days.forEach((day) => day.addEventListener("click", () => select(fromKey(day.dataset.date))));
    $("[data-cal-prev]", cal).addEventListener("click", () => select(addDays(selected, -7)));
    $("[data-cal-next]", cal).addEventListener("click", () => select(addDays(selected, 7)));
    $("[data-cal-today]", cal).addEventListener("click", () => select(today));

    // Keyboard (tabs pattern): ←/→ a day, Home/End start/end of the week, PageUp/PageDown a week.
    strip.addEventListener("keydown", (event) => {
      const i = weekIndex(selected);
      const step = { ArrowLeft: -1, ArrowRight: 1, Home: -i, End: 6 - i, PageUp: -7, PageDown: 7 }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      select(addDays(selected, step), { focus: true });
    });

    // Swipe the strip sideways on touch screens to change week.
    let swipe = null;
    strip.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    strip.addEventListener("pointerup", (event) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) select(addDays(selected, dx < 0 ? 7 : -7));
    });
    strip.addEventListener("pointercancel", () => (swipe = null));

    renderWeek(null);
    select(today, { animate: false });

    calendar = {
      get selected() {
        return selected;
      },
      // Add a row and bring it into view: on the open day if it shows there,
      // otherwise on its first day.
      add(row) {
        row.hidden = true;
        taskList.append(row);
        tasks = $$("[data-task]", cal);
        renderWeek(null);
        if (isOn(row, toKey(selected))) {
          showTasks(0);
          if (!reduceMotion.matches) {
            row.style.setProperty("--i", "0");
            replay(row, "list-enter", 900);
          }
        } else {
          select(fromKey(row.dataset.date));
        }
        if (!reduceMotion.matches) replay(row, "is-new", 2600);
        row.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
      },
      remove(row) {
        row.remove();
        tasks = $$("[data-task]", cal);
        renderWeek(null);
        showTasks(0);
      },
    };
  }

  /* ------------------------------------------------------------------
   * Dropdown (listbox in a popover): "Ditugaskan kepada"
   * ------------------------------------------------------------------ */
  function createSelect(root, { onChange }) {
    const button = $(".select-btn", root);
    const pop = $(".select-pop", root);
    const list = $("[data-select-list]", root);
    const options = () => $$('[role="option"]', list);
    const isShown = () => pop.matches(":popover-open");
    let active = -1;

    // The list lives in the top layer, so it's placed against the viewport.
    function place() {
      const r = button.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 240 && above > below;
      pop.style.left = `${r.left}px`;
      pop.style.width = `${r.width}px`;
      pop.style.maxHeight = `${Math.min(320, Math.max(160, up ? above : below))}px`;
      pop.style.top = up ? "auto" : `${r.bottom + 6}px`;
      pop.style.bottom = up ? `${window.innerHeight - r.top + 6}px` : "auto";
      pop.dataset.side = up ? "top" : "bottom";
    }
    function setActive(i, scroll = true) {
      const opts = options();
      if (!opts.length) return;
      active = Math.max(0, Math.min(opts.length - 1, i));
      opts.forEach((o, j) => o.classList.toggle("is-active", j === active));
      list.setAttribute("aria-activedescendant", opts[active].id);
      if (scroll) opts[active].scrollIntoView({ block: "nearest" });
    }
    function open() {
      if (isShown()) return;
      pop.showPopover();
      place();
      button.setAttribute("aria-expanded", "true");
      const chosen = options().findIndex((o) => o.getAttribute("aria-selected") === "true");
      setActive(chosen > -1 ? chosen : 0);
      list.focus({ preventScroll: true });
    }
    function close(focusButton = true) {
      if (!isShown()) return;
      pop.hidePopover();
      button.setAttribute("aria-expanded", "false");
      list.removeAttribute("aria-activedescendant");
      if (focusButton) button.focus({ preventScroll: true });
    }
    function choose(i) {
      const opt = options()[i];
      if (!opt) return;
      options().forEach((o) => o.setAttribute("aria-selected", String(o === opt)));
      close();
      onChange(opt.dataset.value);
    }

    button.addEventListener("click", () => (isShown() ? close() : open()));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      open();
    });
    list.addEventListener("keydown", (event) => {
      const n = options().length;
      switch (event.key) {
        case "ArrowDown": setActive(active + 1); break;
        case "ArrowUp": setActive(active - 1); break;
        case "Home": setActive(0); break;
        case "End": setActive(n - 1); break;
        case "Enter":
        case " ": choose(active); break;
        case "Escape": escapeHandledAt = Date.now(); close(); break;
        case "Tab": close(false); return;
        default: {
          // Type-ahead: jump to the next option starting with that letter.
          if (event.key.length !== 1) return;
          const key = event.key.toLowerCase();
          const opts = options();
          for (let k = 1; k <= opts.length; k++) {
            const j = (active + k) % opts.length;
            if ($(".select-opt__text", opts[j]).textContent.trim().toLowerCase().startsWith(key)) {
              setActive(j);
              break;
            }
          }
        }
      }
      event.preventDefault();
      event.stopPropagation();
    });
    list.addEventListener("click", (event) => {
      const opt = event.target.closest('[role="option"]');
      if (opt) choose(options().indexOf(opt));
    });
    list.addEventListener("pointermove", (event) => {
      const opt = event.target.closest('[role="option"]');
      if (opt) setActive(options().indexOf(opt), false);
    });
    document.addEventListener("pointerdown", (event) => isShown() && !root.contains(event.target) && close(false), true);
    window.addEventListener("resize", () => isShown() && place());
    root.closest(".modal-body")?.addEventListener("scroll", () => isShown() && place(), { passive: true });
    root.closest("dialog")?.addEventListener("modalclosing", () => close(false));

    return {
      close,
      reset() {
        options().forEach((o) => o.setAttribute("aria-selected", "false"));
      },
    };
  }

  /* ------------------------------------------------------------------
   * Tambah Tugas: a task of your own, or one you give to a colleague
   * ------------------------------------------------------------------ */
  const taskDialog = $("[data-task-dialog]");
  if (taskDialog && calendar) {
    const form = $("[data-task-form]", taskDialog);
    const titleInput = $("#tf-name", form);
    const titleCount = $("[data-title-count]", form);
    const dateInput = $("#tf-date", form);
    const dueInput = $("#tf-due", form);
    const dateText = $("[data-date-text]", form);
    const dueText = $("[data-due-text]", form);
    const dueLeft = $("[data-due-left]", form);
    const assignedBlock = $("[data-assigned-only]", form);
    const infoText = $("[data-info-text]", form);
    const infoIcons = $$("[data-info-icon]", form);
    const INFO_SELF = infoText.textContent;
    const INFO_GIVEN = infoText.dataset.infoGiven;
    const MAX_TITLE = Number(titleInput.maxLength) || 100;
    const picked = { by: "" };
    let settleTimer = 0;

    const kind = () => form.elements.kind.value;

    function renderBy() {
      const value = $('[data-select="by"] [data-select-value]', form);
      const person = people.get(picked.by);
      if (!person) return value.replaceChildren(el("span", "select-placeholder", "Pilih rekan kerja"));
      const text = el("span", "select-person");
      text.append(el("span", "", person.name), el("span", "", person.role));
      value.replaceChildren(el("span", "avatar", person.initials), text);
    }

    const bySelect = createSelect($('[data-select="by"]', form), {
      onChange(id) {
        picked.by = id;
        renderBy();
        clearError("by");
        updateInfo();
      },
    });

    // Errors under each field
    const fieldOf = {
      title: () => titleInput.closest(".field-box"),
      by: () => $("#tf-by", form),
      date: () => dateInput.closest(".field-box"),
      due: () => dueInput.closest(".field-box"),
    };
    const focusOf = { title: () => titleInput, by: () => $("#tf-by", form), date: () => dateInput, due: () => dueInput };
    function setError(name, message) {
      const node = $(`[data-error="${name}"]`, form);
      node.textContent = message;
      node.hidden = false;
      fieldOf[name]().toggleAttribute("data-invalid", true);
    }
    function clearError(name) {
      const node = $(`[data-error="${name}"]`, form);
      node.textContent = "";
      node.hidden = true;
      fieldOf[name]().removeAttribute("data-invalid");
    }

    function updateInfo() {
      const given = kind() === "given";
      infoIcons.forEach((icon) => (icon.hidden = icon.dataset.infoIcon !== (given ? "given" : "self")));
      infoText.textContent = given ? INFO_GIVEN : INFO_SELF;
    }
    // The person field opens only for "Beri Tugas".
    function updateKind() {
      const assigned = kind() === "given";
      window.clearTimeout(settleTimer);
      assignedBlock.inert = !assigned;
      assignedBlock.classList.remove("is-settled");
      assignedBlock.classList.toggle("is-open", assigned);
      if (assigned) {
        settleTimer = window.setTimeout(() => assignedBlock.classList.add("is-settled"), reduceMotion.matches ? 0 : 460);
      } else {
        bySelect.close(false);
        clearError("by");
      }
      updateInfo();
    }
    $$('input[name="kind"]', form).forEach((input) => input.addEventListener("change", updateKind));

    titleInput.addEventListener("input", () => {
      titleCount.textContent = `${titleInput.value.length}/${MAX_TITLE}`;
      if (titleInput.value.trim()) clearError("title");
    });

    // Tanggal & Deadline: native pickers under formatted text
    function updateDates() {
      const start = dateInput.value ? fromKey(dateInput.value) : null;
      dateText.textContent = start ? shortDate(start) : "Pilih tanggal";
      dateText.toggleAttribute("data-empty", !start);
      dueInput.min = dateInput.value ? `${dateInput.value}T00:00` : "";
      const due = dueInput.value ? new Date(dueInput.value) : null;
      dueText.textContent = due ? `${shortDate(due)} · ${clock(due)}` : "Pilih deadline";
      dueText.toggleAttribute("data-empty", !due);
      dueLeft.hidden = !due;
      if (due) {
        const left = daysBetween(today, due);
        dueLeft.textContent = left < 0 ? `Lewat ${-left} hari` : left === 0 ? "Hari ini" : left === 1 ? "Besok" : `${left} hari lagi`;
        dueLeft.dataset.tone = left <= 7 ? "urgent" : "calm";
      }
    }
    dateInput.addEventListener("input", () => {
      // Keep the deadline on or after the new date, at the same time of day.
      if (dateInput.value && dueInput.value && dueInput.value.slice(0, 10) < dateInput.value) {
        dueInput.value = `${dateInput.value}T${dueInput.value.slice(11, 16)}`;
      }
      if (dateInput.value) clearError("date");
      clearError("due");
      updateDates();
    });
    dueInput.addEventListener("input", () => {
      clearError("due");
      updateDates();
    });
    // Desktop browsers open the picker on a click anywhere in the field.
    [dateInput, dueInput].forEach((input) =>
      input.addEventListener("click", () => {
        try {
          input.showPicker();
        } catch {
          /* the browser opens it itself, or can't */
        }
      })
    );

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const errors = [];
      if (!titleInput.value.trim()) errors.push(["title", "Judul tugas wajib diisi."]);
      if (kind() === "given" && !picked.by) errors.push(["by", "Pilih rekan kerja untuk tugas ini."]);
      if (!dateInput.value) errors.push(["date", "Pilih tanggal tugas."]);
      if (!dueInput.value) errors.push(["due", "Tentukan deadline tugas."]);
      else if (dateInput.value && dueInput.value.slice(0, 10) < dateInput.value) errors.push(["due", "Deadline tidak boleh sebelum tanggal."]);
      Object.keys(fieldOf).forEach(clearError);
      if (errors.length) {
        errors.forEach(([name, message]) => setError(name, message));
        focusOf[errors[0][0]]().focus();
        return;
      }

      const task = {
        id: `t${Date.now().toString(36)}`,
        kind: kind(),
        title: titleInput.value.trim().slice(0, MAX_TITLE),
        by: kind() === "given" ? picked.by : "",
        start: dateInput.value,
        due: dueInput.value.slice(0, 16),
      };
      customTasks = [...customTasks, task];
      store.set(KEY_TASKS, customTasks);
      const row = taskRow(task);
      closeModal(taskDialog);
      window.setTimeout(() => {
        calendar.add(row);
        showToast("Tugas ditambahkan ke Tugas Saya", {
          icon: "assets/notif-check.svg",
          light: true,
          undo: () => {
            customTasks = customTasks.filter((t) => t.id !== task.id);
            store.set(KEY_TASKS, customTasks);
            calendar.remove(row);
          },
        });
      }, 240);
    });

    function openTaskForm() {
      form.reset();
      picked.by = "";
      bySelect.reset();
      renderBy();
      Object.keys(fieldOf).forEach(clearError);
      const start = toKey(calendar.selected);
      dateInput.value = start;
      dueInput.value = `${start}T17:00`;
      titleCount.textContent = `0/${MAX_TITLE}`;
      updateKind();
      updateDates();
      openModal(taskDialog);
    }
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-task-form]")) openTaskForm();
    });
  }

  /* ------------------------------------------------------------------
   * Notifikasi: filters, mark as read, and the navbar bell menu
   * ------------------------------------------------------------------ */
  const notifPanel = $("[data-notifs]");
  if (notifPanel) {
    const notifs = $$("[data-notif]", notifPanel);
    const filters = $$("[data-notif-filter]", notifPanel);
    const markAll = $("[data-notif-mark-all]", notifPanel);
    const empty = $("[data-notif-empty]", notifPanel);
    const menuList = $("[data-notif-menu]");
    const menuEmpty = $("[data-notif-menu-empty]");
    const badge = $("[data-notif-badge]");
    const bell = $('[aria-controls="menu-notif"]');
    const EMPTY_TEXT = {
      all: "Belum ada notifikasi.",
      read: "Belum ada notifikasi yang sudah dibaca.",
      unread: "Semua notifikasi sudah dibaca.",
    };
    const leaving = new Map();
    let filter = "all";

    const isRead = (row) => row.hasAttribute("data-read");
    const fits = (row) => filter === "all" || (filter === "read") === isRead(row);

    function setRead(row, read) {
      row.toggleAttribute("data-read", read);
      $("[data-notif-state]", row).textContent = read ? "Sudah dibaca" : "Belum dibaca";
    }

    // A row that no longer fits the filter folds away, then hides.
    function leave(row) {
      row.style.overflow = "hidden";
      const anim = row.animate(
        [
          { opacity: 1, height: `${row.offsetHeight}px` },
          { opacity: 0, height: "0px", paddingTop: "0px", paddingBottom: "0px", borderWidth: "0px", marginBottom: "-10px" },
        ],
        { duration: 340, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
      );
      leaving.set(row, anim);
      anim.onfinish = () => {
        leaving.delete(row);
        row.hidden = !fits(row);
        row.style.overflow = "";
        anim.cancel();
        refreshEmpty();
      };
    }

    function refreshEmpty() {
      const any = notifs.some((row) => !row.hidden);
      empty.textContent = EMPTY_TEXT[filter];
      if (empty.hidden === any) return;
      empty.hidden = any;
      if (!any && !reduceMotion.matches) replay(empty, "list-enter", 700);
    }

    // Apply the filter. `enter` replays every visible row's entrance (filter
    // change); `changed` rows that drop out of the filter fold away.
    function render({ changed = [], enter = false } = {}) {
      let i = 0;
      notifs.forEach((row) => {
        if (fits(row)) {
          const anim = leaving.get(row);
          if (anim) {
            leaving.delete(row);
            anim.onfinish = null;
            anim.cancel();
            row.style.overflow = "";
          }
          const appearing = row.hidden || Boolean(anim);
          row.hidden = false;
          if ((enter || appearing) && !reduceMotion.matches) {
            row.style.setProperty("--i", String(i));
            replay(row, "list-enter", 900);
          }
          i += 1;
        } else if (!row.hidden && !leaving.has(row)) {
          if (changed.includes(row) && !reduceMotion.matches) leave(row);
          else row.hidden = true;
        }
      });
      refreshEmpty();
      syncMenu();
    }

    // Unread count, "Tandai dibaca" state and the bell menu.
    function syncMenu() {
      const unread = notifs.filter((row) => !isRead(row));
      badge.textContent = `${unread.length} baru`;
      badge.hidden = unread.length === 0;
      bell.setAttribute("aria-label", unread.length ? `Notifikasi, ${unread.length} baru` : "Notifikasi");
      markAll.setAttribute("aria-disabled", String(unread.length === 0));
      menuEmpty.hidden = unread.length > 0;
      menuList.replaceChildren(
        ...unread.map((row) => {
          const link = $(".notif-link", row);
          const item = el("a", "menu-item items-start");
          item.href = link.getAttribute("href");
          item.addEventListener("click", () => markRead([row]));
          const text = el("span", "flex min-w-0 flex-col gap-[3px]");
          text.append(
            el("span", "text-[13px] font-bold leading-[18px]", link.textContent),
            el("span", "text-[11px] font-medium leading-[15px] text-muted", `${$(".notif-desc", row).textContent} · ${$(".notif-time", row).textContent}`)
          );
          item.append($(".notif-icon", row).cloneNode(true), text);
          const li = el("li");
          li.append(item);
          return li;
        })
      );
    }

    function markRead(list, { notify = false } = {}) {
      const changed = list.filter((row) => !isRead(row));
      if (!changed.length) return;
      changed.forEach((row) => setRead(row, true));
      render({ changed });
      if (notify) {
        showToast(`${changed.length} notifikasi ditandai sudah dibaca`, {
          icon: "assets/notif-check.svg",
          light: true,
          undo: () => {
            changed.forEach((row) => setRead(row, false));
            render({ changed });
          },
        });
      }
    }

    filters.forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.notifFilter === filter) return;
        filter = button.dataset.notifFilter;
        filters.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        render({ enter: true });
      })
    );
    markAll.addEventListener("click", () => markRead(notifs, { notify: true }));
    // Opening a notification marks it as read.
    notifs.forEach((row) => $(".notif-link", row).addEventListener("click", () => markRead([row])));

    render();
  }

  /* ------------------------------------------------------------------
   * Hero greeting: salam → open-hand welcome, once the second pose has
   * loaded (if it's missing, the salam pose simply stays). The orbit
   * itself stays put; it no longer follows the pointer.
   * ------------------------------------------------------------------ */
  const woman = $("[data-hero-woman]");
  const welcome = woman && $("[data-welcome]", woman);
  if (welcome) {
    // Decode first: an image that was never painted can otherwise show up
    // blank while its opacity animation runs on the compositor.
    const enable = () =>
      welcome
        .decode()
        .catch(() => {})
        .then(() => {
          welcome.hidden = false;
          woman.dataset.poses = "2";
        });
    if (welcome.complete && welcome.naturalWidth) enable();
    else welcome.addEventListener("load", enable, { once: true });
  }
})();
