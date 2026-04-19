export function landing(): string {
  return `<main class="landing">
  <section class="hero">
    <h1>time2meet</h1>
    <p class="subtitle">pick possible times. share the link. see when everyone's free.</p>
  </section>
  <form class="create-event" hx-post="/events" hx-swap="none">
    <label>
      <span>Event title</span>
      <input type="text" name="title" required maxlength="200" placeholder="Team sync" />
    </label>
    <div class="field">
      <span class="field-label">Dates</span>
      <div class="datepicker" data-target="dates-input">
        <div class="dp-topbar">
          <label class="dp-mode-label">
            <span>Survey using</span>
            <select class="dp-mode">
              <option value="specific" selected>Specific Dates</option>
              <option value="dow">Days of the Week</option>
            </select>
          </label>
        </div>
        <div class="dp-specific-wrap">
          <div class="dp-weekdays">
            <span></span>
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            <span></span>
          </div>
          <div class="dp-spec-grid"></div>
          <div class="dp-controls">
            <button type="button" class="dp-earlier secondary">&larr; earlier</button>
            <button type="button" class="dp-today secondary">Today</button>
            <button type="button" class="dp-later secondary">later &rarr;</button>
          </div>
        </div>
        <div class="dp-dow-wrap">
          <p class="muted dp-dow-hint">Pick any weekdays. The grid will show one column per selected day, with no specific date.</p>
          <div class="dp-dow-grid"></div>
        </div>
        <div class="dp-summary muted">no dates selected</div>
      </div>
      <input type="hidden" name="dates" id="dates-input" required />
    </div>
    <div class="row">
      <label>
        <span>Start time</span>
        <input type="time" name="startTime" value="09:00" required />
      </label>
      <label>
        <span>End time</span>
        <input type="time" name="endTime" value="17:00" required />
      </label>
      <label>
        <span>Slot size</span>
        <select name="slotMinutes">
          <option value="15">15 min</option>
          <option value="30" selected>30 min</option>
          <option value="60">60 min</option>
        </select>
      </label>
    </div>
    <button type="submit">Create event</button>
    <div id="create-error" class="error-slot"></div>
  </form>
  <script src="/datepicker.js" defer></script>
  <footer class="landing-footer">
    <small>URL is the secret. Share the link to invite.</small>
  </footer>
</main>`;
}
