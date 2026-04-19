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

  let dragMode = null;
  let touched = new Set();

  const apply = (slot) => {
    if (slot < 0 || touched.has(slot)) return;
    touched.add(slot);
    const c = cellBySlot.get(slot);
    if (!c) return;
    if (dragMode === "add") { selected.add(slot); c.classList.add("selected"); }
    else { selected.delete(slot); c.classList.remove("selected"); }
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
})();
