'use strict';
// The Arduino sends cumulative shaft angles at 50 Hz. Only their differences
// propel the game; holding a wheel at a nonzero angle must not hold an input.
window.MayflyWheelMotion = class {
  constructor() {
    this.lastAngles = null;
    this.lastReceived = -Infinity;
    this.history = [];
    this.leftSign = 1;
    this.rightSign = 1;
    this.fullSpeed = 180; // degrees/second for full propulsion
  }
  reset() {
    this.lastAngles = null;
    this.history = [];
    this.lastReceived = -Infinity;
  }
  receive(line, now) {
    if (!/^\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*$/.test(line)) return false;
    const angles = line.split(',').map(Number);
    if (!angles.every(Number.isFinite)) return false;
    const previous = this.lastAngles;
    const stale = now - this.lastReceived > 160;
    this.lastAngles = angles;
    this.lastReceived = now;
    // Both zero is also the physical reset button's reference packet.
    if (!previous || stale || (angles[0] === 0 && angles[1] === 0)) {
      this.history = [];
      return true;
    }
    const delta = angles.map((angle, i) => angle - previous[i]);
    // Ignore implausible jumps, including an unexpected board reset.
    if (delta.some(value => Math.abs(value) > 180)) {
      this.history = [];
      return true;
    }
    this.history.push(delta);
    if (this.history.length > 4) this.history.shift();
    return true;
  }
  sample(now) {
    if (now - this.lastReceived > 160 || !this.history.length) return { left: 0, right: 0 };
    const average = index => this.history.reduce((sum, delta) => sum + delta[index], 0) / this.history.length;
    const clamp = value => Math.max(-1, Math.min(1, value));
    return {
      left: clamp(average(0) / .02 / this.fullSpeed * this.leftSign),
      right: clamp(average(1) / .02 / this.fullSpeed * this.rightSign),
    };
  }
};
