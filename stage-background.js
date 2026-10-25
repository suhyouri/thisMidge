'use strict';
(() => {
  const paper = document.getElementById('paper');
  const canvas = document.getElementById('stage-background');
  const PIXEL_SIZE = 4;
  const BAND_WIDTH = 128; // Dither only this narrow band around each ring edge.
  const radii = [750, 1500, 2250];
  const shades = [0, 85, 170, 255];
  const bayer8 = [
     0,32, 8,40, 2,34,10,42,
    48,16,56,24,50,18,58,26,
    12,44, 4,36,14,46, 6,38,
    60,28,52,20,62,30,54,22,
     3,35,11,43, 1,33, 9,41,
    51,19,59,27,49,17,57,25,
    15,47, 7,39,13,45, 5,37,
    63,31,55,23,61,29,53,21,
  ];
  const width = paper.offsetWidth, height = paper.offsetHeight;
  canvas.width = Math.ceil(width / PIXEL_SIZE);
  canvas.height = Math.ceil(height / PIXEL_SIZE);
  const context = canvas.getContext('2d');
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const radius = Math.hypot((x + .5) * PIXEL_SIZE - width / 2, (y + .5) * PIXEL_SIZE - height / 2);
      let shade = shades[3];
      for (let stage = 0; stage < radii.length; stage++) {
        const start = radii[stage] - BAND_WIDTH / 2;
        if (radius < start) { shade = shades[stage]; break; }
        if (radius < start + BAND_WIDTH) {
          const mix = (radius - start) / BAND_WIDTH;
          const threshold = (bayer8[(y % 8) * 8 + x % 8] + .5) / 64;
          shade = shades[stage + Number(mix > threshold)];
          break;
        }
      }
      const i = (y * canvas.width + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = shade;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
})();
