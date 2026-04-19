(() => {
  const state = new WeakMap();

  const clearGrid = (grid) => {
    const s = state.get(grid);
    if (!s) return;
    if (s.col >= 0) s.headers[s.col]?.classList.remove("axis-hover");
    if (s.row >= 0) s.labels[s.row]?.classList.remove("axis-hover");
    s.col = s.row = -1;
  };

  const stateFor = (grid) => {
    let s = state.get(grid);
    if (!s) {
      s = {
        rows: parseInt(grid.dataset.rows, 10) || 0,
        headers: Array.from(grid.querySelectorAll(".grid-day-header")),
        labels: Array.from(grid.querySelectorAll(".grid-time-label")),
        col: -1,
        row: -1,
      };
      state.set(grid, s);
    }
    return s;
  };

  document.addEventListener("mouseover", (e) => {
    const cell = e.target?.closest?.(".cell");
    const grid = cell?.closest?.(".grid");
    if (!cell || !grid) return;
    const s = stateFor(grid);
    if (!s.rows) return;
    const slot = parseInt(cell.dataset.slot, 10);
    if (!Number.isFinite(slot)) return;
    const col = Math.floor(slot / s.rows);
    const row = slot % s.rows;
    if (col === s.col && row === s.row) return;
    if (s.col >= 0) s.headers[s.col]?.classList.remove("axis-hover");
    if (s.row >= 0) s.labels[s.row]?.classList.remove("axis-hover");
    s.col = col;
    s.row = row;
    s.headers[col]?.classList.add("axis-hover");
    s.labels[row]?.classList.add("axis-hover");
  });

  document.addEventListener("mouseout", (e) => {
    const grid = e.target?.closest?.(".grid");
    if (!grid) return;
    const related = e.relatedTarget;
    if (related && grid.contains(related)) return;
    clearGrid(grid);
  });
})();
