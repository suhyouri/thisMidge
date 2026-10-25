'use strict';
window.mayflyWorld = (() => {
  const WIDTH = 8000, HEIGHT = 6000;
  const RADII = [750, 1500, 2250];
  // The author edits only content/text.js. Empty entries never enter a stage's deck.
  const TEXTS = Array.from({length:4}, (_, index) => {
    const entries = window.MAYFLY_TEXTS?.[`stage${index+1}`];
    return Array.isArray(entries) ? entries.filter(text=>typeof text==='string'&&text.trim()).map(text=>text.trim()) : [];
  });
  const decks = [[], [], [], []];
  function nextText(stage) {
    const pool = TEXTS[stage-1];
    if(!pool.length) return `${stage}단계의 문장을 content/text.js에 입력해 주세요.`;
    const deck=decks[stage-1];
    if(!deck.length) {
      deck.push(...pool);
      for(let i=deck.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [deck[i],deck[j]]=[deck[j],deck[i]];
      }
    }
    return deck.pop();
  }
  const layer = document.getElementById('discoveries');
  const dialogue = document.getElementById('dialogue');
  const textElement = document.getElementById('dialogue-text');
  const textCanvas = document.getElementById('dialogue-pixels');
  const transitionCanvas = document.getElementById('transition-overlay');
  const transitionContext = transitionCanvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bayer = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  const points = [];
  let open = false, transition = null, currentText = '', previousFocus = null;
  let closeTimer = null;
  let currentX=WIDTH/2,currentY=HEIGHT/2;
  const TEXT_DURATION = 5000;
  function stageAt(x, y) {
    const radius = Math.hypot(x - WIDTH / 2, y - HEIGHT / 2);
    const index = RADII.findIndex(edge => radius < edge);
    return index < 0 ? 4 : index + 1;
  }
  function drawMarker(canvas, stage, alternate=false) {
    // A 16 × 16 light: dense bright core, sparse halo, 4px display cells.
    const size=16;
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const radius=Math.hypot(x-7.5,y-7.5);
      const density=radius<1.8?1:Math.pow(Math.max(0,1-(radius-1.8)/5.7),1.6);
      if(density>(bayer[(y%8)*8+x%8]+.5)/64) {
        const i=(y*size+x)*4;
        pixels.data[i]=255;
        pixels.data[i+1]=255;
        pixels.data[i+2]=255;
        pixels.data[i+3]=255;
      }
    }
    if(alternate) {
      // Keep the light's core intact; only five halo pixels change.
      for(const [x,y] of [[5,4],[10,5],[12,7],[6,11],[10,11]]) {
        const i=(y*size+x)*4;
        const value=pixels.data[i+3]?0:255;
        pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=pixels.data[i+3]=value;
      }
    }
    context.putImageData(pixels,0,0);
  }
  function drawText() {
    if(!currentText || dialogue.hidden) return;
    const scale=2;
    const line=document.getElementById('dialogue-line');
    window.mayflyBitmapText.draw(textCanvas,currentText);
    textCanvas.style.width=textCanvas.width*scale+'px';
    textCanvas.style.height=textCanvas.height*scale+'px';
    const overflow=Math.max(0,textCanvas.width*scale-line.clientWidth);
    textCanvas.style.setProperty('--text-travel',`${-overflow}px`);
    textCanvas.classList.toggle('scrolling',overflow>0);
  }
  function show(point) {
    if(transition || open || window.mayflyHome?.waiting) return;
    point.visited=true;point.armed=false;point.element.classList.add('visited');
    previousFocus=document.activeElement;
    currentText=nextText(point.stage);textElement.textContent=currentText;
    dialogue.hidden=false;open=true;
    document.body.classList.add('dialogue-open');
    drawText();dialogue.focus({preventScroll:true});
    clearTimeout(closeTimer);
    closeTimer=setTimeout(close,TEXT_DURATION);
    window.dispatchEvent(new Event('mayfly-dialogue'));
  }
  function close() {
    if(!open) return;
    clearTimeout(closeTimer);closeTimer=null;
    dialogue.hidden=true;open=false;document.body.classList.remove('dialogue-open');
    window.dispatchEvent(new Event('mayfly-story-read'));
    if(previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({preventScroll:true});
    window.dispatchEvent(new Event('mayfly-dialogue'));
  }
  for(let stage=1;stage<=4;stage++) {
    const startAngle=Math.random()*Math.PI*2;
    for(let i=0;i<3;i++) {
      let x,y;
      for(let attempt=0;attempt<200;attempt++) {
        const angle=stage===1 && i===0 ? -Math.PI*.75+(Math.random()-.5)*.25 : startAngle+i*Math.PI*2/3+(Math.random()-.5)*.4;
        const low=stage===1?(i===0?150:340):RADII[stage-2]+90;
        const high=stage===1?(i===0?190:680):stage===4?3500:RADII[stage-1]-90;
        const radius=Math.sqrt(low*low+Math.random()*(high*high-low*low));
        x=WIDTH/2+Math.cos(angle)*radius;y=HEIGHT/2+Math.sin(angle)*radius;
        if(x>100&&x<WIDTH-100&&y>100&&y<HEIGHT-100) break;
      }
      const element=document.createElement('button');
      element.type='button';element.className='discovery';element.dataset.stage=stage;
      element.setAttribute('aria-label',`${stage}단계의 이야기 ${i+1} 열기`);
      element.style.left=x+'px';element.style.top=y+'px';
      element.style.setProperty('--twinkle-delay',`${-Math.random()*.8}s`);
      for(let frame=0;frame<2;frame++) {
        const canvas=document.createElement('canvas');
        canvas.className=frame?'trigger-frame alternate':'trigger-frame';
        canvas.setAttribute('aria-hidden','true');
        drawMarker(canvas,stage,frame===1);element.append(canvas);
      }
      const point={stage,x,y,element,visited:false,armed:true};points.push(point);
      element.addEventListener('click',()=>show(point));layer.append(element);
    }
  }
  // A separate minigame object; story triggers and their time rewards stay independent.
  const miniIcon=window.MAYFLY_MINI_00;
  if(miniIcon) {
    const x=WIDTH/2+240,y=HEIGHT/2-120;
    const element=document.createElement('button');
    element.type='button';element.className='discovery minigame-trigger';
    element.id='mini_00';element.dataset.stage='1';element.dataset.kind='minigame';
    element.setAttribute('aria-label','미니게임 mini_00');
    element.style.left=x+'px';element.style.top=y+'px';
    element.style.setProperty('--twinkle-duration',`${miniIcon.frameDuration*2}ms`);
    element.style.setProperty('--twinkle-half',`${miniIcon.frameDuration}ms`);
    miniIcon.frames.forEach((frame,index)=>{
      const canvas=document.createElement('canvas');
      canvas.width=miniIcon.width;canvas.height=miniIcon.height;
      canvas.className=index?'trigger-frame alternate':'trigger-frame';
      canvas.setAttribute('aria-hidden','true');
      const context=canvas.getContext('2d');
      context.fillStyle=miniIcon.color;
      frame.forEach((row,y)=>row.forEach((value,x)=>{if(value)context.fillRect(x,y,1,1);}));
      element.append(canvas);
    });
    const point={id:'mini_00',kind:'minigame',color:miniIcon.color,destination:'./minigames/minigame_00/minigame_00.html',stage:1,x,y,element,armed:true};
    points.push(point);layer.append(element);
    element.addEventListener('click',()=>activate(point));
  }
  function activate(point) {
    if(open||transition||window.mayflyHome?.waiting||window.mayflyMinigame.active||!point.armed)return;
    if(point.kind==='minigame') {
      point.armed=false;
      // Keep the event available for minigame integrations.
      window.dispatchEvent(new CustomEvent('mayfly-minigame',{detail:{id:point.id,stage:point.stage,x:point.x,y:point.y}}));
      beginWipe(point.color,()=>window.mayflyMinigame.open(point));
      return;
    }
    show(point);
  }
  function beginWipe(color,onComplete) {
    if(transition)return;
    if(reduced.matches){onComplete();return;}
    transition={kind:'wipe',elapsed:0,color,onComplete};
    drawWipe(0,color);transitionCanvas.hidden=false;
  }
  function resizeTransition() {
    const screen=document.getElementById('screen');
    transitionCanvas.width=Math.ceil(screen.clientWidth/4);
    transitionCanvas.height=Math.ceil(screen.clientHeight/4);
  }
  const BLINK_CLOSE=.18, BLINK_HOLD=.08, BLINK_OPEN=.28;
  const BLINK_DURATION=BLINK_CLOSE+BLINK_HOLD+BLINK_OPEN;
  function blinkProgress(elapsed) {
    if(elapsed<BLINK_CLOSE)return elapsed/BLINK_CLOSE;
    if(elapsed<BLINK_CLOSE+BLINK_HOLD)return 1;
    return Math.max(0,1-(elapsed-BLINK_CLOSE-BLINK_HOLD)/BLINK_OPEN);
  }
  function drawTransition(progress) {
    // Two eyelids close into a horizontal slit, then reopen on the new position.
    const width=transitionCanvas.width,height=transitionCanvas.height;
    const image=transitionContext.createImageData(width,height);
    const eased=progress*progress*(3-2*progress),edge=1;
    const gap=(height/2+edge)*(1-eased)-edge/2;
    const shade=transition?.shade??255;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const distance=Math.abs(y+.5-height/2);
      const density=Math.max(0,Math.min(1,(distance-gap)/edge+.5));
      if(density>(bayer[(y%8)*8+x%8]+.5)/64) {
        const i=(y*width+x)*4;
        image.data[i]=image.data[i+1]=image.data[i+2]=shade;
        image.data[i+3]=255;
      }
    }
    transitionContext.putImageData(image,0,0);
  }
  const WIPE_DURATION=1;
  function drawWipe(progress,color) {
    const width=transitionCanvas.width,height=transitionCanvas.height;
    const image=transitionContext.createImageData(width,height);
    const edge=12,band=width*.25;
    const front=width+edge/2-(width+band+edge)*progress;
    const rgb=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const threshold=(bayer[(y%8)*8+x%8]+.5)/64;
      const cover=Math.max(0,Math.min(1,(x+.5-front)/edge+.5));
      if(cover<=threshold)continue;
      const white=Math.max(0,Math.min(1,(x+.5-front-band)/edge+.5))>threshold;
      const i=(y*width+x)*4;
      image.data[i]=white?255:rgb[0];image.data[i+1]=white?255:rgb[1];image.data[i+2]=white?255:rgb[2];image.data[i+3]=255;
    }
    transitionContext.putImageData(image,0,0);
  }
  resizeTransition();
  window.addEventListener('resize',()=>{
    resizeTransition();
    if(transition?.kind==='wipe')drawWipe(Math.min(1,transition.elapsed/WIPE_DURATION),transition.color);
    else if(transition)drawTransition(blinkProgress(transition.elapsed));
    drawText();
  });
  return {
    stageAt,
    get paused(){return open || transition!==null || window.mayflyMinigame.active || !!window.mayflyAdmin?.paused || !!window.mayflyHome?.waiting;},
    get transitioning(){return transition!==null;},
    reset() {
      clearTimeout(closeTimer);closeTimer=null;
      open=false;currentText='';previousFocus=null;dialogue.hidden=true;
      document.body.classList.remove('dialogue-open');
      transition=null;transitionCanvas.hidden=true;
      currentX=WIDTH/2;currentY=HEIGHT/2;
      decks.forEach(deck=>{deck.length=0;});
      points.forEach(point=>{point.armed=true;point.visited=false;point.element.classList.remove('visited');});
    },
    wipe:beginWipe,
    wrap(teleport,onComplete) {
      if(transition) return;
      if(reduced.matches) {teleport();onComplete?.();return;}
      transition={elapsed:0,teleport,onComplete,jumped:false,shade:stageAt(currentX,currentY)<=2?255:0};
      drawTransition(0);transitionCanvas.hidden=false;
    },
    update(dt,x,y) {
      currentX=x;currentY=y;
      if(window.mayflyAdmin?.paused||window.mayflyHome?.waiting)return;
      if(transition) {
        transition.elapsed+=dt;
        const t=transition.elapsed;
        if(transition.kind==='wipe') {
          drawWipe(Math.min(1,t/WIPE_DURATION),transition.color);
          if(t>=WIPE_DURATION) {
            const onComplete=transition.onComplete;
            transition=null;
            onComplete();transitionCanvas.hidden=true;
          }
          return;
        }
        drawTransition(blinkProgress(t));
        if(t>=BLINK_CLOSE&&!transition.jumped) {
          transition.teleport();transition.jumped=true;
        }
        if(t>=BLINK_DURATION){
          const onComplete=transition.onComplete;
          transition=null;transitionCanvas.hidden=true;onComplete?.();
        }
        return;
      }
      if(open||window.mayflyMinigame.active) return;
      for(const point of points) {
        const distance=Math.hypot(x-point.x,y-point.y);
        if(distance>95) point.armed=true;
        if(point.armed&&distance<55) {activate(point);break;}
      }
    },
  };
})();
