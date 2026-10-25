'use strict';
window.mayflyBitmapText = (() => {
  const font = window.MAYFLY_BITSY_FONT;
  function draw(canvas, value) {
    const characters = Array.from(value.normalize('NFC').replace(/\s*\n\s*/g, ' '));
    canvas.width = Math.max(1, characters.length * font.width);
    canvas.height = font.height;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(canvas.width, canvas.height);
    characters.forEach((character, index) => {
      const rows = font.glyphs[character.codePointAt(0)] || font.glyphs[0];
      for (let y = 0; y < font.height; y++) {
        for (let x = 0; x < font.width; x++) {
          if ((rows[y] >>> (font.width - 1 - x)) & 1) {
            const offset = (y * canvas.width + index * font.width + x) * 4;
            pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = pixels.data[offset + 3] = 255;
          }
        }
      }
    });
    context.putImageData(pixels, 0, 0);
  }
  const title = document.getElementById('title-pixels');
  if (title) draw(title, document.getElementById('site-title').getAttribute('aria-label'));
  return { draw };
})();
