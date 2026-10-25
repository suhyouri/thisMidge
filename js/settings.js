'use strict';
window.mayflySettings = (() => {
  const KEY='thismidge-settings-v1',DEFAULT_SECONDS=60;
  const valid=value=>Number.isInteger(value)&&value>=1&&value<=86400;
  let lifeSeconds=DEFAULT_SECONDS;
  try {
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(valid(saved?.lifeSeconds))lifeSeconds=saved.lifeSeconds;
  } catch {}
  // A link from admin also carries the setting when file:// storage is isolated per file.
  const requested=new URLSearchParams(window.location.search).get('lifeSeconds');
  if(requested!==null&&/^\d+$/.test(requested)&&valid(Number(requested))) {
    lifeSeconds=Number(requested);
    try {localStorage.setItem(KEY,JSON.stringify({version:1,lifeSeconds}));} catch {}
  }
  return {
    get lifeSeconds(){return lifeSeconds;},
    setLifeSeconds(value) {
      if(!valid(value))throw Error('1~86400 사이의 정수 초를 입력해 주세요.');
      lifeSeconds=value;
      try {localStorage.setItem(KEY,JSON.stringify({version:1,lifeSeconds}));return true;}
      catch {return false;}
    },
  };
})();
