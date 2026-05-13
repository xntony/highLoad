// Floating particle generator for welcome page

(function() {
  const container = document.getElementById('particles');
  if (!container) return;
  const COUNT = 28;
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --dur: ${Math.random() * 8 + 6}s;
      --delay: ${Math.random() * 6}s;
    `;
    container.appendChild(p);
  }
})();
