(() => {
  const dp = document.querySelector(".datepicker");
  if (!dp) return;
  const hidden = document.getElementById(dp.dataset.target);
  if (!hidden) return;

  const modeSel = dp.querySelector(".dp-mode");
  const specGrid = dp.querySelector(".dp-spec-grid");
  const dowGrid = dp.querySelector(".dp-dow-grid");
  const summaryEl = dp.querySelector(".dp-summary");
  const todayBtn = dp.querySelector(".dp-today");
  const earlierBtn = dp.querySelector(".dp-earlier");
  const laterBtn = dp.querySelector(".dp-later");

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const WEEKS_PER_VIEW = 6;
  const DOW_SENTINEL_DAYS = ["1970-01-04","1970-01-05","1970-01-06","1970-01-07","1970-01-08","1970-01-09","1970-01-10"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = (d) => { const r = new Date(d); r.setDate(d.getDate() - d.getDay()); r.setHours(0,0,0,0); return r; };
  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  let mode = "specific";
  let viewStart = startOfWeek(today);
  const selectedDates = new Set();
  const selectedDows = new Set();

  const computeDowDates = () => {
    return [...selectedDows].sort((a, b) => a - b).map((dow) => DOW_SENTINEL_DAYS[dow]);
  };

  const sync = () => {
    const dates = mode === "specific" ? [...selectedDates].sort() : computeDowDates();
    hidden.value = dates.join(",");
    if (dates.length === 0) {
      summaryEl.textContent = mode === "specific" ? "no dates selected" : "no days selected";
    } else if (mode === "specific") {
      summaryEl.textContent = `${dates.length} date${dates.length === 1 ? "" : "s"} selected`;
    } else {
      summaryEl.textContent = `${dates.length} day${dates.length === 1 ? "" : "s"} selected`;
    }
  };

  const renderSpecific = () => {
    specGrid.innerHTML = "";
    for (let w = 0; w < WEEKS_PER_VIEW; w++) {
      const weekStart = new Date(viewStart);
      weekStart.setDate(viewStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const label = MONTHS[weekStart.getMonth()] === MONTHS[weekEnd.getMonth()]
        ? MONTHS[weekStart.getMonth()]
        : `${MONTHS[weekStart.getMonth()]}/${MONTHS[weekEnd.getMonth()]}`;

      const labelEl = document.createElement("div");
      labelEl.className = "dp-week-label";
      labelEl.textContent = label;
      specGrid.appendChild(labelEl);

      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const key = ymd(d);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dp-day";
        btn.dataset.date = key;
        btn.textContent = String(d.getDate());
        if (d < today) btn.classList.add("past");
        if (selectedDates.has(key)) btn.classList.add("selected");
        specGrid.appendChild(btn);
      }

      const yrEl = document.createElement("div");
      yrEl.className = "dp-week-year";
      yrEl.textContent = String(weekStart.getFullYear());
      specGrid.appendChild(yrEl);
    }
  };

  const renderDow = () => {
    dowGrid.innerHTML = "";
    const names = ["S","M","T","W","T","F","S"];
    for (let i = 0; i < 7; i++) {
      const col = document.createElement("button");
      col.type = "button";
      col.className = "dp-dow-col";
      col.dataset.dow = String(i);
      col.innerHTML = `<span class="dp-dow-letter">${names[i]}</span>`;
      if (selectedDows.has(i)) col.classList.add("selected");
      dowGrid.appendChild(col);
    }
  };

  let dragMode = null;
  let touched = new Set();
  const applyDay = (cell) => {
    if (!cell || !cell.classList.contains("dp-day") || cell.classList.contains("past")) return;
    const key = cell.dataset.date;
    if (touched.has(key)) return;
    touched.add(key);
    if (dragMode === "add") { selectedDates.add(key); cell.classList.add("selected"); }
    else { selectedDates.delete(key); cell.classList.remove("selected"); }
  };

  specGrid.addEventListener("mousedown", (e) => {
    const c = e.target.closest(".dp-day");
    if (!c || c.classList.contains("past")) return;
    e.preventDefault();
    dragMode = selectedDates.has(c.dataset.date) ? "remove" : "add";
    touched = new Set();
    applyDay(c); sync();
  });
  specGrid.addEventListener("mousemove", (e) => {
    if (!dragMode) return;
    applyDay(e.target.closest(".dp-day")); sync();
  });
  window.addEventListener("mouseup", () => { if (dragMode) { dragMode = null; sync(); } });

  specGrid.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    const c = document.elementFromPoint(t.clientX, t.clientY)?.closest(".dp-day");
    if (!c || c.classList.contains("past")) return;
    e.preventDefault();
    dragMode = selectedDates.has(c.dataset.date) ? "remove" : "add";
    touched = new Set();
    applyDay(c); sync();
  }, { passive: false });
  specGrid.addEventListener("touchmove", (e) => {
    if (!dragMode) return;
    e.preventDefault();
    const t = e.touches[0];
    applyDay(document.elementFromPoint(t.clientX, t.clientY)?.closest(".dp-day"));
    sync();
  }, { passive: false });
  specGrid.addEventListener("touchend", () => { if (dragMode) { dragMode = null; sync(); } });

  dowGrid.addEventListener("click", (e) => {
    const col = e.target.closest(".dp-dow-col");
    if (!col) return;
    const n = parseInt(col.dataset.dow, 10);
    if (selectedDows.has(n)) { selectedDows.delete(n); col.classList.remove("selected"); }
    else { selectedDows.add(n); col.classList.add("selected"); }
    sync();
  });

  modeSel.addEventListener("change", () => {
    mode = modeSel.value;
    dp.classList.toggle("mode-specific", mode === "specific");
    dp.classList.toggle("mode-dow", mode === "dow");
    sync();
  });

  todayBtn.addEventListener("click", () => { viewStart = startOfWeek(today); renderSpecific(); });
  earlierBtn.addEventListener("click", () => { viewStart.setDate(viewStart.getDate() - 14); renderSpecific(); });
  laterBtn.addEventListener("click", () => { viewStart.setDate(viewStart.getDate() + 14); renderSpecific(); });

  dp.classList.add("mode-specific");
  renderSpecific();
  renderDow();
  sync();
})();
