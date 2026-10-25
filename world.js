'use strict';
window.mayflyWorld = (() => {
  const WIDTH = 8000, HEIGHT = 6000;
  const RADII = [750, 1500, 2250];
  // The author edits only text.js. Empty entries never enter a stage's deck.
  const TEXTS = Array.from({length:4}, (_, index) => {
    const entries = window.MAYFLY_TEXTS?.[`stage${index+1}`];
    return Array.isArray(entries) ? entries.filter(text=>typeof text==='string'&&text.trim()).map(text=>text.trim()) : [];
  });
  const decks = [[], [], [], []];
  function nextText(stage) {
    const pool = TEXTS[stage-1];
    if(!pool.length) return `${stage}단계의 문장을 text.js에 입력해 주세요.`;
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
  const whiteout = document.getElementById('whiteout');
  const whiteContext = whiteout.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bayer = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  const points = [];
  let open = false, transition = null, currentText = '', previousFocus = null;
  let closeTimer = null;
  const TEXT_DURATION = 5000;
  function stageAt(x, y) {
    const radius = Math.hypot(x - WIDTH / 2, y - HEIGHT / 2);
    const index = RADII.findIndex(edge => radius < edge);
    return index < 0 ? 4 : index + 1;
  }
  function drawMarker(canvas, stage) {
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(32,32);
    for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
      const r=Math.hypot(x-15.5,y-15.5);
      const density = r < 3 ? 1 : r > 14.5 ? 0 : .7 * Math.min(1,(14.5-r)/3);
      if(density > (bayer[(y%8)*8+x%8]+.5)/64) {
        const i=(y*32+x)*4, color=stage<3?255:24;
        pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=color;pixels.data[i+3]=255;
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
    if(transition || open) return;
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
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');drawMarker(canvas,stage);element.append(canvas);
      const point={stage,x,y,element,visited:false,armed:true};points.push(point);
      element.addEventListener('click',()=>show(point));layer.append(element);
    }
  }
  function resizeWhiteout() {whiteout.width=Math.ceil(innerWidth/8);whiteout.height=Math.ceil(innerHeight/8);}
  function drawWhiteout(level) {
    const image=whiteContext.createImageData(whiteout.width,whiteout.height);
    for(let y=0;y<whiteout.height;y++) for(let x=0;x<whiteout.width;x++) {
      if(level>(bayer[(y%8)*8+x%8]+.5)/64) {
        const i=(y*whiteout.width+x)*4;
        image.data[i]=image.data[i+1]=image.data[i+2]=image.data[i+3]=255;
      }
    }
    whiteContext.putImageData(image,0,0);
  }
  resizeWhiteout();
  window.addEventListener('resize',()=>{resizeWhiteout();drawText();});
  return {
    stageAt,
    get paused(){return open || transition!==null;},
    get transitioning(){return transition!==null;},
    wrap(teleport) {
      if(transition) return;
      if(reduced.matches) {teleport();return;}
      transition={elapsed:0,teleport,jumped:false};whiteout.hidden=false;
    },
    update(dt,x,y) {
      if(transition) {
        transition.elapsed+=dt;
        const t=transition.elapsed;
        if(t>=.4&&!transition.jumped) {transition.teleport();transition.jumped=true;}
        const coverage=t<.35?t/.35:t<.5?1:Math.max(0,1-(t-.5)/.35);
        drawWhiteout(coverage);
        if(t>=.85){transition=null;whiteout.hidden=true;}
        return;
      }
      if(open) return;
      for(const point of points) {
        const distance=Math.hypot(x-point.x,y-point.y);
        if(distance>95) point.armed=true;
        if(point.armed&&distance<55) {show(point);break;}
      }
    },
  };
})();
