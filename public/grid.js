(() => {
  const EVENT = window.__EVENT__;
  const INITIAL = window.__INITIAL_CELLS__ || [];
  const grid = document.getElementById("grid");
  if (!grid || !EVENT) return;

  const cols = parseInt(grid.dataset.cols, 10);
  const rows = parseInt(grid.dataset.rows, 10);
  const cells = Array.from(grid.querySelectorAll(".cell"));
  const cellBySlot = new Map(cells.map(c => [parseInt(c.dataset.slot, 10), c]));
  const selected = new Set(INITIAL);

  // Paint initial selection
  for (const s of selected) cellBySlot.get(s)?.classList.add("selected");

  const readOnly = !EVENT.me;
  if (readOnly) {
    grid.classList.add("disabled");
    return;
  }

  let dragging = false;
  let dragMode = "add";
  let dragStartSlot = -1;
  let currentSlot = -1;
  let rafPending = false;

  const slotOf = (el) => {
    if (!el || !el.classList || !el.classList.contains("cell")) return -1;
    const v = parseInt(el.dataset.slot, 10);
    return Number.isFinite(v) ? v : -1;
  };
  const colOf = (slot) => Math.floor(slot / rows);
  const rowOf = (slot) => slot % rows;

  const rectSlots = (a, b) => {
    const c1 = colOf(a), c2 = colOf(b), r1 = rowOf(a), r2 = rowOf(b);
    const cmin = Math.min(c1, c2), cmax = Math.max(c1, c2);
    const rmin = Math.min(r1, r2), rmax = Math.max(r1, r2);
    const out = [];
    for (let c = cmin; c <= cmax; c++)
      for (let r = rmin; r <= rmax; r++) out.push(c * rows + r);
    return out;
  };

  const clearPreview = () => {
    for (const c of cells) c.classList.remove("preview-add", "preview-remove");
  };

  const renderPreview = () => {
    rafPending = false;
    if (!dragging || currentSlot < 0 || dragStartSlot < 0) return;
    clearPreview();
    const cls = dragMode === "add" ? "preview-add" : "preview-remove";
    for (const s of rectSlots(dragStartSlot, currentSlot)) {
      cellBySlot.get(s)?.classList.add(cls);
    }
  };

  const scheduleRender = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(renderPreview);
  };

  const startDrag = (slot) => {
    dragging = true;
    dragStartSlot = slot;
    currentSlot = slot;
    dragMode = selected.has(slot) ? "remove" : "add";
    scheduleRender();
  };

  const moveDrag = (slot) => {
    if (!dragging || slot < 0 || slot === currentSlot) return;
    currentSlot = slot;
    scheduleRender();
  };

  const commit = () => {
    if (!dragging) return;
    const slots = rectSlots(dragStartSlot, currentSlot);
    for (const s of slots) {
      const c = cellBySlot.get(s);
      if (!c) continue;
      if (dragMode === "add") { selected.add(s); c.classList.add("selected"); }
      else { selected.delete(s); c.classList.remove("selected"); }
    }
    clearPreview();
    dragging = false;
    dragStartSlot = currentSlot = -1;
    save();
  };

  const cancel = () => {
    clearPreview();
    dragging = false;
    dragStartSlot = currentSlot = -1;
  };

  let saveTimer = null;
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch(`/api/event/${EVENT.id}/cells`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          participantId: EVENT.me.id,
          slotIndices: [...selected].sort((a, b) => a - b),
        }),
      }).then(r => {
        if (!r.ok) console.error("save failed", r.status);
        if (window.htmx) window.htmx.trigger("#results", "refresh");
      }).catch(err => console.error("save error", err));
    }, 250);
  }

  // Mouse
  grid.addEventListener("mousedown", (e) => {
    const s = slotOf(e.target);
    if (s < 0) return;
    e.preventDefault();
    startDrag(s);
  });
  grid.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    moveDrag(slotOf(e.target));
  });
  window.addEventListener("mouseup", () => { if (dragging) commit(); });
  document.addEventListener("mouseleave", () => { if (dragging) cancel(); });

  // Touch
  grid.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const s = slotOf(el);
    if (s < 0) return;
    startDrag(s);
  }, { passive: true });
  grid.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    moveDrag(slotOf(document.elementFromPoint(t.clientX, t.clientY)));
  }, { passive: false });
  grid.addEventListener("touchend", () => { if (dragging) commit(); });
  grid.addEventListener("touchcancel", () => { if (dragging) cancel(); });
})();
