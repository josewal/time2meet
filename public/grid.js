(() => {
  const EVENT = window.__EVENT__;
  const INITIAL = window.__INITIAL_CELLS__ || [];
  const grid = document.getElementById("grid");
  if (!grid || !EVENT) return;

  const cells = Array.from(grid.querySelectorAll(".cell"));
  const cellBySlot = new Map(cells.map(c => [parseInt(c.dataset.slot, 10), c]));
  const selected = new Set(INITIAL);

  for (const s of selected) cellBySlot.get(s)?.classList.add("selected");

  const slotOf = (el) => {
    if (!el || !el.classList || !el.classList.contains("cell")) return -1;
    const v = parseInt(el.dataset.slot, 10);
    return Number.isFinite(v) ? v : -1;
  };

  const readOnly = !EVENT.me;
  if (readOnly) {
    grid.classList.add("disabled");
    return;
  }

  const rows = parseInt(grid.dataset.rows, 10) || 0;
  for (const c of cells) {
    c.setAttribute("role", "button");
    c.setAttribute("tabindex", "0");
    c.setAttribute("aria-pressed", c.classList.contains("selected") ? "true" : "false");
  }

  let dragMode = null;
  let touched = new Set();

  const setPressed = (c, on) => c.setAttribute("aria-pressed", on ? "true" : "false");

  const apply = (slot) => {
    if (slot < 0 || touched.has(slot)) return;
    touched.add(slot);
    const c = cellBySlot.get(slot);
    if (!c) return;
    if (dragMode === "add") { selected.add(slot); c.classList.add("selected"); setPressed(c, true); }
    else { selected.delete(slot); c.classList.remove("selected"); setPressed(c, false); }
  };

  const toggleSlot = (slot) => {
    const c = cellBySlot.get(slot);
    if (!c) return;
    if (selected.has(slot)) { selected.delete(slot); c.classList.remove("selected"); setPressed(c, false); }
    else { selected.add(slot); c.classList.add("selected"); setPressed(c, true); }
    save();
  };

  const indicator = document.getElementById("save-indicator");
  const indicatorText = indicator?.querySelector(".save-indicator__text");
  let collapseTimer = null;
  const COLLAPSE_AFTER_MS = 60000;

  function expand() {
    indicator?.classList.remove("save-indicator--collapsed");
  }
  function scheduleCollapse() {
    if (collapseTimer) clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      indicator?.classList.add("save-indicator--collapsed");
    }, COLLAPSE_AFTER_MS);
  }
  function renderSaved() {
    if (!indicator || !indicatorText) return;
    indicator.dataset.state = "saved";
    indicatorText.textContent = "Saved";
  }
  function renderSaving() {
    if (!indicator || !indicatorText) return;
    if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
    expand();
    indicator.dataset.state = "saving";
    indicatorText.textContent = "Saving…";
  }
  function renderError() {
    if (!indicator) return;
    if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
    expand();
    indicator.dataset.state = "error";
    indicator.innerHTML = '<span class="save-indicator__dot" aria-hidden="true"></span><span class="save-indicator__text">Couldn\u2019t save — </span><button type="button" class="save-indicator__retry">retry</button>';
    indicator.querySelector(".save-indicator__retry")?.addEventListener("click", save);
  }

  let saveTimer = null;
  let inFlight = 0;
  const isDirty = () => saveTimer !== null || inFlight > 0;
  window.addEventListener("beforeunload", (e) => {
    if (!isDirty()) return;
    e.preventDefault();
    e.returnValue = "";
  });
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    renderSaving();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      inFlight++;
      fetch(`/api/event/${EVENT.id}/cells`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          participantId: EVENT.me.id,
          slotIndices: [...selected].sort((a, b) => a - b),
        }),
      }).then(r => {
        inFlight--;
        if (!r.ok) {
          console.error("save failed", r.status);
          renderError();
          return;
        }
        if (inFlight === 0 && !saveTimer) {
          if (indicator && !indicator.querySelector(".save-indicator__text")) {
            indicator.innerHTML = '<span class="save-indicator__dot" aria-hidden="true"></span><span class="save-indicator__text"></span>';
          }
          renderSaved();
          scheduleCollapse();
        }
        if (window.htmx) window.htmx.trigger("#results", "refresh");
      }).catch(err => {
        inFlight--;
        console.error("save error", err);
        renderError();
      });
    }, 600);
  }

  renderSaved();
  scheduleCollapse();

  const endDrag = () => {
    if (dragMode === null) return;
    dragMode = null;
    touched = new Set();
    save();
  };

  // Mouse
  grid.addEventListener("mousedown", (e) => {
    const s = slotOf(e.target);
    if (s < 0) return;
    e.preventDefault();
    dragMode = selected.has(s) ? "remove" : "add";
    touched = new Set();
    apply(s);
  });
  grid.addEventListener("mousemove", (e) => {
    if (dragMode === null) return;
    apply(slotOf(e.target));
  });
  window.addEventListener("mouseup", endDrag);
  document.addEventListener("mouseleave", endDrag);

  // Touch
  grid.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const s = slotOf(el);
    if (s < 0) return;
    dragMode = selected.has(s) ? "remove" : "add";
    touched = new Set();
    apply(s);
  }, { passive: true });
  grid.addEventListener("touchmove", (e) => {
    if (dragMode === null) return;
    e.preventDefault();
    const t = e.touches[0];
    apply(slotOf(document.elementFromPoint(t.clientX, t.clientY)));
  }, { passive: false });
  grid.addEventListener("touchend", endDrag);
  grid.addEventListener("touchcancel", endDrag);

  // Keyboard
  grid.addEventListener("keydown", (e) => {
    const s = slotOf(e.target);
    if (s < 0) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleSlot(s);
      return;
    }
    let next = -1;
    if (e.key === "ArrowUp") next = s - 1;
    else if (e.key === "ArrowDown") next = s + 1;
    else if (e.key === "ArrowLeft") next = s - rows;
    else if (e.key === "ArrowRight") next = s + rows;
    else return;
    const target = cellBySlot.get(next);
    if (target) {
      e.preventDefault();
      target.focus();
    }
  });
})();
