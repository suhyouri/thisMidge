'use strict';
window.mayflyController = (() => {
  const motion = new window.MayflyWheelMotion();
  const panel = document.createElement('details');
  panel.id = 'wheel-controller';
  panel.innerHTML = `
    <summary>휠 연결</summary>
    <div class="wheel-settings">
      <button type="button" id="wheel-connect">Arduino 연결</button>
      <p id="wheel-status" role="status">USB로 연결한 Arduino를 선택하세요.</p>
      <p id="wheel-angles">왼쪽 —° · 오른쪽 —°</p>
      <label><input id="wheel-left-reverse" type="checkbox"> 왼쪽 방향 반전</label>
      <label><input id="wheel-right-reverse" type="checkbox"> 오른쪽 방향 반전</label>
      <label>감도 <select id="wheel-sensitivity">
        <option value="360">낮게</option><option value="180" selected>보통</option><option value="90">높게</option>
      </select></label>
      <p class="wheel-help">양쪽을 바깥으로 돌렸을 때 전진하도록 방향을 맞추세요. 시리얼 모니터는 닫아 주세요.</p>
    </div>`;
  document.getElementById('screen').append(panel);
  const button = panel.querySelector('#wheel-connect');
  const status = panel.querySelector('#wheel-status');
  const angleDisplay = panel.querySelector('#wheel-angles');
  const leftReverse = panel.querySelector('#wheel-left-reverse');
  const rightReverse = panel.querySelector('#wheel-right-reverse');
  const sensitivity = panel.querySelector('#wheel-sensitivity');
  let port = null, reader = null, readTask = null, busy = false, stopping = false;
  let lastUi = -Infinity, hasData = false;
  try {
    const saved = JSON.parse(localStorage.getItem('mayfly-wheel-settings') || 'null');
    if (saved) {
      leftReverse.checked = saved.leftReverse === true;
      rightReverse.checked = saved.rightReverse === true;
      if (['90', '180', '360'].includes(saved.sensitivity)) sensitivity.value = saved.sensitivity;
    }
  } catch { /* Storage may be disabled. */ }
  function applySettings() {
    motion.leftSign = leftReverse.checked ? -1 : 1;
    motion.rightSign = rightReverse.checked ? -1 : 1;
    motion.fullSpeed = Number(sensitivity.value);
    motion.reset();
  }
  applySettings();
  [leftReverse, rightReverse, sensitivity].forEach(control => control.addEventListener('change', () => {
    applySettings();
    try {
      localStorage.setItem('mayfly-wheel-settings', JSON.stringify({
        leftReverse: leftReverse.checked, rightReverse: rightReverse.checked, sensitivity: sensitivity.value,
      }));
    } catch { /* Input still works without persisted settings. */ }
  }));
  function blocked() { return document.hidden || !!window.mayflyAdmin?.paused; }
  function sample() { return blocked() ? { left: 0, right: 0 } : motion.sample(performance.now()); }
  async function read(selectedPort) {
    const decoder = new TextDecoder();
    let pending = '', discarding = false;
    let ending = '연결이 해제되었습니다.';
    try {
      reader = selectedPort.readable.getReader();
      while (!stopping) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline).trim();
          pending = pending.slice(newline + 1);
          if (discarding) { discarding = false; continue; }
          if (line.length > 96) continue;
          if (motion.receive(line, performance.now())) {
            hasData = true;
            if (blocked()) motion.reset();
          }
        }
        // Drop an overlong frame through its next newline, not just its prefix.
        if (pending.length > 96) { pending = ''; discarding = true; }
      }
    } catch (error) {
      if (!stopping) ending = '수신이 중단되었습니다. USB와 연결 속도를 확인하고 다시 연결하세요.';
    } finally {
      reader?.releaseLock();
      reader = null;
      try { await selectedPort.close(); }
      catch { ending = '포트를 닫지 못했습니다. USB를 다시 연결해 주세요.'; }
      port = null;
      motion.reset();
      hasData = false;
      button.textContent = 'Arduino 연결';
      panel.querySelector('summary').textContent = '휠 연결';
      angleDisplay.textContent = '왼쪽 —° · 오른쪽 —°';
      status.textContent = ending;
    }
  }
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true; button.disabled = true;
    try {
      if (port) {
        stopping = true;
        try { await reader?.cancel(); } finally { await readTask; }
      } else {
        const selectedPort = await navigator.serial.requestPort();
        await selectedPort.open({ baudRate: 115200 });
        port = selectedPort;
        stopping = false; hasData = false; motion.reset();
        button.textContent = '연결 해제';
        status.textContent = '연결됨 · Arduino의 첫 데이터를 기다립니다.';
        panel.querySelector('summary').textContent = '휠 연결됨';
        readTask = read(selectedPort);
      }
    } catch (error) {
      status.textContent = error.name === 'NotFoundError'
        ? '기기를 선택하지 않았습니다. 다시 연결할 수 있습니다.'
        : '연결할 수 없습니다. 시리얼 모니터·다른 게임 창을 닫고 USB 연결을 확인하세요.';
    } finally { busy = false; button.disabled = false; }
  });
  if (!window.isSecureContext || !('serial' in navigator)) {
    button.disabled = true;
    status.textContent = 'Chrome 또는 Edge에서 localhost 주소로 실행해 주세요.';
  }
  for (const type of ['mayfly-home-state', 'mayfly-dialogue', 'mayfly-minigame-state', 'mayfly-admin-state']) {
    window.addEventListener(type, () => motion.reset());
  }
  document.addEventListener('visibilitychange', () => motion.reset());
  function tick(now) {
    const wheels = sample();
    if (window.mayflyHome?.waiting && (wheels.left || wheels.right)) window.mayflyHome.start();
    if (window.mayflyMinigame?.active) {
      document.getElementById('minigame-frame').contentWindow.postMessage({ type: 'mayfly-wheel-input', ...wheels }, '*');
    }
    if (port && now - lastUi >= 200) {
      lastUi = now;
      if (motion.lastAngles) angleDisplay.textContent = `왼쪽 ${motion.lastAngles[0].toFixed(1)}° · 오른쪽 ${motion.lastAngles[1].toFixed(1)}°`;
      status.textContent = now - motion.lastReceived <= 1000
        ? '연결됨 · 휠을 돌려 조작하세요.'
        : hasData ? '데이터 수신이 멈췄습니다. USB 연결을 확인하세요.' : '연결됨 · 115200 baud 데이터를 기다립니다.';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return { sample, get connected() { return port !== null; } };
})();
