export const DEMO_DURATION = 6;
const PHASE_TIMES = '0;0.08;0.46;0.54;0.92;1';
const CORAL = '#ff7a64';
const CYAN = '#62cce6';
const NEUTRAL = '#8b9692';
let svgSerial = 0;

const MUSCLES = {
  'bench-press': { primary: ['Pectoralis major', 'Triceps'], secondary: ['Anterior deltoids'], targets: ['chest', 'triceps', 'front-delt'], firstHalf: 'shortening', concentric: 'Press the weights up', eccentric: 'Lower toward your chest', view: 'front' },
  'goblet-squat': { primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Adductors'], targets: ['quads', 'glutes'], firstHalf: 'lengthening', concentric: 'Stand up', eccentric: 'Lower into the squat', view: 'front' },
  'dumbbell-row': { primary: ['Latissimus dorsi', 'Biceps'], secondary: ['Posterior deltoid', 'Brachialis'], targets: ['lats', 'biceps', 'rear-delt'], firstHalf: 'shortening', concentric: 'Pull toward your hip', eccentric: 'Lower the weight', view: 'back' },
  'shoulder-press': { primary: ['Deltoids', 'Triceps'], secondary: ['Serratus anterior', 'Trapezius'], targets: ['front-delt', 'middle-delt', 'triceps'], firstHalf: 'shortening', concentric: 'Press overhead', eccentric: 'Lower to your shoulders', view: 'front' },
  'romanian-deadlift': { primary: ['Hamstrings', 'Gluteus maximus'], secondary: ['Adductor magnus'], targets: ['hamstrings', 'glutes'], firstHalf: 'lengthening', concentric: 'Stand and extend your hips', eccentric: 'Move your hips back', view: 'back' },
  'reverse-lunge': { primary: ['Front-leg quadriceps', 'Front-leg gluteus maximus'], secondary: ['Adductors'], targets: ['quads', 'glutes'], firstHalf: 'lengthening', concentric: 'Push through the front leg', eccentric: 'Step back and lower', view: 'front' },
  'bicep-curl': { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'], targets: ['biceps'], firstHalf: 'shortening', concentric: 'Curl the weights up', eccentric: 'Lower the weights', view: 'front' },
  'push-up': { primary: ['Pectoralis major', 'Triceps'], secondary: ['Anterior deltoids'], targets: ['chest', 'triceps', 'front-delt'], firstHalf: 'lengthening', concentric: 'Press away from the floor', eccentric: 'Lower your body', view: 'front' },
  'lateral-raise': { primary: ['Middle deltoids'], secondary: ['Supraspinatus'], targets: ['middle-delt'], firstHalf: 'shortening', concentric: 'Raise your arms outward', eccentric: 'Lower your arms', view: 'front' },
};

export function muscleInfo(id) {
  const info = MUSCLES[id];
  return info ? { ...info, preferredView: info.view, primary: [...info.primary], secondary: [...info.secondary], targets: [...info.targets] } : null;
}

export function getDemoPhase(id, time = 0) {
  const info = MUSCLES[id];
  if (!info) return null;
  const progress = ((Number.isFinite(time) ? time : 0) % DEMO_DURATION + DEMO_DURATION) % DEMO_DURATION / DEMO_DURATION;
  const first = progress >= .08 && progress < .46;
  const second = progress >= .54 && progress < .92;
  if (!first && !second) return { key: 'hold', label: 'Hold', movement: 'Changing direction' };
  const key = first ? info.firstHalf : info.firstHalf === 'shortening' ? 'lengthening' : 'shortening';
  return { key, label: key === 'shortening' ? 'Shortening' : 'Lengthening', movement: key === 'shortening' ? info.concentric : info.eccentric };
}

const add = (p, x, y = 0) => [p[0] + x, p[1] + y];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pt = p => p.map(v => Math.round(v * 100) / 100).join(' ');
const line = points => `M${points.map(pt).join('L')}`;
const normal = (a, b) => { const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / length, (b[0] - a[0]) / length]; };
const offset = (p, n, amount) => [p[0] + n[0] * amount, p[1] + n[1] * amount];
const opposite = phase => phase === 'shortening' ? 'lengthening' : 'shortening';
const phaseColor = phase => phase === 'shortening' ? CORAL : phase === 'lengthening' ? CYAN : NEUTRAL;

function animate(attribute, a, b, enabled) {
  if (!enabled || a === b) return '';
  return `<animate attributeName="${attribute}" values="${a};${a};${b};${b};${a};${a}" keyTimes="${PHASE_TIMES}" dur="${DEMO_DURATION}s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1"/>`;
}

function defs(ctx) {
  const first = phaseColor(ctx.info.firstHalf);
  const second = phaseColor(opposite(ctx.info.firstHalf));
  const colour = ctx.dynamic ? NEUTRAL : phaseColor(ctx.phase);
  const changing = ctx.dynamic ? `<animate attributeName="stop-color" values="${NEUTRAL};${first};${NEUTRAL};${second};${NEUTRAL};${NEUTRAL}" keyTimes="${PHASE_TIMES}" dur="${DEMO_DURATION}s" repeatCount="indefinite" calcMode="discrete"/>` : '';
  return `<defs><linearGradient id="${ctx.uid}-tissue" x1="0" x2="1"><stop stop-color="#414d49"/><stop offset=".42" stop-color="#a1aaa6"/><stop offset=".67" stop-color="#727f79"/><stop offset="1" stop-color="#3d4844"/></linearGradient><linearGradient id="${ctx.uid}-active" x1="0" x2="1"><stop stop-color="${colour}" stop-opacity=".6">${changing}</stop><stop offset=".42" stop-color="${colour}">${changing}</stop><stop offset="1" stop-color="${colour}" stop-opacity=".72">${changing}</stop></linearGradient><linearGradient id="${ctx.uid}-bone" x1="0" x2="1"><stop stop-color="#9ca6a1"/><stop offset=".45" stop-color="#d2d8d4"/><stop offset="1" stop-color="#64706a"/></linearGradient></defs>`;
}

function path(dA, dB, fill, ctx, extra = '') {
  return `<path d="${dA}" fill="${fill}" stroke="#26382d" stroke-width=".55" stroke-linejoin="round" ${extra}>${animate('d', dA, dB, ctx.dynamic)}</path>`;
}

function trace(a, b, ctx, color = '#d5dfd6', width = .55, opacity = .5) {
  return `<path d="${a}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}">${animate('d', a, b, ctx.dynamic)}</path>`;
}

function fillFor(key, ctx, enabled = true) {
  return `url(#${ctx.uid}-${enabled && ctx.info.targets.includes(key) ? 'active' : 'tissue'})`;
}

function spindle(a, b, width, shift = 0) {
  const n = normal(a, b);
  const start = offset(mix(a,b,.09),n,shift);
  const end = offset(mix(a,b,.93),n,shift);
  const l1 = offset(mix(a,b,.31),n,width + shift);
  const l2 = offset(mix(a,b,.66),n,width*.87 + shift);
  const r1 = offset(mix(a,b,.62),n,-width*.78 + shift);
  const r2 = offset(mix(a,b,.25),n,-width*.75 + shift);
  return `M${pt(start)}C${pt(l1)} ${pt(l2)} ${pt(end)}C${pt(r1)} ${pt(r2)} ${pt(start)}Z`;
}

function muscle(a1, a2, b1, b2, width, key, ctx, options = {}) {
  const active = ctx.info.targets.includes(key) && options.active !== false;
  const shift = options.shift || 0;
  const aWidth = active ? width*(ctx.info.firstHalf === 'shortening' ? .96 : 1.06) : width;
  const bWidth = active ? width*(ctx.info.firstHalf === 'shortening' ? 1.06 : .96) : width;
  let result = `<g data-muscle="${key}">${path(spindle(a1,a2,aWidth,shift),spindle(b1,b2,bWidth,shift),fillFor(key,ctx,options.active !== false),ctx)}`;
  for (const f of [-.5,-.2,.2,.5]) {
    const fiber = (a,b,w) => {
      const n=normal(a,b),start=offset(mix(a,b,.16),n,shift),end=offset(mix(a,b,.86),n,shift);
      return `M${pt(start)}Q${pt(offset(mix(a,b,.5),n,shift+w*f))} ${pt(end)}`;
    };
    result += trace(fiber(a1,a2,aWidth),fiber(b1,b2,bWidth),ctx,'#e4eee6',.48,active?.3:.24);
  }
  return result+'</g>';
}

function bone(a,b,c,d,width,ctx) {
  const da=line([a,b]),db=line([c,d]);
  return `<path d="${da}" fill="none" stroke="#65776b" stroke-width="${width}" stroke-linecap="round">${animate('d',da,db,ctx.dynamic)}</path>`;
}

function translated(a,b,content,ctx) {
  const sa=pt(a),sb=pt(b);
  const movement=ctx.dynamic && sa!==sb?`<animateTransform attributeName="transform" type="translate" values="${sa};${sa};${sb};${sb};${sa};${sa}" keyTimes="${PHASE_TIMES}" dur="${DEMO_DURATION}s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1"/>`:'';
  return `<g transform="translate(${sa})">${movement}${content}</g>`;
}

function head(a,b,ctx,side=false) {
  const shape=side?'M-10-9Q-8-21 3-19Q13-18 12-6L17 0L12 3L11 10Q7 17-1 14L-8 7Z':'M-12-10Q-10-22 0-22Q11-22 13-10L11 8L6 16L-6 16L-11 8Z';
  const face=side?'<path d="M4-11l5 2M1-3l7 5M-4 2l5 11M8 7l-6 2"/>':'<path d="M-9-5l6-1M4-6l6 1M0-5l-2 8h4M-5 9l5 2 5-2M-10 0l4 5M10 0l-4 5"/>';
  return translated(a,b,`<path d="${shape}" fill="url(#${ctx.uid}-bone)" stroke="#1d2922" stroke-width=".8"/><g fill="none" stroke="#44574a" stroke-width=".7" opacity=".75">${face}</g>`,ctx);
}

function foot(a,b,ctx,flip=1) {
  return translated(a,b,`<g transform="scale(${flip} 1)"><path d="M-5-5Q2-7 6-4L8 0L21 4Q26 9 18 10H-7L-8 5Z" fill="url(#${ctx.uid}-bone)" stroke="#203127" stroke-width=".8"/><path d="M-3-1l15 6M2 0l12 6M7 2l10 5" stroke="#596e5d" stroke-width=".6" fill="none"/></g>`,ctx);
}

function weight(a,b,ctx,vertical=false) {
  return translated(a,b,`<g${vertical?' transform="rotate(90)"':''}><rect x="-17" y="-2" width="34" height="4" rx="1" fill="#a1a8a3"/><rect x="-22" y="-10" width="9" height="20" rx="2" fill="#414d45" stroke="#839286" stroke-width=".8"/><rect x="13" y="-10" width="9" height="20" rx="2" fill="#414d45" stroke="#839286" stroke-width=".8"/><path d="M-18-7v14M18-7v14" stroke="#6c8070" stroke-width="1.4"/></g>`,ctx);
}

function limb(a,b,c,d,e,f,ctx,{arm=false,back=false,active=true,flip=1}={}) {
  let art=bone(a,b,d,e,arm?17:25,ctx)+bone(b,c,e,f,arm?12:15,ctx);
  if(arm){
    art+=muscle(a,b,d,e,14,back?'triceps':'biceps',ctx,{shift:flip*1.8,active});
    art+=muscle(a,b,d,e,7,back?'biceps':'triceps',ctx,{shift:flip*-4.2,active});
    art+=muscle(b,c,e,f,9.4,'forearms',ctx,{shift:1.4,active:false});
    art+=muscle(b,c,e,f,4,'forearms',ctx,{shift:-3,active:false});
    art+=translated(c,f,`<ellipse rx="4.4" ry="6" fill="url(#${ctx.uid}-bone)"/>`,ctx);
  }else{
    art+=muscle(a,b,d,e,20,back?'hamstrings':'quads',ctx,{shift:flip*2.1,active});
    art+=muscle(a,b,d,e,8.5,back?'quads':'hamstrings',ctx,{shift:flip*-7,active});
    art+=muscle(mix(a,b,.08),mix(a,b,.82),mix(d,e,.08),mix(d,e,.82),3.2,'sartorius',ctx,{shift:flip*6,active:false});
    art+=translated(b,e,`<ellipse rx="4.1" ry="5.1" fill="url(#${ctx.uid}-bone)" stroke="#344b3a" stroke-width=".6"/>`,ctx);
    art+=muscle(b,c,e,f,11,'calves',ctx,{shift:flip*-2,active:false});
    art+=muscle(b,c,e,f,4.8,'tibialis',ctx,{shift:flip*3.4,active:false});
  }
  return art;
}

function localTransform(p, x, y, width = 1) {
  const v=[p.hip[0]-p.shoulder[0],p.hip[1]-p.shoulder[1]],len=Math.hypot(...v)||1;
  const n=[v[1]/len,-v[0]/len];
  return [p.shoulder[0]+n[0]*x*width+v[0]*y,p.shoulder[1]+n[1]*x*width+v[1]*y];
}

function shapeOnTorso(points,a,b,key,ctx,side=1) {
  const make=p=>{
    const nodes=points.map(([x,y])=>localTransform(p,x*side,y));
    return `M${pt(mix(nodes.at(-1),nodes[0],.84))}${nodes.map((node,i)=>{const next=nodes[(i+1)%nodes.length];return `Q${pt(node)} ${pt(mix(node,next,.16))}L${pt(mix(node,next,.84))}`;}).join('')}Z`;
  };
  let art=path(make(a),make(b),fillFor(key,ctx,!(key==='lats'&&ctx.id==='dumbbell-row'&&side<0)),ctx,`data-muscle="${key}"`);
  const [origin,...rest]=points;
  const endpoint=rest[Math.floor(rest.length/2)];
  for(let i=1;i<=4;i++){
    const t=i/5;
    const target=[origin[0]+(endpoint[0]-origin[0])*t,origin[1]+(endpoint[1]-origin[1])*t];
    const start=points[points.length-1];
    art+=trace(line([localTransform(a,start[0]*side,start[1]),localTransform(a,target[0]*side,target[1])]),line([localTransform(b,start[0]*side,start[1]),localTransform(b,target[0]*side,target[1])]),ctx,'#e2ece4',.5,.23);
  }
  return art;
}

function torso(a,b,ctx,back=false,wide=1) {
  const outline=[[-20*wide,-.02],[-24*wide,.14],[-19*wide,.38],[-13*wide,.76],[-17*wide,1.06],[17*wide,1.06],[13*wide,.76],[19*wide,.38],[24*wide,.14],[20*wide,-.02]];
  let art=shapeOnTorso(outline,a,b,'body',ctx);
  for(const side of [-1,1]){
    if(back){
      art+=shapeOnTorso([[1,-.07],[19,.03],[21,.2],[9,.35],[1,.28]],a,b,'traps',ctx,side);
      art+=shapeOnTorso([[4,.29],[20,.18],[19,.47],[11,.78],[2,.91]],a,b,'lats',ctx,side);
      art+=shapeOnTorso([[1,.28],[5,.37],[5,.83],[2,.96]],a,b,'erectors',ctx,side);
    }else{
      art+=shapeOnTorso([[1,.04],[17,.01],[23,.1],[20,.23],[12,.33],[1,.29]],a,b,'chest',ctx,side);
      for(let i=0;i<3;i++)art+=shapeOnTorso([[1,.38+i*.145],[8,.37+i*.145],[8,.49+i*.145],[1,.5+i*.145]],a,b,'abs',ctx,side);
      art+=shapeOnTorso([[9,.41],[18,.34],[13,.68],[8,.85]],a,b,'obliques',ctx,side);
      for(let i=0;i<3;i++)art+=shapeOnTorso([[13,.32+i*.075],[19,.29+i*.075],[16,.38+i*.075],[11,.43+i*.075]],a,b,'serratus',ctx,side);
    }
  }
  art+=trace(line([localTransform(a,0,-.04),localTransform(a,0,.94)]),line([localTransform(b,0,-.04),localTransform(b,0,.94)]),ctx,'#c0cec2',.8,.3);
  return art;
}

function deltoid(a,b,c,d,ctx,key='middle-delt',active=true){
  const endA=mix(a,b,.48),endB=mix(c,d,.48);
  return muscle(add(a,-1,-3),endA,add(c,-1,-3),endB,11.5,key,ctx,{active});
}

const standing={head:[155,42],shoulder:[151,74],hip:[147,145],knee:[154,198],ankle:[156,250],elbow:[166,113],wrist:[172,155]};
const SIDE_POSES={
  'goblet-squat':[{...standing,elbow:[179,108],wrist:[180,76]},{head:[145,91],shoulder:[138,124],hip:[106,168],knee:[174,189],ankle:[156,250],elbow:[173,146],wrist:[170,119]}],
  'romanian-deadlift':[{...standing,wrist:[172,150]},{head:[219,106],shoulder:[187,116],hip:[117,148],knee:[146,198],ankle:[156,250],elbow:[188,160],wrist:[190,205]}],
  'reverse-lunge':[{head:[183,41],shoulder:[180,74],hip:[176,145],knee:[184,198],ankle:[190,250],farKnee:[154,198],farAnkle:[156,250],elbow:[200,110],wrist:[204,150]},{head:[171,81],shoulder:[165,115],hip:[153,172],knee:[194,192],ankle:[190,250],farKnee:[112,235],farAnkle:[67,250],elbow:[189,150],wrist:[192,188]}],
  'dumbbell-row':[{head:[116,75],shoulder:[139,105],hip:[199,141],knee:[188,197],ankle:[209,250],farKnee:[133,180],farAnkle:[104,250],elbow:[145,151],wrist:[153,197]},{head:[116,75],shoulder:[139,105],hip:[199,141],knee:[188,197],ankle:[209,250],farKnee:[133,180],farAnkle:[104,250],elbow:[190,109],wrist:[180,148]}],
  'push-up':[{head:[239,113],shoulder:[219,143],hip:[144,176],knee:[92,211],ankle:[44,250],elbow:[218,195],wrist:[218,253]},{head:[245,191],shoulder:[220,211],hip:[146,224],knee:[95,237],ankle:[44,250],elbow:[171,207],wrist:[218,253]}],
  'bench-press':[{head:[66,156],shoulder:[101,171],hip:[180,185],knee:[226,207],ankle:[230,250],elbow:[127,182],wrist:[134,130],farKnee:[243,207],farAnkle:[256,250]},{head:[66,156],shoulder:[101,171],hip:[180,185],knee:[226,207],ankle:[230,250],elbow:[108,118],wrist:[116,67],farKnee:[243,207],farAnkle:[256,250]}],
};

function bench(x,y,width){
 return `<path d="M${x+10} ${y+7}v${254-y}M${x+width-10} ${y+7}v${254-y}" stroke="#44584a" stroke-width="5"/><rect x="${x}" y="${y}" width="${width}" height="11" rx="3" fill="#26382c" stroke="#6b8170" stroke-width="1"/><path d="M${x+5} ${y+2}h${width-10}" stroke="#87998a" stroke-width="1"/>`;
}

function sideBody(id,ctx){
  const [a,b]=SIDE_POSES[id];
  const back=id==='romanian-deadlift'||id==='dumbbell-row';
  const far=p=>[add(p.hip,-5),p.farKnee||add(p.knee,17),p.farAnkle||add(p.ankle,20)];
  const fa=far(a),fb=far(b);
  let art='';
  if(id==='bench-press')art+=bench(50,199,143);
  if(id==='dumbbell-row')art+=bench(58,177,83);
  art+=`<g opacity=".5">${limb(...fa,...fb,ctx,{back,active:id!=='reverse-lunge'})}${foot(fa[2],fb[2],ctx,id==='reverse-lunge'?-1:1)}</g>`;
  const farArm=id==='dumbbell-row'?[[129,109],[106,141],[104,173]]:[add(a.shoulder,-6),add(a.elbow,-8),add(a.wrist,-9)];
  const farEnd=id==='dumbbell-row'?farArm:[add(b.shoulder,-6),add(b.elbow,-8),add(b.wrist,-9)];
  art+=`<g opacity=".45">${limb(...farArm,...farEnd,ctx,{arm:true,active:id!=='dumbbell-row'})}</g>`;
  art+=limb(a.hip,a.knee,a.ankle,b.hip,b.knee,b.ankle,ctx,{back,active:true});
  art+=foot(a.ankle,b.ankle,ctx);
  art+=muscle(add(a.hip,-9,-9),add(a.hip,0,15),add(b.hip,-9,-9),add(b.hip,0,15),18,'glutes',ctx);
  art+=torso(a,b,ctx,back,.8);
  art+=bone(add(a.head,0,12),a.shoulder,add(b.head,0,12),b.shoulder,10,ctx);
  art+=muscle(add(a.head,-5,10),add(a.shoulder,-4,-3),add(b.head,-5,10),add(b.shoulder,-4,-3),3.5,'neck',ctx);
  art+=head(a.head,b.head,ctx,true);
  art+=limb(a.shoulder,a.elbow,a.wrist,b.shoulder,b.elbow,b.wrist,ctx,{arm:true,back:id==='bench-press'||id==='push-up'});
  art+=deltoid(a.shoulder,a.elbow,b.shoulder,b.elbow,ctx,back?'rear-delt':'front-delt');
  if(id==='goblet-squat')art+=weight(add(a.wrist,3,-3),add(b.wrist,3,-3),ctx,true);
  if(['bench-press','dumbbell-row','romanian-deadlift'].includes(id))art+=weight(a.wrist,b.wrist,ctx);
  return art;
}

const FRONT_ARMS={
  'shoulder-press':[{elbow:[104,119],wrist:[104,72]},{elbow:[114,47],wrist:[131,8]}],
  'bicep-curl':[{elbow:[124,130],wrist:[115,179]},{elbow:[124,130],wrist:[122,83]}],
  'lateral-raise':[{elbow:[120,132],wrist:[112,179]},{elbow:[84,88],wrist:[33,92]}],
};
function frontBody(id,ctx){
  const [a,b]=FRONT_ARMS[id];
  const mirror=p=>[320-p[0],p[1]];
  const body={shoulder:[160,78],hip:[160,157]};
  let art='';
  for(const flip of [false,true]){
    const t=flip?mirror:p=>p;
    const hip=t([148,157]),knee=t([141,205]),ankle=t([136,254]);
    art+=limb(hip,knee,ankle,hip,knee,ankle,ctx,{active:false,flip:flip?-1:1});
    art+=foot(ankle,ankle,ctx,flip?1:-1);
  }
  art+=torso(body,body,ctx,false,1.2);
  art+=bone([160,65],[160,78],[160,65],[160,78],10,ctx);
  for(const flip of [false,true]){
    const t=flip?mirror:p=>p;
    const shoulder=t([134,82]);
    art+=limb(shoulder,t(a.elbow),t(a.wrist),shoulder,t(b.elbow),t(b.wrist),ctx,{arm:true,flip:flip?-1:1});
    art+=deltoid(shoulder,t(a.elbow),shoulder,t(b.elbow),ctx,id==='lateral-raise'?'middle-delt':'front-delt');
    art+=weight(t(a.wrist),t(b.wrist),ctx);
  }
  return art+head([160,51],[160,51],ctx);
}

function svgFrame(exercise,art,ctx,{large=false,map=false}={}){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" class="exercise-demo anatomy-figure${large?' exercise-demo-large':''}${map?' anatomy-map':''}" role="img" aria-label="${exercise.name} ${map?'muscle map':'anatomical movement demonstration'}" data-exercise="${exercise.id}" data-duration="${DEMO_DURATION}" style="width:100%;height:100%;overflow:visible"><title>${exercise.name}: ${ctx.info.primary.join(', ')}</title><desc>Schematic exercise illustration. Colours indicate movement phases and do not measure muscle force or activation.</desc>${defs(ctx)}<ellipse cx="160" cy="292" rx="88" ry="7" fill="#020705" opacity=".45"/>${art}</svg>`;
}

export function renderDemo(exercise,{large=false,paused=false,respectReducedMotion=true}={}){
  const info=MUSCLES[exercise.id];
  if(!info)return '';
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ctx={uid:`anatomy-${++svgSerial}`,id:exercise.id,info,dynamic:!paused&&!(respectReducedMotion&&reduced),phase:'shortening'};
  const body=SIDE_POSES[exercise.id]?sideBody(exercise.id,ctx):frontBody(exercise.id,ctx);
  return svgFrame(exercise,`<g transform="translate(0 21)">${body}</g>`,ctx,{large});
}

function mapBody(ctx,view,id){
  const back=view==='back';
  const body={shoulder:[160,83],hip:[160,165]};
  let art='';
  for(const side of [-1,1]){
    const active=id!=='reverse-lunge'||side===1;
    const hip=[160+side*13,164],knee=[160+side*20,214],ankle=[160+side*23,270];
    art+=limb(hip,knee,ankle,hip,knee,ankle,ctx,{back,active,flip:side});
    art+=foot(ankle,ankle,ctx,side);
    if(back)art+=muscle([160+side*12,153],[160+side*14,180],[160+side*12,153],[160+side*14,180],17,'glutes',ctx,{active});
  }
  art+=torso(body,body,ctx,back,1.28);
  art+=bone([160,68],[160,83],[160,68],[160,83],11,ctx);
  for(const side of [-1,1]){
    const shoulder=[160+side*29,87],elbow=[160+side*43,133],wrist=[160+side*53,181];
    const armActive=id!=='dumbbell-row'||side===1;
    art+=limb(shoulder,elbow,wrist,shoulder,elbow,wrist,ctx,{arm:true,back,active:armActive,flip:side});
    art+=deltoid(shoulder,elbow,shoulder,elbow,ctx,back?'rear-delt':id==='lateral-raise'?'middle-delt':'front-delt',armActive);
    art+=muscle([160+side*5,68],[160+side*13,83],[160+side*5,68],[160+side*13,83],3,'neck',ctx);
  }
  return art+head([160,54],[160,54],ctx);
}

export function renderAnatomy(exercise,{view,phase='shortening'}={}){
  const info=MUSCLES[exercise.id];
  if(!info)return '';
  const ctx={uid:`anatomy-${++svgSerial}`,id:exercise.id,info,dynamic:false,phase:['shortening','lengthening','neutral'].includes(phase)?phase:'neutral'};
  return svgFrame(exercise,mapBody(ctx,view||info.view,exercise.id),ctx,{map:true});
}
