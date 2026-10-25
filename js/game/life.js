'use strict';
window.mayflyLife = (() => {
  const initialSeconds=()=>window.mayflySettings?.lifeSeconds??60;
  const TRIGGER_BONUS = 5;
  const hud = document.getElementById('life-hud');
  const canvas = document.getElementById('life-pixels');
  const effects = document.getElementById('life-effects');
  let remaining = initialSeconds(), elapsed = 0;
  function render() {
    const text = `남은시간: ${remaining}초`;
    hud.setAttribute('aria-label', text);
    window.mayflyBitmapText.draw(canvas, text);
  }
  function showBonus() {
    const bonus = document.createElement('canvas');
    bonus.className = 'life-bonus';
    window.mayflyBitmapText.draw(bonus, '+5');
    const context = bonus.getContext('2d');
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = '#ffe34d';
    context.fillRect(0, 0, bonus.width, bonus.height);
    effects.append(bonus);
    bonus.addEventListener('animationend', () => bonus.remove(), { once: true });
    setTimeout(() => bonus.remove(), 1500);
  }
  function showRespawn() {
    effects.querySelectorAll('.respawn-message').forEach(message=>message.remove());
    const message=document.createElement('canvas');
    message.className='respawn-message';
    window.mayflyBitmapText.draw(message,'다시 처음으로 돌아왔다.');
    effects.append(message);
    setTimeout(()=>message.remove(),5000);
  }
  function reset() {
    remaining = initialSeconds(); elapsed = 0;
    effects.replaceChildren();
    render();
  }
  window.addEventListener('mayfly-story-read', () => {
    remaining += TRIGGER_BONUS;
    render();
    showBonus();
  });
  render();
  return {
    get remaining() { return remaining; },
    reset,
    setRemaining(value) {
      if(!Number.isInteger(value)||value<0||value>86400)throw Error('0~86400 사이의 정수 초를 입력해 주세요.');
      remaining=value;elapsed=0;render();
    },
    showRespawn,
    position(x, y) {
      effects.style.transform = `translate3d(${x + 40}px, ${y - 24}px, 0)`;
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return remaining === 0;
      elapsed += dt;
      const seconds = Math.floor(elapsed + 1e-9);
      if (seconds > 0) {
        elapsed = Math.max(0, elapsed - seconds);
        remaining = Math.max(0, remaining - seconds);
        render();
      }
      return remaining === 0;
    },
  };
})();
