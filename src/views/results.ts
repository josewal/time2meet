import { escape } from "./layout";
import type { EventRow, ParticipantRow } from "../db/queries";
import {
  computeHeatmap,
  bestSlots,
  participantsAvailableAt,
  type ParticipantCells,
} from "../lib/heatmap";
import {
  deriveDaysAndPerDay,
  heatmapMarkup,
  type EventClientData,
  type HeatmapCell,
} from "./fragments";

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatBestSlot(slot: string): string {
  if (!slot) return "";
  const date = slot.slice(0, 10);
  const time = slot.slice(11);
  const [y, m, d] = date.split("-").map(Number);
  if (y === 1970) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return `${DOW_NAMES[dt.getUTCDay()]} ${time}`;
  }
  return slot;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function results(event: EventRow, participants: ParticipantRow[]): string {
  const slots = event.slots;
  const n = participants.length;

  const pcells: ParticipantCells[] = participants.map((p) => ({
    id: p.id,
    name: p.name,
    slotIndices: p.cells,
  }));

  const counts = computeHeatmap(slots.length, pcells);
  const maxCount = counts.reduce((a, b) => (b > a ? b : a), 0);

  const heatCells: HeatmapCell[] = counts.map((count, i) => ({
    count,
    names: participantsAvailableAt(i, pcells).map((p) => p.name),
  }));

  const { days, slotsPerDay } = deriveDaysAndPerDay(slots);
  const clientData: EventClientData = {
    id: event.id,
    slots,
    slotsPerDay,
    days,
    me: null,
  };

  const heatmapHtml = heatmapMarkup(clientData, heatCells, maxCount, n);

  const participantListHtml =
    n === 0
      ? `<p class="muted">No responses yet — share the link to invite.</p>`
      : `<div class="participant-list">
<strong class="responses-label">${n} ${n === 1 ? "response" : "responses"}:</strong>
${participants
  .map(
    (p) =>
      `<button type="button" class="pill selectable" data-pid="${escape(p.id)}" aria-pressed="false">${escape(p.name)}</button>`,
  )
  .join(" ")}
<button type="button" class="filter-clear" hidden>clear filter</button>
</div>`;

  const top = bestSlots(counts, 5);
  let bestHtml: string;
  if (top.length === 0) {
    bestHtml = `<div class="best-slots"><h3>Best times</h3><p class="muted">No responses yet.</p></div>`;
  } else {
    const items = top
      .map((t) => {
        const slotStr = formatBestSlot(slots[t.slotIndex]);
        const names = participantsAvailableAt(t.slotIndex, pcells)
          .map((a) => escape(a.name))
          .join(", ");
        return `<li data-slot="${t.slotIndex}"><span class="best-slot-time">${escape(slotStr)}</span> &mdash; <strong>${t.count}/${n}</strong> <span class="muted">(${names})</span></li>`;
      })
      .join("");
    bestHtml = `<div class="best-slots"><h3>Best times</h3><ol>${items}</ol></div>`;
  }

  const legendHtml = `<div class="results-legend"${maxCount > 0 ? "" : ' hidden'}>
<span>0</span>
<span class="legend-swatch" style="--intensity:0.25"></span>
<span class="legend-swatch" style="--intensity:0.5"></span>
<span class="legend-swatch" style="--intensity:0.75"></span>
<span class="legend-swatch" style="--intensity:1"></span>
<span class="legend-max">${maxCount}</span>
</div>`;

  const participantsData = participants.map((p) => ({
    id: p.id,
    name: p.name,
    cells: p.cells,
  }));

  const filterScript = n === 0
    ? ""
    : `<script type="application/json" id="results-participants">${safeJson(participantsData)}</script>
<script>
(function(){
  var root = document.getElementById("results-body");
  if (!root) return;
  var dataEl = document.getElementById("results-participants");
  if (!dataEl) return;
  var data;
  try { data = JSON.parse(dataEl.textContent || "[]"); } catch (e) { data = []; }
  var eventId = root.getAttribute("data-event-id") || "";
  var key = "t2m-filter-" + eventId;
  function readFilter(){
    try { return new Set(JSON.parse(sessionStorage.getItem(key) || "[]")); }
    catch(e){ return new Set(); }
  }
  function writeFilter(s){
    try { sessionStorage.setItem(key, JSON.stringify(Array.from(s))); } catch(e){}
  }
  function pruneFilter(filter){
    var ids = new Set(data.map(function(p){ return p.id; }));
    var changed = false;
    Array.from(filter).forEach(function(pid){
      if (!ids.has(pid)) { filter.delete(pid); changed = true; }
    });
    if (changed) writeFilter(filter);
    return filter;
  }
  function apply(){
    var filter = pruneFilter(readFilter());
    var filtering = filter.size > 0;
    var active = filtering ? data.filter(function(p){ return filter.has(p.id); }) : data;
    var total = active.length;
    var counts = Object.create(null);
    var names = Object.create(null);
    active.forEach(function(p){
      (p.cells || []).forEach(function(si){
        counts[si] = (counts[si] || 0) + 1;
        (names[si] = names[si] || []).push(p.name);
      });
    });
    var cells = root.querySelectorAll(".cell.heat");
    var maxCount = 0;
    cells.forEach(function(cell){
      var si = +(cell.getAttribute("data-slot") || 0);
      var c = counts[si] || 0;
      if (c > maxCount) maxCount = c;
    });
    var denom = maxCount > 0 ? maxCount : 1;
    cells.forEach(function(cell){
      var si = +(cell.getAttribute("data-slot") || 0);
      var c = counts[si] || 0;
      cell.setAttribute("data-count", String(c));
      cell.style.setProperty("--intensity", String(c / denom));
      var ns = names[si] || [];
      cell.setAttribute("title", c > 0 ? (c + "/" + total + ": " + ns.join(", ")) : ("0/" + total));
    });
    var legend = root.querySelector(".results-legend");
    if (legend) {
      if (maxCount > 0) legend.removeAttribute("hidden");
      else legend.setAttribute("hidden", "");
      var maxEl = legend.querySelector(".legend-max");
      if (maxEl) maxEl.textContent = String(maxCount);
    }
    root.querySelectorAll(".pill.selectable").forEach(function(btn){
      var id = btn.getAttribute("data-pid");
      var on = filter.has(id);
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var label = root.querySelector(".responses-label");
    if (label) {
      if (filtering) {
        label.textContent = "Showing " + filter.size + " of " + data.length + ":";
      } else {
        label.textContent = data.length + " " + (data.length === 1 ? "response" : "responses") + ":";
      }
    }
    var clearBtn = root.querySelector(".filter-clear");
    if (clearBtn) {
      if (filtering) clearBtn.removeAttribute("hidden");
      else clearBtn.setAttribute("hidden", "");
    }
    var best = root.querySelector(".best-slots");
    if (best) best.style.display = filtering ? "none" : "";
  }
  root.querySelectorAll(".pill.selectable").forEach(function(btn){
    btn.addEventListener("click", function(){
      var pid = btn.getAttribute("data-pid");
      if (!pid) return;
      var filter = readFilter();
      if (filter.has(pid)) filter.delete(pid); else filter.add(pid);
      writeFilter(filter);
      apply();
    });
  });
  var clearBtn = root.querySelector(".filter-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", function(){
      writeFilter(new Set());
      apply();
    });
  }
  var grid = root.querySelector(".grid.heatmap");
  var rows = grid ? parseInt(grid.getAttribute("data-rows") || "0", 10) : 0;
  var headers = grid ? grid.querySelectorAll(".grid-day-header") : [];
  var labels = grid ? grid.querySelectorAll(".grid-time-label") : [];
  root.querySelectorAll(".best-slots li[data-slot]").forEach(function(li){
    var si = parseInt(li.getAttribute("data-slot") || "-1", 10);
    if (!(si >= 0)) return;
    var col = rows > 0 ? Math.floor(si / rows) : -1;
    var row = rows > 0 ? si % rows : -1;
    li.addEventListener("mouseenter", function(){
      if (headers[col]) headers[col].classList.add("axis-hover");
      if (labels[row]) labels[row].classList.add("axis-hover");
    });
    li.addEventListener("mouseleave", function(){
      if (headers[col]) headers[col].classList.remove("axis-hover");
      if (labels[row]) labels[row].classList.remove("axis-hover");
    });
  });
  apply();
})();
</script>`;

  return `<div id="results-body" data-event-id="${escape(event.id)}">
${participantListHtml}
${heatmapHtml}
${legendHtml}
${bestHtml}
${filterScript}
</div>`;
}
