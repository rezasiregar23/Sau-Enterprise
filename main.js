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

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

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
    rows.map((row) => [row.dataset.app, { id: row.dataset.app, row, name: row.dataset.name, pinButton: $("[data-pin]", row) }])
  );

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
  const stored = store.get(KEY_PINS, DEFAULT_PINS);
  let pins = (Array.isArray(stored) ? stored : DEFAULT_PINS).filter((id, i, all) => apps.has(id) && all.indexOf(id) === i);

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
   * Tugas Saya: week calendar (Monday–Sunday)
   * Task rows carry data-date; the strip shows one dot per task (max 3).
   * ------------------------------------------------------------------ */
  const cal = $("[data-calendar]");
  if (cal) {
    const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const pad = (n) => String(n).padStart(2, "0");
    const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fromKey = (key) => {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
    const weekIndex = (d) => (d.getDay() + 6) % 7;
    const longDate = (d) => `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    // data-today pins the demo to the Figma date; without it, the real date is used.
    const now = new Date();
    const today = cal.dataset.today ? fromKey(cal.dataset.today) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const strip = $("[data-cal-days]", cal);
    const days = $$("[data-cal-day]", cal);
    const tasks = $$("[data-task]", cal);
    const taskPanel = $("[data-task-panel]", cal);
    const taskEmpty = $("[data-task-empty]", cal);
    const monthLabel = $("[data-cal-month]", cal);
    const dateLabel = $("[data-cal-label]", cal);
    const countLabel = $("[data-cal-count]", cal);
    const weekTotal = $("[data-week-total]", cal);

    const perDay = new Map();
    tasks.forEach((task) => perDay.set(task.dataset.date, (perDay.get(task.dataset.date) || 0) + 1));
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
      let total = 0;
      days.forEach((day, i) => {
        const date = addDays(weekStart, i);
        const key = toKey(date);
        const n = perDay.get(key) || 0;
        total += n;
        day.dataset.date = key;
        $(".cal-day__date", day).textContent = String(date.getDate());
        $(".cal-dots", day).replaceChildren(...Array.from({ length: Math.min(n, 3) }, () => el("i")));
        day.setAttribute("aria-label", `${longDate(date)}, ${n ? `${n} tugas` : "tidak ada tugas"}`);
        day.toggleAttribute("data-today", key === toKey(today));
      });
      const offset = Math.round((weekStart - mondayOf(today)) / (7 * 864e5));
      const when = { "-1": "minggu lalu", 0: "minggu ini", 1: "minggu depan" }[offset] || "tugas";
      setText(weekTotal, `${total} ${when}`, Boolean(slide));

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
      const list = tasks.filter((task) => task.dataset.date === key);
      setText(countLabel, list.length ? `${list.length} tugas` : "Tidak ada tugas", direction !== 0);
      const update = () => {
        tasks.forEach((task) => (task.hidden = task.dataset.date !== key));
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
          duration: 380,
          easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
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
        { duration: 320, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
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
