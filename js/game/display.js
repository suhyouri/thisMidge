'use strict';
// Keep the game in a 1024 × 600 logical LCD viewport, including every overlay.
(() => {
  const WIDTH = 1024, HEIGHT = 600;
  const frame = document.getElementById('display-frame');
  const screen = document.getElementById('screen');
  function fit() {
    const scale = Math.min(1, document.documentElement.clientWidth / WIDTH, innerHeight / HEIGHT);
    frame.style.width = `${WIDTH * scale}px`;
    frame.style.height = `${HEIGHT * scale}px`;
    screen.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', fit);
  fit();
})();
