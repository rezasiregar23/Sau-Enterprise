// SAU Portal — interactions for the static page.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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
   * Jelajahi Semua Aplikasi: search, filter, sort, view
   * ------------------------------------------------------------------ */
  const panelsGrid = $("#app-panels");
  const panels = $$("#app-panels > [data-category]");
  const rows = $$("#app-panels [data-app]");
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

  function applyList() {
    const words = normalize(state.query).split(" ").filter(Boolean);
    let total = 0;
    panels.forEach((panel) => {
      let visible = 0;
      $$("[data-app]", panel).forEach((row) => {
        const inFilter =
          state.filter === "all" ||
          (state.filter === "pinned" ? row.dataset.pinned === "true" : panel.dataset.category === state.filter);
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
  }

  function applySort() {
    const label = { recent: "Terakhir dibuka", az: "Nama (A–Z)", za: "Nama (Z–A)" }[state.sort];
    $("[data-sort-label]").textContent = label;
    $$("[data-sort]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === state.sort)));
    panels.forEach((panel) => {
      const list = $("ul", panel);
      const items = $$("[data-app]", list);
      items.sort((a, b) => {
        if (state.sort === "recent") return Number(a.dataset.order) - Number(b.dataset.order);
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

  /* ------------------------------------------------------------------
   * Berita carousel
   * ------------------------------------------------------------------ */
  const carousel = $("[data-carousel]");
  if (carousel) {
    const slides = $$("[data-slide]", carousel);
    const dots = $$("[data-dot]", carousel);
    const region = $("[data-slides]", carousel);
    const link = $("[data-slide-link]", carousel);
    let index = 0;
    let timer = 0;
    let paused = false;

    const show = (next, fromUser = false) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === index;
        slide.toggleAttribute("data-active", active);
        slide.inert = !active;
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === index)));
      if (link) link.href = slides[index].dataset.href || "#";
      region.setAttribute("aria-live", fromUser ? "polite" : "off");
      if (fromUser) restart();
    };
    const restart = () => {
      window.clearInterval(timer);
      if (reduceMotion.matches || paused) return;
      timer = window.setInterval(() => show(index + 1), 7000);
    };

    $("[data-prev]", carousel).addEventListener("click", () => show(index - 1, true));
    $("[data-next]", carousel).addEventListener("click", () => show(index + 1, true));
    dots.forEach((dot, i) => dot.addEventListener("click", () => show(i, true)));
    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") show(index - 1, true);
      if (event.key === "ArrowRight") show(index + 1, true);
    });

    // Pause while the reader is hovering or focused inside, or the tab is hidden.
    const pause = () => { paused = true; window.clearInterval(timer); };
    const resume = () => { paused = false; restart(); };
    carousel.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && pause());
    carousel.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && resume());
    carousel.addEventListener("focusin", pause);
    carousel.addEventListener("focusout", (e) => !carousel.contains(e.relatedTarget) && resume());
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));

    // Swipe on touch screens.
    let startX = 0;
    let startY = 0;
    region.addEventListener("pointerdown", (e) => { startX = e.clientX; startY = e.clientY; });
    region.addEventListener("pointerup", (e) => {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - startY)) show(index + (dx < 0 ? 1 : -1), true);
    });

    show(0);
    restart();
    reduceMotion.addEventListener?.("change", restart);
  }

  /* ------------------------------------------------------------------
   * Hero orbit: pointer parallax (mouse/trackpad only, no reduced motion)
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
})();
