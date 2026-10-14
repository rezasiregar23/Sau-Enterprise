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
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-menu]")) closeAllMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = menus.find(isOpen);
    if (open) closeMenu(open, true);
  });
  // Clicking a link inside a dropdown closes it.
  menus.forEach((m) => $$("a", m.panel).forEach((a) => a.addEventListener("click", () => closeMenu(m))));

  /* ------------------------------------------------------------------
   * Toast (pin / unpin feedback, with undo)
   * ------------------------------------------------------------------ */
  const toast = $("[data-toast]");
  const toastText = $("[data-toast-text]");
  const toastIcon = $("[data-toast-icon]");
  const toastAction = $("[data-toast-action]");
  let toastTimer = 0;
  let toastUndo = null;

  function showToast(message, { pinned, undo }) {
    window.clearTimeout(toastTimer);
    toastText.textContent = message;
    toastIcon.src = pinned ? "assets/fav-pin.svg" : "assets/fav-pin-white.svg";
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
  const THEME_GRAD = {
    sdm: "grad-mysau",
    mobilitas: "grad-moover",
    keuangan: "grad-saupay",
    assessment: "grad-pink",
    recruitment: "grad-violet",
    others: "grad-rose",
  };

  const apps = new Map(
    rows.map((row) => {
      const panel = row.closest("[data-category]");
      const app = {
        id: row.dataset.app,
        row,
        name: row.dataset.name,
        category: panel.dataset.category,
        categoryLabel: $("h3", panel).textContent.trim(),
        desc: $(".app-desc", row).textContent.trim(),
        href: $("[data-app-link]", row).getAttribute("href"),
        pinButton: $("[data-pin]", row),
      };
      return [app.id, app];
    })
  );

  /* ------------------------------------------------------------------
   * "Terakhir dibuka": remember when each app was opened
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
   * Pin / unpin → "Favorit Harian Anda"
   * ------------------------------------------------------------------ */
  const favList = $("[data-fav-list]");
  const favEmpty = $("[data-fav-empty]");
  const DEFAULT_PINS = ["mysau", "moover", "saupay"];
  const stored = store.get(KEY_PINS, DEFAULT_PINS);
  let pins = (Array.isArray(stored) ? stored : DEFAULT_PINS).filter((id, i, all) => apps.has(id) && all.indexOf(id) === i);

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const img = (src, w, h) => {
    const node = el("img");
    Object.assign(node, { src, width: w, height: h, alt: "" });
    return node;
  };

  // Same markup as the default cards in index.html.
  function buildFavCard(app) {
    const { row } = app;
    const solid = row.dataset.favVariant === "solid";
    const grad = row.dataset.favGrad || THEME_GRAD[app.category];

    const li = el("li", "fav-item");
    li.dataset.fav = app.id;
    const card = el("div", `fav-card ${solid ? "fav-card--solid" : "fav-card--glass"}`);
    if (!solid) card.dataset.theme = app.category;

    // Icon: the Figma app tile when there is one, otherwise the icon from the list row.
    let tile;
    if (row.dataset.favIcon) {
      tile = el("span", `fav-tile ${solid ? "tile--glass" : grad}`);
      const size = row.dataset.favIcon.includes("orbit-") ? 22 : 24;
      tile.append(img(row.dataset.favIcon, size, size));
    } else {
      const icon = $("[data-app-icon]", row).cloneNode(true);
      icon.removeAttribute("data-app-icon");
      if (icon.classList.contains("app-tile")) {
        icon.classList.replace("app-tile", "fav-tile");
        tile = icon;
      } else {
        tile = el("span", "fav-tile fav-tile--logo");
        tile.append(icon);
      }
    }

    const text = el("span", "fav-text");
    const link = el("a", "fav-link", app.name);
    link.href = app.href;
    link.dataset.appLink = app.id;
    text.append(el("span", "fav-chip", app.categoryLabel), link, el("span", "fav-desc", row.dataset.favDesc || app.desc));

    const pin = el("button", "fav-pin");
    pin.type = "button";
    pin.dataset.unpin = app.id;
    pin.setAttribute("aria-label", `Lepas sematan ${app.name}`);
    pin.title = "Lepas sematan";
    pin.append(img(solid ? "assets/fav-pin-white.svg" : "assets/fav-pin.svg", 14, 14));

    const go = el("span", `fav-go ${solid ? "bg-white" : grad}`);
    go.setAttribute("aria-hidden", "true");
    go.append(img(solid ? "assets/fav-arrow-blue.svg" : "assets/fav-arrow-white.svg", 16, 16));

    card.append(tile, text, pin, go);
    li.append(card);
    return li;
  }

  // Keep existing cards (and focus) where possible; add/remove/reorder the rest.
  function renderFavs(enteringId) {
    const existing = new Map($$("[data-fav]", favList).map((li) => [li.dataset.fav, li]));
    existing.forEach((li, id) => !pins.includes(id) && li.remove());
    pins.forEach((id) => {
      const li = existing.get(id) || buildFavCard(apps.get(id));
      if (id === enteringId && !reduceMotion.matches) {
        li.classList.add("is-entering");
        afterAnimation(li.firstElementChild, 600, () => li.classList.remove("is-entering"));
      }
      favList.append(li);
    });
    favList.hidden = pins.length === 0;
    favEmpty.hidden = pins.length > 0;
  }

  function syncPinButtons() {
    apps.forEach((app) => {
      const on = pins.includes(app.id);
      app.row.dataset.pinned = String(on);
      app.pinButton.setAttribute("aria-pressed", String(on));
      app.pinButton.title = on ? "Lepas sematan" : "Sematkan ke Favorit";
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
    renderFavs(on ? id : null);
    syncPinButtons();
    updateCounts();
    applyList();
    if (on && !reduceMotion.matches) {
      app.pinButton.classList.remove("is-popping");
      void app.pinButton.offsetWidth;
      app.pinButton.classList.add("is-popping");
    }
    if (notify) {
      showToast(on ? `${app.name} disematkan ke Favorit` : `${app.name} dilepas dari Favorit`, {
        pinned: on,
        undo: () => setPinned(id, !on, { at: was > -1 ? was : undefined, notify: false }),
      });
    }
  }

  // Pin toggles in the list.
  apps.forEach((app) =>
    app.pinButton.addEventListener("click", () => setPinned(app.id, !pins.includes(app.id)))
  );

  // Unpin from a Favorit card: animate the card out, then remove it.
  favList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unpin]");
    if (!button) return;
    const id = button.dataset.unpin;
    const li = button.closest(".fav-item");
    const hadFocus = li.contains(document.activeElement);
    const next = li.nextElementSibling || li.previousElementSibling;
    const finish = () => {
      setPinned(id, false);
      // Keep keyboard users in place: next card's pin, or the section heading.
      if (hadFocus) ((next && $("[data-unpin]", next)) || $("#favorit-title")).focus();
    };
    if (reduceMotion.matches) return finish();
    li.classList.add("is-leaving");
    afterAnimation(li, 320, finish);
  });

  /* ------------------------------------------------------------------
   * Jelajahi Semua Aplikasi: search, filter, sort, view
   * ------------------------------------------------------------------ */
  const filterChips = $$("[data-filter]");
  const status = $("#search-status");
  const noResults = $("#no-results");
  const searchInput = $("#q");
  const searchForm = $("#search-form");
  const state = { filter: "all", query: "", sort: "recent" };

  const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  rows.forEach((row) => {
    const panel = row.closest("[data-category]");
    row.dataset.haystack = normalize(
      [row.dataset.name, row.textContent, row.dataset.keywords || "", $("h3", panel)?.textContent || ""].join(" ")
    );
  });

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
        const inQuery = words.every((w) => row.dataset.haystack.includes(w));
        row.hidden = !(inFilter && inQuery);
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
      ? "Tekan ikon pin di samping nama aplikasi untuk menyematkannya ke Favorit."
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
    state.query = searchInput.value;
    state.filter = "all";
    applyList();
    scrollToApps();
  });
  // Clearing the box clears the results.
  searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim() && state.query) {
      state.query = "";
      applyList();
    }
  });
  $$("[data-clear-search]").forEach((button) =>
    button.addEventListener("click", () => {
      state.query = "";
      state.filter = "all";
      searchInput.value = "";
      applyList();
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

  renderFavs();
  syncPinButtons();
  updateCounts();
  applySort();
  applyList();

  /* ------------------------------------------------------------------
   * Berita: stacked deck — autoplay, arrows, dots, keys, drag/swipe
   * ------------------------------------------------------------------ */
  const carousel = $("[data-carousel]");
  if (carousel) {
    const deck = $("[data-deck]", carousel);
    const cards = $$("[data-slide]", carousel);
    const dots = $$("[data-dot]", carousel);
    const n = cards.length;
    const INTERVAL = 5000;
    let index = 0;
    let timer = 0;
    let deadline = 0;
    let remaining = INTERVAL;
    const pauses = new Set();

    carousel.style.setProperty("--interval", `${INTERVAL}ms`);

    const posOf = (i) => (i - index + n) % n;
    function layout() {
      cards.forEach((card, i) => {
        const front = posOf(i) === 0;
        if (!card.hasAttribute("data-leaving")) card.dataset.pos = String(posOf(i));
        card.inert = !front;
        card.setAttribute("aria-hidden", String(!front));
      });
      dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === index)));
    }

    // The old front card swipes away (staying on top until it's gone), then
    // slots in at the back of the deck.
    function sendToBack(card) {
      card.removeAttribute("data-entering");
      card.toggleAttribute("data-leaving", true);
      afterAnimation(card, 600, () => {
        if (!card.hasAttribute("data-leaving")) return; // brought back by "prev" meanwhile
        card.removeAttribute("data-leaving");
        card.style.transition = "none";
        card.style.opacity = "0";
        card.style.removeProperty("--drag-x");
        card.style.removeProperty("--drag-r");
        card.dataset.pos = String(posOf(cards.indexOf(card)));
        void card.offsetWidth;
        card.style.transition = "";
        card.style.opacity = "";
      });
    }

    function go(target, { user = false } = {}) {
      const next = (target + n) % n;
      if (next === index) return;
      const from = cards[index];
      const forward = (next - index + n) % n <= n / 2;
      index = next;
      if (reduceMotion.matches) {
        layout();
      } else if (forward) {
        sendToBack(from);
        layout();
      } else {
        // Going back: the card comes in from the left on top of the deck.
        const to = cards[index];
        to.style.transition = "none";
        to.removeAttribute("data-leaving");
        to.toggleAttribute("data-entering", true);
        layout();
        void to.offsetWidth;
        to.style.transition = "";
        afterAnimation(to, 650, () => to.removeAttribute("data-entering"));
      }
      deck.setAttribute("aria-live", user ? "polite" : "off");
      restartTimer();
    }

    // Autoplay with a progress bar in the active dot; pausing keeps the time left.
    const running = () => !reduceMotion.matches && pauses.size === 0;
    function restartTimer() {
      remaining = INTERVAL;
      dots.forEach((d) => $(".news-dot", d).classList.remove("is-running"));
      void carousel.offsetWidth;
      if (!reduceMotion.matches) $(".news-dot", dots[index]).classList.add("is-running");
      schedule();
    }
    function schedule() {
      window.clearTimeout(timer);
      carousel.toggleAttribute("data-paused", !running());
      if (!running()) return;
      deadline = Date.now() + remaining;
      timer = window.setTimeout(() => go(index + 1), remaining);
    }
    function pause(reason) {
      if (pauses.has(reason)) return;
      if (running()) remaining = Math.max(0, deadline - Date.now());
      pauses.add(reason);
      schedule();
    }
    function resume(reason) {
      if (!pauses.delete(reason)) return;
      schedule();
    }

    $("[data-prev]", carousel).addEventListener("click", () => go(index - 1, { user: true }));
    $("[data-next]", carousel).addEventListener("click", () => go(index + 1, { user: true }));
    dots.forEach((dot, i) => dot.addEventListener("click", () => go(i, { user: true })));
    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") go(index - 1, { user: true });
      if (event.key === "ArrowRight") go(index + 1, { user: true });
    });

    carousel.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && pause("hover"));
    carousel.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && resume("hover"));
    // Keyboard focus pauses; a mouse click on an arrow or dot doesn't.
    carousel.addEventListener("focusin", (e) => e.target.matches(":focus-visible") && pause("focus"));
    carousel.addEventListener("focusout", (e) => !carousel.contains(e.relatedTarget) && resume("focus"));
    document.addEventListener("visibilitychange", () => (document.hidden ? pause("hidden") : resume("hidden")));

    // Drag / swipe the front card: it follows the pointer, and past the
    // threshold flies off (next) or makes way for the previous card.
    let drag = null;
    let suppressClick = false;
    deck.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const card = event.target.closest("[data-slide]");
      if (!card || card.dataset.pos !== "0" || card.hasAttribute("data-leaving")) return;
      drag = { card, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, active: false };
    });
    deck.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return (drag = null); // vertical scroll
        if (Math.abs(dx) < 8) return;
        drag.active = true;
        drag.card.setPointerCapture(event.pointerId);
        drag.card.toggleAttribute("data-dragging", true);
        pause("drag");
      }
      drag.dx = dx;
      drag.card.style.translate = `${dx}px 0`;
      drag.card.style.rotate = `${dx * 0.015}deg`;
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { card, dx, active } = drag;
      drag = null;
      if (!active) return;
      suppressClick = true;
      card.removeAttribute("data-dragging");
      card.style.translate = "";
      card.style.rotate = "";
      const threshold = Math.min(90, deck.clientWidth * 0.18);
      if (dx < -threshold && !reduceMotion.matches) {
        card.style.setProperty("--drag-x", `${dx}px`);
        card.style.setProperty("--drag-r", `${dx * 0.015}deg`);
        go(index + 1, { user: true });
      } else if (dx < -threshold) {
        go(index + 1, { user: true });
      } else if (dx > threshold) {
        go(index - 1, { user: true });
      }
      resume("drag");
    };
    deck.addEventListener("pointerup", endDrag);
    deck.addEventListener("pointercancel", endDrag);
    // A drag isn't a click on the banner link.
    deck.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
    deck.addEventListener("dragstart", (event) => event.preventDefault());

    layout();
    restartTimer();
    reduceMotion.addEventListener?.("change", restartTimer);
  }

  /* ------------------------------------------------------------------
   * Hero: pointer parallax + greeting poses
   * ------------------------------------------------------------------ */
  const hero = $(".hero-card");
  const orbit = $("[data-orbit]");
  const finePointer = window.matchMedia("(pointer: fine)");
  if (hero && orbit) {
    let frame = 0;
    let nx = 0;
    let ny = 0;
    const setVars = () => {
      frame = 0;
      orbit.style.setProperty("--px", (nx * 8).toFixed(2));
      orbit.style.setProperty("--py", (ny * 8).toFixed(2));
    };
    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || !finePointer.matches || reduceMotion.matches) return;
      const r = orbit.getBoundingClientRect();
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      nx = clamp((event.clientX - (r.left + r.width / 2)) / (r.width / 2));
      ny = clamp((event.clientY - (r.top + r.height / 2)) / (r.height / 2));
      if (!frame) frame = requestAnimationFrame(setVars);
    });
    hero.addEventListener("pointerleave", () => {
      nx = 0;
      ny = 0;
      if (!frame) frame = requestAnimationFrame(setVars);
    });
  }

  // Salam → open-hand welcome: switched on once the second pose image has
  // loaded (if it's missing, the salam pose simply stays).
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
