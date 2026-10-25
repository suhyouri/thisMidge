'use strict';
window.mayflyHome = (() => {
  const screen=document.getElementById('home-screen');
  let waiting=true;
  window.mayflyBitmapText.draw(document.getElementById('home-title-pixels'),'이 미지 This Midge');
  document.querySelectorAll('[data-home-text]').forEach(canvas=>window.mayflyBitmapText.draw(canvas,canvas.dataset.homeText));
  function notify(){window.dispatchEvent(new Event('mayfly-home-state'));}
  function goHome() {
    waiting=true;
    window.mayflyMinigame.cancel();
    window.mayflyWorld.reset();
    window.mayflyLife.reset();
    screen.hidden=false;document.body.classList.add('home-waiting');
    notify();document.getElementById('viewport').focus({preventScroll:true});
  }
  document.getElementById('home-button').addEventListener('click',goHome);
  return {
    get waiting(){return waiting;},
    goHome,
    start() {
      if(!waiting||window.mayflyAdmin?.paused)return;
      waiting=false;screen.hidden=true;document.body.classList.remove('home-waiting');
      notify();document.getElementById('viewport').focus({preventScroll:true});
    },
  };
})();
