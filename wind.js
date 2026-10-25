'use strict';
window.mayflyWind = (() => {
  const state = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const button = document.getElementById('wind-connect');
  const status = document.getElementById('wind-status');
  function label(text) {
    button.setAttribute('aria-label', text);
    button.title = text;
  }
  const REFRESH = 10 * 60 * 1000;
  const MAX_AGE = 30 * 60 * 1000;
  let location = null, lastSuccess = 0, pending = false;
  function vector(speed, fromDegrees) {
    // Meteorological direction is where wind comes FROM. Screen north is -Y.
    const radians = fromDegrees * Math.PI / 180;
    const drift = Math.min(12, speed * 2);
    return { x: -Math.sin(radians) * drift, y: Math.cos(radians) * drift };
  }
  async function refresh() {
    if (!location || pending) return;
    pending = true;
    button.disabled = true;
    try {
      const params = new URLSearchParams({
        latitude: location.latitude, longitude: location.longitude,
        current: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'ms', timeformat: 'unixtime',
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('weather');
      const { current } = await response.json();
      const speed = current?.wind_speed_10m, direction = current?.wind_direction_10m;
      if (!Number.isFinite(speed) || speed < 0 || !Number.isFinite(direction) || direction < 0 || direction > 360 || !Number.isFinite(current.time) || Math.abs(Date.now() / 1000 - current.time) > 3600) throw new Error('data');
      const drift = vector(speed, direction);
      state.targetX = drift.x; state.targetY = drift.y;
      lastSuccess = Date.now();
      const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
      const from = names[Math.round(direction / 45) % 8];
      const toward = names[(Math.round(direction / 45) + 4) % 8];
      status.textContent = speed < .1 ? '현재 바람은 거의 없어요' : `${from}풍 ${speed.toFixed(1)} m/s · ${toward}쪽으로 흐름`;
      label('바람 새로고침');
    } catch {
      status.textContent = lastSuccess && Date.now() - lastSuccess < MAX_AGE
        ? '갱신 실패 · 이전 바람을 잠시 유지해요'
        : '바람을 불러오지 못했어요 · 다시 시도해 주세요';
      label('바람 다시 연결');
    } finally {
      pending = false; button.disabled = false;
    }
  }
  button.addEventListener('click', () => {
    if (location) { refresh(); return; }
    if (!navigator.geolocation) { status.textContent = '이 브라우저에서는 위치를 사용할 수 없어요'; return; }
    button.disabled = true;
    status.textContent = '현재 위치 확인 중…';
    navigator.geolocation.getCurrentPosition(position => {
      // Weather needs only approximate coordinates. Never persist the location.
      location = { latitude: position.coords.latitude.toFixed(2), longitude: position.coords.longitude.toFixed(2) };
      refresh();
    }, error => {
      button.disabled = false;
      status.textContent = error.code === 1 ? '위치 권한을 허용한 뒤 다시 눌러 주세요' : '위치를 확인하지 못했어요 · 다시 시도해 주세요';
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: REFRESH });
  });
  setInterval(() => { if (!document.hidden) refresh(); }, REFRESH);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location && Date.now() - lastSuccess >= REFRESH) refresh();
  });
  return {
    vector,
    update(dt) {
      if (lastSuccess && Date.now() - lastSuccess > MAX_AGE) {
        state.targetX = state.targetY = 0;
        if (!pending) status.textContent = '바람 정보가 오래되어 연결을 기다리고 있어요';
      }
      const blend = 1 - Math.exp(-dt / 2);
      state.x += (state.targetX - state.x) * blend;
      state.y += (state.targetY - state.y) * blend;
      return { x: state.x, y: state.y };
    },
  };
})();
