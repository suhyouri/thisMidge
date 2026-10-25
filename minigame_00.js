'use strict';
// Matter.js owns gravity, contact, rotation and the pile; the camera stays fixed.
(() => {
  const WIDTH=1024,HEIGHT=600,SCALE=4*.8/8;
  const STEP=1000/120,FEED_SPEED=180;
  const {Engine,Bodies,Body,Composite,Constraint,Sleeping}=Matter;
  const engine=Engine.create({enableSleeping:true,positionIterations:8,velocityIterations:6,constraintIterations:8});
  engine.gravity.y=.26;
  const canvas=document.getElementById('word-stack'),context=canvas.getContext('2d');
  const guide=document.getElementById('stack-guide');
  const source=document.createElement('canvas');
  window.mayflyBitmapText.draw(source,'더디다');
  const ink=source.getContext('2d');
  ink.globalCompositeOperation='source-in';ink.fillStyle='#1b1b1b';ink.fillRect(0,0,source.width,source.height);
  const word=document.createElement('canvas');
  word.width=source.height;word.height=source.width;
  const rotated=word.getContext('2d');
  rotated.imageSmoothingEnabled=false;
  rotated.translate(0,word.height);rotated.rotate(-Math.PI/2);rotated.drawImage(source,0,0);
  const W=word.width*SCALE,H=word.height*SCALE;
  window.mayflyBitmapText.draw(document.getElementById('minigame-title-pixels'),'더디다');
  window.mayflyBitmapText.draw(guide,'휠을 돌려 좌우로 쌓으세요.');
  const walls=[
    Bodies.rectangle(WIDTH/2,HEIGHT+12,WIDTH+80,40,{isStatic:true,label:'floor',friction:1}),
    Bodies.rectangle(-20,HEIGHT/2,40,HEIGHT+H*4,{isStatic:true,label:'wall'}),
    Bodies.rectangle(WIDTH+20,HEIGHT/2,40,HEIGHT+H*4,{isStatic:true,label:'wall'}),
    Bodies.rectangle(WIDTH/2,-H-52,WIDTH+80,24,{isStatic:true,label:'ceiling'}),
  ];
  Composite.add(engine.world,walls);
  const keys=new Set(),pieces=[],joints=[];
  let running=window.parent===window,lastTime=null,accumulator=0,guideElapsed=0;
  let feed=0,tail=null;
  let wheelInput={left:0,right:0,at:-Infinity};
  function input() {
    const left=Number(keys.has('ArrowLeft'))+Number(keys.has('ArrowUp'));
    const right=Number(keys.has('ArrowDown'))+Number(keys.has('ArrowRight'));
    const wheels=performance.now()-wheelInput.at<=160?wheelInput:{left:0,right:0};
    // Either direction of the left/right physical wheel pushes that side.
    return Math.max(-1,Math.min(1,right-left+Math.abs(wheels.right)-Math.abs(wheels.left)));
  }
  function addSegment(previous) {
    const body=Bodies.rectangle(WIDTH/2,-H/2,W,H,{
      label:'word',
      friction:.45,frictionStatic:.7,frictionAir:.012,restitution:.015,
      chamfer:{radius:W*.45,quality:8},density:.001,slop:.015,sleepThreshold:120,
    });
    // Preserve finite mass so this nozzle link can become dynamic when released.
    Body.setStatic(body,true);
    Composite.add(engine.world,body);pieces.push(body);
    if(previous) {
      const joint=Constraint.create({
        bodyA:previous,pointA:{x:0,y:-H/2},
        bodyB:body,pointB:{x:0,y:H/2},
        length:0,stiffness:.95,damping:.12,
      });
      Composite.add(engine.world,joint);joints.push(joint);
    }
    return body;
  }
  tail=addSegment(null);
  function step() {
    const dt=STEP/1000;
    feed+=FEED_SPEED*dt;
    // Feed the newest link through a fixed nozzle, rather than dropping separate words.
    Body.setPosition(tail,{x:WIDTH/2,y:feed-H/2});
    if(feed>=H) {
      feed-=H;
      Body.setStatic(tail,false);Sleeping.set(tail,false);
      Body.setVelocity(tail,{x:0,y:FEED_SPEED/60});
      Body.setAngularVelocity(tail,(Math.random()-.5)*.006);
      tail=addSegment(tail);
      Body.setPosition(tail,{x:WIDTH/2,y:feed-H/2});
    }
    const direction=input();
    if(direction) {
      // Bend the emerging strand; the deposited part remains a physical pile.
      for(let i=Math.max(0,pieces.length-10);i<pieces.length-1;i++) {
        const body=pieces[i];Sleeping.set(body,false);
        Body.applyForce(body,body.position,{x:body.mass*direction*.0007,y:0});
      }
    }
    Engine.update(engine,STEP);
  }
  function render() {
    context.clearRect(0,0,WIDTH,HEIGHT);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.fillStyle='#d3b82f';context.fillRect(0,HEIGHT-8,WIDTH,4);
    for(const body of pieces) {
      if(body.bounds.max.y<0||body.bounds.min.y>HEIGHT)continue;
      context.save();context.translate(body.position.x,body.position.y);context.rotate(body.angle);
      context.drawImage(word,-W/2,-H/2,W,H);context.restore();
    }
  }
  function animate(time) {
    const elapsed=lastTime===null?0:Math.max(0,(time-lastTime)/1000);
    lastTime=time;
    if(running&&!document.hidden) {
      guideElapsed+=elapsed;
      if(guideElapsed>=5)guide.hidden=true;
      if(window.parent===window&&guideElapsed>=60)running=false;
      accumulator+=Math.min(elapsed,.1)*1000;
      while(accumulator>=STEP){step();accumulator-=STEP;}
    }
    render();requestAnimationFrame(animate);
  }
  window.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||event.metaKey||event.ctrlKey||event.altKey)return;
    event.preventDefault();if(running)keys.add(event.key);
  });
  window.addEventListener('keyup',event=>keys.delete(event.key));
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{keys.clear();lastTime=null;});
  window.addEventListener('message',event=>{
    if(event.source!==window.parent)return;
    if(event.data?.type==='mayfly-wheel-input') {
      const {left,right}=event.data;
      if(running&&Number.isFinite(left)&&Number.isFinite(right)&&Math.abs(left)<=1&&Math.abs(right)<=1) {
        wheelInput={left,right,at:performance.now()};
      }
      return;
    }
    if(event.data?.type!=='mayfly-mini-state')return;
    running=event.data.running===true;keys.clear();lastTime=null;
    wheelInput={left:0,right:0,at:-Infinity};
  });
  render();requestAnimationFrame(animate);
})();
