'use strict';
// The parent owns the session timer, so every minigame returns consistently.
window.mayflyMinigame = (() => {
  const DURATION=60;
  const overlay=document.getElementById('minigame-overlay');
  const frame=document.getElementById('minigame-frame');
  const timer=document.getElementById('minigame-timer');
  const pixels=document.getElementById('minigame-timer-pixels');
  let active=false,running=false,finishing=false,point=null;
  let remaining=DURATION,lastTime=null,animation=null,displayed=null;
  function render() {
    const seconds=Math.max(0,Math.ceil(remaining));
    if(seconds===displayed)return;
    displayed=seconds;
    const text=`미니게임: ${seconds}초`;
    timer.setAttribute('aria-label',text);
    window.mayflyBitmapText.draw(pixels,text);
  }
  function sendState() {
    const play=running&&!finishing&&!document.hidden&&!window.mayflyAdmin?.paused;
    frame.contentWindow.postMessage({type:'mayfly-mini-state',running:play},'*');
    if(play)frame.contentWindow.focus();
  }
  window.addEventListener('mayfly-admin-state',sendState);
  function notify(){window.dispatchEvent(new Event('mayfly-minigame-state'));}
  function tick(time) {
    animation=null;
    if(!running)return;
    if(document.hidden||window.mayflyAdmin?.paused)lastTime=null;
    else {
      if(lastTime!==null)remaining=Math.max(0,remaining-Math.max(0,(time-lastTime)/1000));
      lastTime=time;render();
    }
    if(remaining<=0){finish();return;}
    animation=requestAnimationFrame(tick);
  }
  function finish() {
    if(!active||finishing)return;
    finishing=true;running=false;sendState();
    if(animation!==null)cancelAnimationFrame(animation);
    animation=null;lastTime=null;
    window.mayflyWorld.wipe(point.color,()=>{
      overlay.hidden=true;
      frame.removeAttribute('src');
      window.mayflyLife.reset();
      active=false;finishing=false;point=null;
      document.getElementById('viewport').focus({preventScroll:true});notify();
    });
  }
  frame.addEventListener('load',()=>{
    if(!active||running||finishing)return;
    running=true;lastTime=null;
    sendState();
    animation=requestAnimationFrame(tick);
  });
  document.addEventListener('visibilitychange',()=>{lastTime=null;if(active)sendState();});
  return {
    get active(){return active;},
    get remaining(){return remaining;},
    open(trigger) {
      if(active)return;
      point=trigger;active=true;running=false;finishing=false;
      remaining=DURATION;displayed=null;lastTime=null;
      render();notify();
      frame.src=trigger.destination;
      overlay.hidden=false;
    },
    cancel() {
      active=false;running=false;finishing=false;point=null;sendState();
      if(animation!==null)cancelAnimationFrame(animation);
      animation=null;lastTime=null;remaining=DURATION;displayed=null;
      overlay.hidden=true;frame.removeAttribute('src');notify();
    },
    finish,
  };
})();
