'use strict';
// Paper coordinates are independent of screen size. The camera follows the insect.
const WORLD = Object.freeze({ width: 8000, height: 6000 });
const ROTATION_SPEED = 60; // degrees per second
const pressedKeys = new Set();
const SPEED = 22; // pixels per second
const ACCELERATION_TIME = 0.45; // seconds to build speed
const COAST_TIME = 1.1; // larger values give a longer glide after release
const TURN_ACCELERATION_TIME = 0.18;
const TURN_COAST_TIME = 0.3;
const viewport = document.getElementById('viewport');
const paper = document.getElementById('paper');
const mayfly = document.getElementById('mayfly');
const flight = { x: WORLD.width / 2, y: WORLD.height / 2, elapsed: 0, angle: 0, vx: 0, vy: 0, angularVelocity: 0 };
let lastTime = null;
function render() {
  window.mayflyLife.position(flight.x, flight.y);
  // Keep the insect centered; reveal the paper's edges only near its boundaries.
  const cameraX = Math.max(0, Math.min(WORLD.width - viewport.clientWidth, flight.x - viewport.clientWidth / 2));
  const cameraY = Math.max(0, Math.min(WORLD.height - viewport.clientHeight, flight.y - viewport.clientHeight / 2));
  paper.style.transform = `translate3d(${-cameraX}px, ${-cameraY}px, 0)`;
  mayfly.style.transform = `translate3d(${flight.x - 32}px, ${flight.y - 32}px, 0) rotate(${flight.angle}deg)`;
}
function animate(time) {
  const elapsed = lastTime === null ? 0 : Math.max(0, (time - lastTime) / 1000);
  const dt = Math.min(elapsed, 0.05);
  lastTime = time;
  if (!document.hidden && !window.mayflyWorld.paused && window.mayflyLife.update(elapsed)) {
    pressedKeys.clear();
    window.mayflyWorld.wrap(() => {
      flight.x = WORLD.width / 2;
      flight.y = WORLD.height / 2;
      flight.angle = 0;
      flight.vx = flight.vy = flight.angularVelocity = 0;
      flight.elapsed = 0;
      window.mayflyLife.reset();
    }, () => window.mayflyLife.showRespawn());
  }
  if (!document.hidden && !window.mayflyWorld.paused) {
    // Mirrored wheels: positive values mean forward propulsion on that side.
    // Left wheel: ← forward, ↑ backward. Right wheel: → forward, ↓ backward.
    // Opposing directions on the same wheel cancel before mixing the wheels.
    const wheels = window.mayflyController?.sample() || { left: 0, right: 0 };
    const clamp = value => Math.max(-1, Math.min(1, value));
    const leftWheel = clamp(Number(pressedKeys.has('ArrowLeft')) - Number(pressedKeys.has('ArrowUp')) + wheels.left);
    const rightWheel = clamp(Number(pressedKeys.has('ArrowRight')) - Number(pressedKeys.has('ArrowDown')) + wheels.right);
    const thrust = (leftWheel + rightWheel) / 2;
    const direction = (rightWheel - leftWheel) / 2;
    const turnResponse = 1 - Math.exp(-dt / (direction ? TURN_ACCELERATION_TIME : TURN_COAST_TIME));
    flight.angularVelocity += (direction * ROTATION_SPEED - flight.angularVelocity) * turnResponse;
    if (!direction && Math.abs(flight.angularVelocity) < 0.1) flight.angularVelocity = 0;
    flight.angle = (flight.angle + flight.angularVelocity * dt) % 360;
    flight.elapsed += dt;
    // Inertia stays in world coordinates, so turning while coasting does not
    // abruptly redirect momentum. Active thrust gradually bends the course.
    const heading = (flight.angle - 135) * Math.PI / 180;
    const response = 1 - Math.exp(-dt / (thrust ? ACCELERATION_TIME : COAST_TIME));
    flight.vx += (Math.cos(heading) * SPEED * thrust - flight.vx) * response;
    flight.vy += (Math.sin(heading) * SPEED * thrust - flight.vy) * response;
    if (!thrust && Math.hypot(flight.vx, flight.vy) < 0.15) {
      flight.vx = 0;
      flight.vy = 0;
    }
    const wind = window.mayflyWind.update(dt);
    flight.x += (flight.vx + wind.x) * dt;
    flight.y += (flight.vy + wind.y) * dt;
    // Wrap when the rotated image touches any paper edge. Keep momentum.
    const radians=flight.angle*Math.PI/180;
    const halfWidth=Math.abs(Math.cos(radians))*32+Math.abs(Math.sin(radians))*32;
    const halfHeight=Math.abs(Math.sin(radians))*32+Math.abs(Math.cos(radians))*32;
    const crossLeft=flight.x<=halfWidth, crossRight=flight.x>=WORLD.width-halfWidth;
    const crossTop=flight.y<=halfHeight, crossBottom=flight.y>=WORLD.height-halfHeight;
    if(crossLeft||crossRight||crossTop||crossBottom) {
      window.mayflyWorld.wrap(()=>{
        if(crossLeft) flight.x=WORLD.width-halfWidth-1;
        else if(crossRight) flight.x=halfWidth+1;
        if(crossTop) flight.y=WORLD.height-halfHeight-1;
        else if(crossBottom) flight.y=halfHeight+1;
      });
    }
  }
  if(!document.hidden) window.mayflyWorld.update(dt,flight.x,flight.y);

  render();
  requestAnimationFrame(animate);
}
window.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  event.preventDefault();
  if(window.mayflyAdmin?.paused)return;
  if(window.mayflyHome?.waiting)window.mayflyHome.start();
  if (!window.mayflyWorld.paused) pressedKeys.add(event.key);
});
window.addEventListener('keyup', event => pressedKeys.delete(event.key));
window.addEventListener('blur', () => pressedKeys.clear());
window.addEventListener('mayfly-dialogue', () => { pressedKeys.clear(); lastTime = null; });
window.addEventListener('mayfly-minigame-state', () => { pressedKeys.clear(); lastTime = null; });
window.addEventListener('mayfly-admin-state', () => { pressedKeys.clear(); lastTime = null; });
document.addEventListener('visibilitychange', () => {
  lastTime = null;
  if (document.hidden) pressedKeys.clear();
});
window.addEventListener('mayfly-home-state',()=>{
  pressedKeys.clear();lastTime=null;
  if(window.mayflyHome.waiting) {
    flight.x=WORLD.width/2;flight.y=WORLD.height/2;flight.angle=0;
    flight.vx=flight.vy=flight.angularVelocity=flight.elapsed=0;
    render();
  }
});
window.addEventListener('resize', render);
render();
requestAnimationFrame(animate);
