'use strict';
window.mayflyAdmin = (() => {
  const dialog=document.getElementById('admin-settings');
  const initial=document.getElementById('admin-start-seconds');
  const current=document.getElementById('admin-current-seconds');
  const status=document.getElementById('admin-status');
  let paused=false;
  function syncLink(){document.getElementById('admin-game-link').href=`./index.html?lifeSeconds=${window.mayflySettings.lifeSeconds}`;}
  syncLink();
  function notify(){window.dispatchEvent(new Event('mayfly-admin-state'));}
  document.getElementById('admin-open').addEventListener('click',()=>{
    initial.value=window.mayflySettings.lifeSeconds;
    current.value=window.mayflyLife.remaining;
    status.textContent='';
    paused=true;notify();dialog.showModal();
  });
  document.getElementById('admin-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    paused=false;notify();
    document.getElementById('viewport').focus({preventScroll:true});
  });
  document.getElementById('admin-default-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity())return;
    const seconds=Number(initial.value);
    const saved=window.mayflySettings.setLifeSeconds(seconds);syncLink();
    status.textContent=saved?`시작 · 리셋 시간을 ${seconds}초로 저장했습니다.`:`이번 실행에 ${seconds}초를 적용했습니다. 브라우저 저장은 사용할 수 없습니다.`;
  });
  document.getElementById('admin-current-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity())return;
    const seconds=Number(current.value);
    window.mayflyLife.setRemaining(seconds);
    status.textContent=`현재 남은 시간을 ${seconds}초로 변경했습니다.`;
  });
  document.getElementById('admin-reset').addEventListener('click',()=>{
    const saved=window.mayflySettings.setLifeSeconds(60);syncLink();
    window.mayflyLife.reset();initial.value=current.value=60;
    status.textContent=saved?'시작 시간과 현재 남은 시간을 60초로 복원했습니다.':'이번 실행을 60초로 복원했습니다. 브라우저 저장은 사용할 수 없습니다.';
  });
  return {get paused(){return paused;}};
})();
