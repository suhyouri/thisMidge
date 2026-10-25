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
  let locationAttempted=false,usingDefault=false;
  const DEFAULT_WIND={speed:1,direction:315}; // NW breeze, drifting southeast at 2px/s.
  function useDefault(reason) {
    const drift=vector(DEFAULT_WIND.speed,DEFAULT_WIND.direction);
    state.targetX=drift.x;state.targetY=drift.y;
    if(!usingDefault)console.log('[This Midge] 기본 바람 적용: 북서풍 1 m/s (남동쪽 흐름)',reason);
    usingDefault=true;status.textContent='';label('바람');
  }
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
      lastSuccess = Date.now();usingDefault=false;
      const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
      const from = names[Math.round(direction / 45) % 8];
      const toward = names[(Math.round(direction / 45) + 4) % 8];
      status.textContent = speed < .1 ? '현재 바람은 거의 없어요' : `${from}풍 ${speed.toFixed(1)} m/s · ${toward}쪽으로 흐름`;
      label('바람 새로고침');
    } catch {
      useDefault('바람 조회 실패');
    } finally {
      pending = false; button.disabled = false;
    }
  }
  button.addEventListener('click', () => {
    if(pending)return;
    if(location){refresh();return;}
    if(locationAttempted){useDefault('위치 재요청 없이 기본값 유지');return;}
    locationAttempted=true;
    if(!navigator.geolocation){useDefault('위치 API 없음');return;}
    pending=true;button.disabled=true;
    status.textContent='현재 위치 확인 중…';
    function failed(reason) {
      pending=false;button.disabled=false;useDefault(reason);
    }
    try {
      navigator.geolocation.getCurrentPosition(position=>{
        const latitude=position?.coords?.latitude,longitude=position?.coords?.longitude;
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){failed('위치 응답 오류');return;}
        // Weather needs only approximate coordinates. Never persist the location.
        location={latitude:latitude.toFixed(2),longitude:longitude.toFixed(2)};
        pending=false;refresh();
      },error=>failed(`위치 조회 실패 (코드 ${error?.code??'unknown'})`),
      {enableHighAccuracy:false,timeout:12000,maximumAge:REFRESH});
    } catch {failed('위치 요청 실패');}
  });
  setInterval(()=>{if(!document.hidden&&!usingDefault)refresh();},REFRESH);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&location&&!usingDefault&&Date.now()-lastSuccess>=REFRESH)refresh();
  });
  return {
    vector,
    update(dt) {
      if(lastSuccess&&!usingDefault&&Date.now()-lastSuccess>MAX_AGE)useDefault('바람 정보 만료');
      const blend = 1 - Math.exp(-dt / 2);
      state.x += (state.targetX - state.x) * blend;
      state.y += (state.targetY - state.y) * blend;
      return { x: state.x, y: state.y };
    },
  };
})();
