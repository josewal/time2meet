(() => {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".copy-btn");
    if (!btn) return;
    const text = btn.dataset.copy || "";
    const done = () => {
      btn.classList.add("copied");
      setTimeout(() => {
        btn.classList.remove("copied");
      }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else {
      fallback();
    }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch {}
      document.body.removeChild(ta);
    }
  });
})();
