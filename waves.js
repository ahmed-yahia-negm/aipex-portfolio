// Lightweight, pointer-responsive ribbon field. No external animation dependency.
const canvas=document.querySelector('#wave-field');
const ctx=canvas.getContext('2d',{alpha:true});
let width=0,height=0,time=0,last=0,pointerX=.5,pointerY=.5,px=.5,py=.5;
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
function resize(){const ratio=Math.min(devicePixelRatio||1,1.5);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
const LINES=13,STEPS=44;
function ribbon(yBase,phase,direction){
 const gradient=ctx.createLinearGradient(0,0,width,0);gradient.addColorStop(0,'rgba(24,82,255,.03)');gradient.addColorStop(.2,'rgba(20,123,255,.34)');gradient.addColorStop(.47,'rgba(0,197,255,.16)');gradient.addColorStop(.75,'rgba(54,98,255,.4)');gradient.addColorStop(1,'rgba(45,129,255,.05)');
 ctx.strokeStyle=gradient;
 for(let line=0;line<LINES;line++){ctx.beginPath();for(let step=0;step<=STEPS;step++){const x=step/STEPS*width,u=x/width;const bowl=Math.sin(u*Math.PI)*height*.2;const wave=Math.sin(u*5.1+time*.38*direction+phase+line*.042)*height*.095;const small=Math.cos(u*9-time*.22+phase)*height*.025;const fan=Math.sin(u*3.2+phase+time*.15)*line*4.2;const interaction=Math.exp(-Math.pow((u-px)*3,2))*(py-.5)*55;const y=yBase+bowl+wave+small+fan+interaction;step?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.lineWidth=line%4===0?2.3:1.1;ctx.globalAlpha=.28+Math.sin(line/LINES*Math.PI)*.45;ctx.stroke()}
}
function draw(){ctx.clearRect(0,0,width,height);ribbon(height*.58,0,1);ribbon(height*.60,2.5,-1);ctx.globalAlpha=1;}
function frame(stamp){requestAnimationFrame(frame);if(document.hidden||document.body.classList.contains('motion-paused')||motionQuery.matches)return;const delta=stamp-last;if(delta<40)return;time+=delta/1000;last=stamp;px+=(pointerX-px)*.06;py+=(pointerY-py)*.06;draw()}
addEventListener('pointermove',e=>{pointerX=e.clientX/width;pointerY=e.clientY/height},{passive:true});addEventListener('resize',resize,{passive:true});resize();requestAnimationFrame(frame);
