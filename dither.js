'use strict';
// Reduce the drawing to 13 × 16 cells before dithering; each cell stays 4.5px.
// Transparent pixels
// reveal the white paper; every visible pixel uses the reference's pink.
(() => {
  const sprite = document.getElementById('sprite');
  const output = sprite.getContext('2d');
  const sample = document.createElement('canvas');
  sample.width = sprite.width;
  sample.height = sprite.height;
  const sampler = sample.getContext('2d', { willReadFrequently: true });
  const source = document.createElement('canvas');
  source.width = 64;
  source.height = 80;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previous = -1;
  function path(points, fill, stroke, width = 1) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function wing(side, fold) {
    ctx.save();
    ctx.translate(32, 30);
    ctx.scale(side * fold, 1);
    path([[0,0],[-7,-11],[-17,-25],[-24,-28],[-27,-24],[-25,-13],[-19,-3],[-9,2]], '#777', '#222', .7);
    path([[0,1],[-14,-1],[-22,2],[-23,6],[-17,9],[-7,8]], '#999', '#444', .65);
    for (const tip of [[-24,-26],[-26,-18],[-22,-10],[-17,-3],[-21,5],[-13,8]]) {
      path([[0,0],tip], null, '#333', .55);
    }
    path([[-22,-23],[-20,-15],[-14,-17],[-14,-8],[-8,-9],[-7,-1]],null,'#555',.55);
    path([[-25,-16],[-19,-12],[-18,-5],[-11,-4]],null,'#555',.45);
    ctx.restore();
  }
  function draw(time) {
    const frame = reduced.matches ? 0 : Math.floor(time / 110);
    if (frame !== previous) {
      previous = frame;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 64, 80);
      ctx.save();
      // Rotate before dithering to keep square pixels aligned to the screen.
      ctx.translate(32, 40);
      ctx.rotate(-Math.PI / 4);
      ctx.scale(.86, .86);
      ctx.translate(-32, -38);
      const fold = [.98, .82, .65, .82][frame % 4];
      wing(-1, fold); wing(1, fold);
      for (const side of [-1, 1]) {
        path([[32,28],[32+side*7,24],[32+side*10,17]],null,'#222',.8);
        path([[32,31],[32+side*7,35],[32+side*11,34]],null,'#333',.8);
        path([[32,33],[32+side*6,40],[32+side*8,46]],null,'#333',.8);
        path([[32+side,25],[32+side*4,18],[32+side*4,14]],null,'#333',.65);
      }
      path([[30,29],[34,29],[34,39],[32,51],[30,39]],'#222',null);
      ctx.fillStyle='#111';ctx.fillRect(30,24,4,7);
      ctx.fillRect(30,21,4,3);
      for(let y=35;y<48;y+=3){path([[30,y],[34,y]],null,'#aaa',.7);}
      path([[31,49],[28,63],[24,74]],null,'#333',.8);
      path([[32,49],[32,77]],null,'#333',.7);
      path([[33,49],[36,63],[40,74]],null,'#333',.8);
      ctx.restore();
      const width = sprite.width, height = sprite.height;
      sampler.drawImage(source, 0, 0, width, height);
      const pixels = sampler.getImageData(0, 0, width, height);
      const result = output.createImageData(width, height);
      for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
        const i=(y*width+x)*4;
        const ink=1-pixels.data[i]/255;
        if(ink>0 && ink>(matrix[(y%4)*4+x%4]+.5)/16) {
          result.data[i]=255;result.data[i+1]=132;result.data[i+2]=211;result.data[i+3]=255;
        }
      }
      output.putImageData(result,0,0);
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
