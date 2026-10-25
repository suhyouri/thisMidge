'use strict';
// Pure generation helpers; output pixels are always on/off, never blurred.
window.PixelObjectGenerator = (() => {
  const BAYER8=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  const BAYER4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const MINIGAME_SPARK=["0000000000000100","0000000000011111","0000000000001110","0001110000001110","0001110001001010","0001111111000000","0011111111000000","0011111111110000","0111111111000000","0011111110000000","0001111110000000","0001111100000100","0011111000011111","0011111000001110","0000000000001110","0000000000001010"];
  const defaults={shape:'glow',radius:5,core:1,density:.75,softness:1.5,organic:.15,pattern:'bayer8',seed:1};
  function noise(x,y,seed) {
    let h=Math.imul(x+101,374761393)^Math.imul(y+103,668265263)^Math.imul(seed+1,1274126177);
    h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
  }
  function generate(config,width=16,height=16) {
    const s={...defaults,...config},pixels=new Uint8Array(width*height);
    if(s.shape==='minigame') {
      const source=new Uint8Array(MINIGAME_SPARK.join('').split('').map(Number));
      if(s.seed%2)for(const [x,y] of [[13,0],[11,2],[14,2],[13,11],[14,14]])source[y*16+x]^=1;
      return resizePixels(source,16,16,width,height);
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const dx=x-(width-1)/2,dy=y-(height-1)/2,r=Math.hypot(dx,dy);
      let distance=r;
      if(s.shape==='diamond')distance=(Math.abs(dx)+Math.abs(dy))*.75;
      if(s.shape==='star')distance=r/(.74+.26*Math.cos(5*(Math.atan2(dy,dx)+Math.PI/2)));
      distance+=(noise(x,y,s.seed)-.5)*s.organic*2;
      let density=0;
      if(s.shape==='ring') {
        const lineRadius=Math.max(.5,s.radius-1);
        density=Math.pow(Math.max(0,1-Math.abs(distance-lineRadius)/Math.max(.7,s.softness)),1.1)*s.density;
      } else if(s.shape==='circle') {
        density=Math.min(1,Math.max(0,(s.radius-distance)/Math.max(.25,s.softness)))*s.density;
      } else if(distance<s.radius) {
        const core=Math.min(s.core,Math.max(0,s.radius-.25));
        density=distance<=core?1:Math.pow(Math.max(0,1-(distance-core)/(s.radius-core)),s.softness)*s.density;
      }
      const px=x+(s.seed%8),py=y+(Math.floor(s.seed/8)%8);
      const threshold=s.pattern==='random'?noise(x+17,y+19,s.seed):s.pattern==='bayer4'?(BAYER4[(py%4)*4+px%4]+.5)/16:(BAYER8[(py%8)*8+px%8]+.5)/64;
      pixels[y*width+x]=density>threshold?1:0;
    }
    return pixels;
  }
  function decode(data) {
    if(!data||!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<4||data.width>64||data.height<4||data.height>64||data.pixelSize!==4||!/^#[0-9a-f]{6}$/i.test(data.color)) throw Error('가로·세로 4~64칸, 픽셀 크기 4px인 JSON을 선택해 주세요.');
    const matrices=Array.isArray(data.frames)?data.frames:[data.pixels];
    if(matrices.length<1||matrices.length>2)throw Error('1개 또는 2개의 프레임이 필요합니다.');
    const frames=matrices.map(matrix=>{
      if(!Array.isArray(matrix)||matrix.length!==data.height||matrix.some(row=>!Array.isArray(row)||row.length!==data.width||row.some(value=>value!==0&&value!==1)))throw Error('프레임의 가로·세로와 0/1 픽셀 데이터를 확인해 주세요.');
      return new Uint8Array(matrix.flat());
    });
    if(frames.length===1)frames.push(new Uint8Array(frames[0]));
    return {width:data.width,height:data.height,frames};
  }
  function validate(data){return decode(data).frames[0];}
  function resizePixels(pixels,oldWidth,oldHeight,width,height){
    const result=new Uint8Array(width*height),offsetX=Math.floor((width-oldWidth)/2),offsetY=Math.floor((height-oldHeight)/2);
    for(let y=0;y<oldHeight;y++)for(let x=0;x<oldWidth;x++){
      const nx=x+offsetX,ny=y+offsetY;
      if(nx>=0&&nx<width&&ny>=0&&ny<height)result[ny*width+nx]=pixels[y*oldWidth+x];
    }
    return result;
  }
  return {defaults,generate,validate,decode,resizePixels};
})();

// Editor UI
(() => {
  const $=id=>document.getElementById(id),kernel=window.PixelObjectGenerator;
  const parameterIds=['shape','radius','core','density','softness','organic','pattern','seed'];
  const numberIds=['radius','core','density','softness','organic','seed'];
  const editor=$('editor'),preview=$('preview'),history=[];
  let width=16,height=16,activeFrame=0;
  let frames=[kernel.generate(kernel.defaults)];frames.push(new Uint8Array(frames[0]));
  let drawing=false,drawValue=1,lastPoint=null,activePointer=null;
  let playing=!window.matchMedia('(prefers-reduced-motion: reduce)').matches,previewFrame=0,accumulator=0,lastTime=null,persistenceFailed=false;
  const current=()=>frames[activeFrame];
  function announce(message){$('status').textContent=message;}
  function config(){return Object.fromEntries(parameterIds.map(id=>[id,numberIds.includes(id)?Number($(id).value):$(id).value]));}
  function applyConfig(s){for(const id of parameterIds){if(!s||s[id]===undefined)continue;const e=$(id);if(numberIds.includes(id)){const n=Number(s[id]);if(Number.isFinite(n))e.value=Math.max(Number(e.min),Math.min(Number(e.max),n));}else if([...e.options].some(option=>option.value===s[id]))e.value=s[id];}}
  function snapshot(){history.push({width,height,activeFrame,frames:frames.map(f=>new Uint8Array(f)),color:$('tile-color').value,backgroundColor:$('background-color').value,opaqueBackground:$('export-background').checked,config:config(),fps:$('fps').value,name:$('object-name').value});if(history.length>40)history.shift();}
  function matrix(frame){return Array.from({length:height},(_,y)=>Array.from(frame.slice(y*width,y*width+width)));}
  function fps(){return Math.max(1,Math.min(12,Number($('fps').value)||4));}
  function payload(){return {version:2,name:$('object-name').value.trim()||'small-light',width,height,pixelSize:4,color:$('tile-color').value,backgroundColor:$('background-color').value,opaqueBackground:$('export-background').checked,frameDuration:Math.round(1000/fps()),generator:config(),pixels:matrix(current()),frames:frames.map(matrix)};}
  function persist(){try{localStorage.setItem('thismidge-object-v2',JSON.stringify(payload()));}catch{if(!persistenceFailed){announce('자동 저장을 사용할 수 없어요. JSON으로 저장해 주세요.');persistenceFailed=true;}}}
  function paintCanvas(canvas,frame){
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    const c=canvas.getContext('2d'),image=c.createImageData(width,height);
    const hex=$('tile-color').value, rgb=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));
    frame.forEach((pixel,index)=>{if(pixel){const i=index*4;image.data[i]=rgb[0];image.data[i+1]=rgb[1];image.data[i+2]=rgb[2];image.data[i+3]=255;}});
    c.putImageData(image,0,0);
  }
  function renderPreview(){paintCanvas(preview,frames[playing?previewFrame:activeFrame]);$('preview-frame').textContent=`frame ${(playing?previewFrame:activeFrame)+1}`;}
  function render(save=true){
    const background=$('background-color').value;
    editor.style.background=background;$('preview-world').style.background=background;
    for(const button of document.querySelectorAll('[data-background]')){
      const selected=button.dataset.background===background;
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    }
    paintCanvas(editor,current());renderPreview();
    $('canvas-spec').textContent=`${width} × ${height}`;
    $('canvas-width').value=width;$('canvas-height').value=height;
    $('editor-frame').style.setProperty('--canvas-ratio',`${width} / ${height}`);
    $('editor-frame').style.width=Math.min(320,320*width/height)+'px';
    $('grid').style.setProperty('--columns',width);$('grid').style.setProperty('--rows',height);
    editor.setAttribute('aria-label',`${width}×${height} 픽셀 편집기 · 프레임 ${activeFrame+1} · 클릭하여 반전`);
    preview.style.width=width*4+'px';preview.style.height=height*4+'px';
    preview.setAttribute('aria-label',`${width*4}×${height*4}px 애니메이션 미리보기`);
    $('preview-world').style.width=Math.max(80,width*4+16)+'px';$('preview-world').style.height=Math.max(80,height*4+16)+'px';
    $('pixel-count').textContent=`${current().reduce((a,b)=>a+b,0)} / ${width*height}`;
    $('undo').disabled=history.length===0;
    $('radius').max=Math.max(1.5,Math.min(width,height)/2-.5);
    if(Number($('radius').value)>Number($('radius').max))$('radius').value=$('radius').max;
    for(const id of ['radius','core'])$(id+'-value').textContent=Number($(id).value)+' px';
    for(const id of ['density','organic'])$(id+'-value').textContent=Math.round(Number($(id).value)*100)+'%';
    $('softness-value').textContent=Number($('softness').value).toFixed(2);$('core').disabled=$('shape').value==='ring';
    for(let i=0;i<2;i++){
      const tab=$('frame-'+i),thumb=$('thumb-'+i);thumb.style.background=background;paintCanvas(thumb,frames[i]);
      const scale=48/Math.max(width,height);thumb.style.width=width*scale+'px';thumb.style.height=height*scale+'px';
      tab.classList.toggle('active',i===activeFrame);tab.setAttribute('aria-selected',String(i===activeFrame));
    }
    $('play').textContent=playing?'일시정지':'재생 ▶';$('play').setAttribute('aria-pressed',String(playing));
    if(save)persist();
  }
  function regenerate(){frames[activeFrame]=kernel.generate(config(),width,height);render();}
  for(const id of parameterIds){let checkpoint=false;$(id).addEventListener('pointerdown',()=>{snapshot();checkpoint=true;});$(id).addEventListener('input',()=>{if(!checkpoint){snapshot();checkpoint=true;}regenerate();});$(id).addEventListener('change',()=>{checkpoint=false;});$(id).addEventListener('blur',()=>{checkpoint=false;});}
  $('variant').addEventListener('click',()=>{snapshot();$('seed').value=Math.floor(Math.random()*1000000);regenerate();announce(`프레임 ${activeFrame+1}에 새 모양을 만들었어요.`);});
  function endStroke(){if(drawing){drawing=false;activePointer=null;lastPoint=null;persist();}}
  $('resize-canvas').addEventListener('click',()=>{
    const w=Number($('canvas-width').value),h=Number($('canvas-height').value);
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<4||w>64||h<4||h>64){announce('가로와 세로를 4~64 사이의 정수로 입력하세요.');return;}
    if(w===width&&h===height)return;endStroke();snapshot();
    const cropped=w<width||h<height;frames=frames.map(frame=>kernel.resizePixels(frame,width,height,w,h));width=w;height=h;render();
    announce(cropped?'두 프레임을 가운데 기준으로 줄였어요. 잘린 부분은 되돌리기로 복원할 수 있어요.':`${w}×${h}칸으로 바꿨어요. 기존 그림은 가운데에 유지됩니다.`);
  });
  for(let i=0;i<2;i++)$('frame-'+i).addEventListener('click',()=>{endStroke();activeFrame=i;render();});
  $('copy-frame').addEventListener('click',()=>{snapshot();frames[1-activeFrame]=new Uint8Array(current());render();announce(`프레임 ${activeFrame+1}을 프레임 ${2-activeFrame}로 복사했어요.`);});
  $('play').addEventListener('click',()=>{playing=!playing;previewFrame=activeFrame;accumulator=0;render(false);});
  $('fps').addEventListener('change',()=>{$('fps').value=fps();accumulator=0;persist();});
  function animate(time){
    if(lastTime!==null&&playing&&!document.hidden){accumulator+=Math.min(time-lastTime,250);const duration=1000/fps();if(accumulator>=duration){const count=Math.floor(accumulator/duration);previewFrame=(previewFrame+count)%2;accumulator%=duration;renderPreview();}}
    lastTime=time;requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange',()=>{lastTime=null;});
  $('grid-toggle').addEventListener('change',()=>{$('grid').hidden=!$('grid-toggle').checked;});
  $('clear').addEventListener('click',()=>{snapshot();current().fill(0);render();});
  function undo(){endStroke();const old=history.pop();if(!old)return;width=old.width;height=old.height;activeFrame=old.activeFrame;frames=old.frames;$('tile-color').value=old.color;$('background-color').value=old.backgroundColor||'#000000';$('export-background').checked=Boolean(old.opaqueBackground);$('fps').value=old.fps;$('object-name').value=old.name;$('radius').max=Math.max(1.5,Math.min(width,height)/2-.5);applyConfig(old.config);render();announce('이전 상태로 되돌렸어요.');}
  $('undo').addEventListener('click',undo);document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.target.closest('input,select,textarea')){event.preventDefault();undo();}});
  function pointerCell(event){const r=editor.getBoundingClientRect();return {x:Math.max(0,Math.min(width-1,Math.floor((event.clientX-r.left)*width/r.width))),y:Math.max(0,Math.min(height-1,Math.floor((event.clientY-r.top)*height/r.height)))};}
  function stroke(point){const from=lastPoint||point;let x=from.x,y=from.y;const dx=Math.abs(point.x-x),dy=-Math.abs(point.y-y),sx=x<point.x?1:-1,sy=y<point.y?1:-1;let error=dx+dy;while(true){current()[y*width+x]=drawValue;if(x===point.x&&y===point.y)break;const e=2*error;if(e>=dy){error+=dy;x+=sx;}if(e<=dx){error+=dx;y+=sy;}}lastPoint=point;render(false);}
  editor.addEventListener('pointerdown',event=>{if(event.button!==0||drawing)return;event.preventDefault();snapshot();drawing=true;activePointer=event.pointerId;const point=pointerCell(event);drawValue=1-current()[point.y*width+point.x];lastPoint=null;editor.setPointerCapture(event.pointerId);stroke(point);});editor.addEventListener('pointermove',event=>{if(drawing&&event.pointerId===activePointer)stroke(pointerCell(event));});for(const event of ['pointerup','pointercancel','lostpointercapture'])editor.addEventListener(event,endStroke);window.addEventListener('blur',endStroke);
  for(const id of ['background-color','tile-color']){
    let checkpoint=false;
    const begin=()=>{if(!checkpoint){snapshot();checkpoint=true;}};
    $(id).addEventListener('pointerdown',begin);$(id).addEventListener('focus',begin);
    $(id).addEventListener('input',()=>{begin();render();});
    $(id).addEventListener('change',()=>{checkpoint=false;});$(id).addEventListener('blur',()=>{checkpoint=false;});
  }
  $('export-background').addEventListener('change',persist);
  for(const button of document.querySelectorAll('[data-background]'))button.addEventListener('click',()=>{snapshot();$('background-color').value=button.dataset.background;render();});
  function filename(){return payload().name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/^\.+/,'')||'small-light';}
  function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function savePNG(scale,sheet=false){
    const canvas=document.createElement('canvas');canvas.width=width*scale*(sheet?2:1);canvas.height=height*scale;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    if($('export-background').checked){c.fillStyle=$('background-color').value;c.fillRect(0,0,canvas.width,canvas.height);}
    const temp=document.createElement('canvas');for(let i=0;i<(sheet?2:1);i++){paintCanvas(temp,frames[sheet?i:activeFrame]);c.drawImage(temp,i*width*scale,0,width*scale,height*scale);}
    canvas.toBlob(blob=>{if(!blob){announce('PNG 저장에 실패했어요.');return;}download(blob,filename()+(sheet?'-sheet':`-frame${activeFrame+1}`)+`-${scale}x.png`);announce(`${canvas.width}×${canvas.height}px ${$('export-background').checked?'배경 포함':'투명'} PNG를 저장했어요.`);},'image/png');
  }
  $('png16').addEventListener('click',()=>savePNG(1));$('png64').addEventListener('click',()=>savePNG(4));$('sheet').addEventListener('click',()=>savePNG(1,true));
  $('json').addEventListener('click',()=>{download(new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'}),filename()+'.json');announce('두 프레임과 재생 속도를 함께 저장했어요.');});
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(payload(),null,2));announce('애니메이션 JSON을 복사했어요.');}catch{announce('복사가 허용되지 않았어요. JSON 저장을 사용해 주세요.');}});
  function restore(data){const decoded=kernel.decode(data);width=decoded.width;height=decoded.height;frames=decoded.frames;activeFrame=0;previewFrame=0;accumulator=0;$('tile-color').value=data.color;$('background-color').value=/^#[0-9a-f]{6}$/i.test(data.backgroundColor||'')?data.backgroundColor:'#000000';$('export-background').checked=Boolean(data.opaqueBackground);$('object-name').value=typeof data.name==='string'?data.name.slice(0,64):'small-light';$('radius').max=Math.max(1.5,Math.min(width,height)/2-.5);applyConfig(kernel.defaults);applyConfig(data.generator);$('fps').value=Number.isFinite(data.frameDuration)&&data.frameDuration>0?Math.max(1,Math.min(12,Math.round(1000/data.frameDuration))):4;}
  $('import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>512000)throw Error('500KB 이하의 JSON을 선택해 주세요.');const data=JSON.parse(await file.text());kernel.decode(data);snapshot();restore(data);render();announce('그림과 두 프레임을 불러왔어요.');}catch(error){announce(error instanceof SyntaxError?'JSON 형식을 확인해 주세요.':error.message);}finally{event.target.value='';}});
  $('object-name').addEventListener('input',persist);
  try{const saved=localStorage.getItem('thismidge-object-v2')||localStorage.getItem('thismidge-object-v1');if(saved){restore(JSON.parse(saved));announce('마지막 그림을 복원했어요. 프레임 2를 수정해 애니메이션을 만드세요.');}}catch{announce('새 오브젝트로 시작합니다.');}
  render();requestAnimationFrame(animate);
})();
