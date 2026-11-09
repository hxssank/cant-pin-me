import { EXERCISES, getExercise } from './exercises.js';
import { ANIMATED_EXERCISE_IDS, FIRST_LOWERING_IDS } from './motion-catalog.js';
import { filterExercises, exercisePoster } from './exercise-library.js';
import { todayKey, validateState, addMonths, calculateStats, completeWorkout } from './model.js';
import { MOVEMENT_SCIENCE, COLOR_EXPLANATION } from './movement-science.js';
import { getMuscleStats } from './muscle-stats.js';
import { createPersistence } from './persistence.js';
import { previousSets, exerciseHistory, workoutTotals, elapsedSeconds, restRemaining, buildCompletedSession } from './workout.js';

const icons = {
  summary: '<circle cx="12" cy="12" r="9"/><path d="M12 6a6 6 0 1 1-6 6m6-3a3 3 0 1 1-3 3"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  train: '<rect x="3" y="7" width="4" height="10" rx="1.5"/><rect x="17" y="7" width="4" height="10" rx="1.5"/><path d="M7 12h10M1 10v4m22-4v4"/>',
  plan: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2"/>',
  library: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  progress: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flame: '<path d="M12 3c1 5-5 5-5 10 0 2 1 4 3 5-1-4 3-5 3-8 4 3 5 5 4 8 2-2 3-4 2-7-1-4-4-6-7-8Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 2h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 5 4 4M4 20l5-1L20 8a3 3 0 0 0-4-4L5 15z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  settings: '<path d="M5 7h14M5 17h14"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  leaf: '<path d="M20 3c-8-2-16 2-16 9a7 7 0 0 0 7 7c6 0 9-7 9-16ZM4 21l10-10"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.train}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid = () => crypto.randomUUID();
const fmt = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {month:'short',day:'numeric'});
const longDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {month:'long',day:'numeric',year:'numeric'});
const persistence = createPersistence();
const loaded = { state: persistence.state, error: persistence.error };
let state = loaded.state;
const exercise3d = new Set(ANIMATED_EXERCISE_IDS);
let view = 'summary';
let homeCleanup = null;
let homeEpoch = 0;
let selectedDay = 0;
let libraryQuery = '';
let muscleFilter = 'All';
let equipmentFilter = 'All';
let guideFilter = 'all';
const duration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const setTypeName = type => ({warmup:'Warm-up',drop:'Drop set',failure:'Failure'}[type]||'Normal');
const number = value => Number(value).toLocaleString(undefined,{maximumFractionDigits:1});
let modal = null;
let planDraft = null;
let planDraftOriginal = null;
let toastTimer;
let modalTrigger = null;
let animationCleanup = null;
let workoutPosition = { scroll: 0, focus: null };
let workoutPositionId = null;
let lastSaveError = loaded.error;
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const plan = () => state.plans.find(item => item.id === state.activePlanId) || state.plans.at(-1);
const day = () => plan().days[Math.min(selectedDay, plan().days.length - 1)];
const stats = () => calculateStats(state);
const exerciseName = id => getExercise(id)?.name || id;
const effortMinutes = d => Math.round(d.exercises.reduce((sum, ex) => sum + ex.sets * 2.5, 0) + 5);
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return todayKey(d); };
const blockWeek = () => Math.max(1, Math.floor((new Date(`${todayKey()}T12:00:00`) - new Date(`${plan().startDate}T12:00:00`)) / 604800000) + 1);
const blockWeeks = () => Math.ceil((new Date(`${plan().endDate}T12:00:00`) - new Date(`${plan().startDate}T12:00:00`)) / 604800000);
const activeBlock = () => todayKey() >= plan().startDate && todayKey() < plan().endDate;
function chooseNextDay() {
  const completed = new Set(state.sessions.filter(s => s.planId === plan().id && s.date >= weekStart() && s.date <= todayKey()).map(s => s.dayId));
  const next = plan().days.findIndex(d => !completed.has(d.id));
  selectedDay = Math.max(0, next);
}
chooseNextDay();

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 4500);
}
function updateSaveStatus() {
  document.querySelectorAll('[data-save-status]').forEach(el => el.textContent = lastSaveError ? 'Changes not saved' : 'Saved on this device');
  document.querySelectorAll('.saved-dot').forEach(el => el.classList.toggle('unsaved', Boolean(lastSaveError)));
  const draftStatus = modalRoot.querySelector('[data-draft-status]');
  if (draftStatus) draftStatus.textContent = lastSaveError ? 'Changes not saved. Check your entries or export a backup.' : 'Draft saved on this device';
}
function persist(next = state, options = {}) {
  try { persistence.save(next, options); state = next; lastSaveError = null; updateSaveStatus(); return true; }
  catch (error) { lastSaveError = error.message; updateSaveStatus(); toast(lastSaveError); return false; }
}
function navigate(next) { view = next; render(); window.scrollTo({top:0,behavior:'instant'}); app.querySelector('h1')?.focus({preventScroll:true}); }
function render() {
  homeCleanup?.();homeCleanup=null;homeEpoch+=1;
  const navigation=[['summary','Summary'],['history','History'],['train','Workout'],['library','Exercises'],['progress','Progress']];
  app.innerHTML=`<div class="mobile-app ${state.draft?'has-draft':''}"><a class="skip-link" href="#main-content">Skip to content</a>
    <header class="app-header"><a class="brand" href="#" aria-label="Can't Pin Me home" data-nav="summary"><span class="brand-symbol" aria-hidden="true">${icon('train')}</span><span>can't pin me<span class="brand-period">.</span></span></a><button class="icon-button settings-button" data-action="settings" aria-label="Settings and backup">${icon('settings')}</button></header>
    <main id="main-content" tabindex="-1">${lastSaveError?`<div class="notice error">${esc(lastSaveError)} <button data-action="settings">Open backup tools</button></div>`:''}${view==='train'?trainView():view==='summary'?summaryView():view==='history'?historyView():view==='plan'?planView():view==='library'?libraryView():progressView()}</main>
    ${state.draft?`<button class="active-workout-bar" data-action="log"><span class="active-pulse"></span><span><strong>${esc(state.draft.dayName)}</strong><small>Workout in progress · <span data-elapsed>${duration(elapsedSeconds(state.draft))}</span></small></span><span>Resume ${icon('chevron')}</span></button>`:''}
    <nav class="bottom-nav" aria-label="Main navigation">${navigation.map(([key,label])=>`<button data-nav="${key}" class="${view===key?'active':''}" ${view===key?'aria-current="page"':''}>${icon(key)}<span>${label}</span></button>`).join('')}</nav></div>`;
  bindApp();
  if(view==='summary'&&!modal)mountHomeAvatar();
}

function heading(eyebrow,title,description,action='') {
  return `<div class="page-heading"><div>${eyebrow?`<p class="eyebrow">${eyebrow}</p>`:''}<h1 tabindex="-1">${title}</h1>${description?`<p class="heading-description">${description}</p>`:''}</div>${action}</div>`;
}
function avatarOverview() {
  const s=stats(),goal=plan().days.length,remaining=Math.max(0,goal-s.weekCount);
  return `<section class="avatar-overview" aria-label="Weekly training overview"><div class="avatar-week-backdrop" aria-hidden="true"><div class="avatar-orbit"></div></div><div class="avatar-week-copy"><span class="eyebrow">THIS WEEK</span><strong>${s.weekCount}<small> / ${goal}</small></strong><span>workouts</span></div><div class="home-avatar-stage" id="home-avatar-stage" aria-label="3D anatomy model"></div><div class="home-avatar-status" id="home-avatar-status" role="status">Loading model</div><div class="avatar-week-footer"><span>${remaining?`${remaining} ${remaining===1?'workout':'workouts'} to your goal`:'Weekly goal reached'}</span><span class="avatar-key">${s.weekCount?'<i></i>Blue marks muscles trained this week':'No workouts logged this week'}</span></div><span class="avatar-rotate">Drag to rotate</span></section>`;
}
function readableMuscleName(name) {
  return name.replace(/[()]/g,'').replace(/\.([lr])$/i,(_,side)=>side.toLowerCase()==='l'?' (left)':' (right)').replace(/\.o\d+[lr]?$/i,'').replace(/_/g,' ');
}
function loadAnatomyModule() {
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The 3D viewer took too long to load.')),30000);});
  return Promise.race([import('./anatomy-viewer.js'),timeout]).finally(()=>clearTimeout(timer));
}
function mountHomeAvatar() {
  const container=document.querySelector('#home-avatar-stage'),epoch=homeEpoch;if(!container)return;
  let viewer,closed=false;homeCleanup=()=>{closed=true;viewer?.dispose();};
  const status=document.querySelector('#home-avatar-status');
  status.hidden=false;status.textContent='Loading model';
  const fail=()=>{if(closed)return;viewer?.dispose();viewer=null;status.innerHTML='The body model could not load. <button type="button" class="viewer-retry">Try again</button>';status.querySelector('button').addEventListener('click',()=>{homeCleanup?.();mountHomeAvatar();});};
  loadAnatomyModule().then(({mountAnatomyViewer})=>{
    if(closed||epoch!==homeEpoch||!container.isConnected)return;
    viewer=mountAnatomyViewer(container,{exerciseId:null,initialMode:'anatomy',overview:true,onError:fail});
    return viewer.ready.then(()=>{
      if(closed)return;status.hidden=true;
      const muscleStats=new Map();viewer.setExposure(name=>{if(!muscleStats.has(name))muscleStats.set(name,getMuscleStats(state,name));const data=muscleStats.get(name);return data.mapped&&(data.weekPrimarySets+data.weekSecondarySets+data.weekStabilizerSets)>0;});
    });
  }).catch(fail);
}

function activityCard() {
  const s=stats(),goal=plan().days.length;
  return `<section class="activity-overview"><div class="activity-copy"><span class="eyebrow">THIS WEEK</span><h2>${s.weekCount}<span> / ${goal}</span></h2><p>Workouts completed</p><span class="activity-goal">${Math.max(0,goal-s.weekCount)?`${Math.max(0,goal-s.weekCount)} to your weekly goal`:'Weekly goal reached'}</span></div><div class="activity-rings" style="--progress:${Math.min(100,s.weekCount/goal*100)}" role="img" aria-label="${s.weekCount} of ${goal} weekly workouts"><strong>${icon('train')}</strong></div></section>`;
}
function weekCalendar() {
  return `<div class="week-calendar" aria-label="Training this week">${stats().weeklyActivity.map(a=>`<div class="calendar-day ${a.date===todayKey()?'today':''} ${a.count?'completed':''}" aria-label="${esc(longDate(a.date))}, ${a.count} workouts"><span>${a.label}</span><strong>${a.count?icon('check'):new Date(`${a.date}T12:00:00`).getDate()}</strong><i></i></div>`).join('')}</div>`;
}
function trainView() {
  const p=plan();
  return `<div class="workout-home">${heading('','Workout','',`<button class="text-button" data-action="edit-plan">Edit routines</button>`)}
    <button class="button primary full-width quick-start" data-action="empty-workout">${icon('plus')} Start empty workout</button>
    <div class="section-top routines-heading"><h2>My routines</h2><button class="icon-button" data-action="new-routine" aria-label="New routine">${icon('plus')}</button></div><button class="routine-folder" data-nav="plan">${icon('plan')}<span>${esc(p.name)}</span><small>${p.days.length} routines</small>${icon('chevron')}</button>
    <div class="routine-grid">${p.days.map((d,i)=>`<section class="routine-card"><div class="routine-card-top"><span class="routine-marker">${icon(i%2?'flame':'train')}</span><div class="routine-title"><h3>${esc(d.name)}</h3><p>${esc(d.focus)}</p></div><button class="routine-menu icon-button" data-routine="${i}" aria-label="View ${esc(d.name)} routine">${icon('more')}</button></div><p class="routine-preview">${d.exercises.map(e=>esc(exerciseName(e.exerciseId))).join(', ')}</p><div class="routine-meta"><span>${d.exercises.length} exercises</span><span>${d.exercises.reduce((n,e)=>n+e.sets,0)} sets</span><span>~${effortMinutes(d)} min</span></div><button class="button routine-start full-width" data-log-day="${i}">${state.draft?'Resume workout':'Start routine'}${icon('play')}</button></section>`).join('')}</div>
    <div class="section-top history-title"><h2>This week</h2><button class="text-button" data-nav="summary">Summary ${icon('chevron')}</button></div>${weekCalendar()}<div class="device-note"><span class="saved-dot ${lastSaveError?'unsaved':''}"></span><span data-save-status>${lastSaveError?'Changes not saved':'Saved on this device'}</span></div></div>`;
}
function summaryView() {
  const s=stats();
  return `<div class="summary-page">${heading(new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}),'Summary','')}${avatarOverview()}${weekCalendar()}
    <section class="progress-totals"><div><span>Sets completed</span><strong>${s.totalSets}</strong><small>All time</small></div><div><span>Volume</span><strong>${number(s.totalVolume)}<small> kg</small></strong><small>Weight × reps, all time</small></div></section></div>`;
}
function historyView() {
  const sessions=[...state.sessions].sort((a,b)=>b.date.localeCompare(a.date)||b.completedAt.localeCompare(a.completedAt));
  return `${heading('','History',`${sessions.length} saved ${sessions.length===1?'workout':'workouts'}`)}${sessions.length?`<div class="history-list">${sessions.map(historyRow).join('')}</div>`:'<div class="empty-state"><h3>No workouts yet</h3><p>Finish a workout to keep its sets, reps, and weights here.</p><button class="button primary full-width" data-nav="train">Start a workout</button></div>'}`;
}
function openRoutine(index) {
  selectedDay=index;const d=day();modal={type:'routine'};
  showModal(`<div class="modal-header"><div><span class="eyebrow">${esc(plan().name)}</span><h2 id="modal-title">${esc(d.name)}</h2><p>${esc(d.focus)} · ${d.exercises.length} exercises</p></div>${closeButton()}</div><div class="settings-content"><div class="exercise-list">${d.exercises.map(exerciseRow).join('')}</div><button class="button primary full-width" id="routine-start">${state.draft?'Resume workout':'Start routine'}${icon('play')}</button><button class="button secondary full-width" id="routine-edit">Edit routines ${icon('edit')}</button></div>`,'routine-modal');
  modalRoot.querySelectorAll('[data-exercise]').forEach(el=>el.addEventListener('click',()=>openDemo(el.dataset.exercise)));
  modalRoot.querySelector('#routine-start').addEventListener('click',()=>openLog());
  modalRoot.querySelector('#routine-edit').addEventListener('click',()=>openPlanEditor(false));
}

function exerciseRow(item,index) {
  const e=getExercise(item.exerciseId);
  return `<button class="exercise-row" data-exercise="${esc(item.exerciseId)}"><span class="exercise-thumbnail">${exerciseThumbnail(item.exerciseId)}</span><span class="exercise-info"><span class="exercise-order">${String(index+1).padStart(2,'0')} <span>${esc(e?.muscle||'Custom exercise')}</span></span><strong>${esc(e?.name||item.exerciseId)}</strong><span class="exercise-prescription">${item.sets} sets <i>×</i> ${item.reps} reps</span></span><span class="exercise-play">${icon('play')}</span></button>`;
}
function planView() {
  const p=plan();
  return `${heading('YOUR PROGRAM','Training plan','',`<button class="icon-button heading-action" data-action="edit-plan" aria-label="Edit plan">${icon('edit')}</button>`)}
    <section class="plan-banner"><span class="eyebrow">BLOCK ${String(state.plans.findIndex(x=>x.id===p.id)+1).padStart(2,'0')}</span><h2>${esc(p.name)}</h2><p>${fmt(p.startDate)} to ${fmt(p.endDate)}</p><div class="plan-banner-stats"><span><strong>${p.days.length}</strong>days / week</span><span><strong>3</strong>months</span><span><strong>${p.days.reduce((n,d)=>n+d.exercises.length,0)}</strong>exercises</span></div></section>
    <div class="plan-day-grid">${p.days.map((d,i)=>`<section class="plan-day-card"><div class="section-top"><span class="eyebrow">DAY ${String(i+1).padStart(2,'0')}</span><span class="muted">~${effortMinutes(d)} min</span></div><h2>${esc(d.name)}</h2><p>${esc(d.focus)}</p><div class="plan-exercises">${d.exercises.map(ex=>`<button data-exercise="${esc(ex.exerciseId)}"><span>${esc(exerciseName(ex.exerciseId))}</span><strong>${ex.sets} × ${ex.reps}</strong>${icon('chevron')}</button>`).join('')}</div><button class="button secondary full-width" data-log-day="${i}">${state.draft?'Continue unfinished workout':'Start workout'} ${icon('arrow')}</button></section>`).join('')}</div>
    <section class="next-block"><h3>Next training block</h3><p>Start a new three-month plan. Your completed workouts stay in your history.</p><button class="button secondary full-width" data-action="new-block">${icon('plus')} New block</button></section>
    ${state.plans.length>1?`<section class="block-history"><h2>Previous blocks</h2>${state.plans.filter(x=>x.id!==p.id).map(x=>`<div><strong>${esc(x.name)}</strong><span>${fmt(x.startDate)} to ${fmt(x.endDate)}</span><span>${state.sessions.filter(s=>s.planId===x.id).length} workouts</span></div>`).join('')}</section>`:''}`;
}
function exerciseThumbnail(id) {
  const poster=exercisePoster(id);
  return poster?`<img class="exercise-poster" src="${poster}" alt="" width="640" height="480" loading="lazy" decoding="async">`:`<span class="reference-thumbnail" aria-hidden="true">${icon('train')}</span>`;
}
function libraryResults(filtered) {
  return filtered.map(e=>`<button class="library-card" data-exercise="${esc(e.id)}"><span class="library-demo">${exerciseThumbnail(e.id)}</span><span class="library-card-info"><span class="eyebrow">${esc(e.muscle)}</span><strong>${esc(e.name)}</strong><span>${esc(e.equipment)}</span><span class="anatomy-link">${exercise3d.has(e.id)?'3D movement':'Form guide'} ${icon('arrow')}</span></span></button>`).join('')||'<div class="empty-state"><h3>No matching exercises</h3><p>Try another search or reset the filters.</p><button class="button secondary" id="reset-library-filters">Reset filters</button></div>';
}
function updateLibraryResults() {
  const filtered=filterExercises(EXERCISES,{query:libraryQuery,muscle:muscleFilter,equipment:equipmentFilter,guide:guideFilter});
  app.querySelector('.library-grid').innerHTML=libraryResults(filtered);
  app.querySelector('#library-count').textContent=`${filtered.length} ${filtered.length===1?'exercise':'exercises'}`;
  app.querySelectorAll('[data-guide-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.guideFilter===guideFilter)));
}
function libraryView() {
  const muscles=['All',...new Set(EXERCISES.flatMap(e=>e.muscle.split(' · ')))];
  const equipment=['All',...new Set(EXERCISES.flatMap(e=>e.equipment.split(' · ').map(x=>x.replace(/^Dumbbells$/, 'Dumbbell'))))];
  const filtered=filterExercises(EXERCISES,{query:libraryQuery,muscle:muscleFilter,equipment:equipmentFilter,guide:guideFilter});
  return `${heading('','Exercises',`${EXERCISES.length} exercises. ${exercise3d.size} interactive movement guides.`)}
    <div class="search-box">${icon('search')}<input id="exercise-search" type="search" placeholder="Search exercises" value="${esc(libraryQuery)}" aria-label="Search exercises"></div>
    <div class="guide-filters" role="group" aria-label="Guide type"><button data-guide-filter="all" aria-pressed="${guideFilter==='all'}">All exercises <span>${EXERCISES.length}</span></button><button data-guide-filter="animated" aria-pressed="${guideFilter==='animated'}">3D animations <span>${exercise3d.size}</span></button></div>
    <div class="library-controls"><label class="select-wrap"><span class="sr-only">Muscle group</span><select id="muscle-filter">${muscles.map(m=>`<option value="${esc(m)}" ${m===muscleFilter?'selected':''}>${m==='All'?'All muscles':esc(m)}</option>`).join('')}</select>${icon('chevron')}</label><label class="select-wrap"><span class="sr-only">Equipment</span><select id="equipment-filter">${equipment.map(m=>`<option value="${esc(m)}" ${m===equipmentFilter?'selected':''}>${m==='All'?'All equipment':esc(m)}</option>`).join('')}</select>${icon('chevron')}</label><span class="muted" id="library-count" role="status">${filtered.length} ${filtered.length===1?'exercise':'exercises'}</span></div>
    <div class="library-grid">${libraryResults(filtered)}</div>`;
}
function historyRow(session) {
  const t=workoutTotals(session.exercises);
  return `<button class="history-card" data-session="${esc(session.id)}"><div class="history-card-header"><span class="history-icon">${icon('train')}</span><span><strong>${esc(session.dayName)}</strong><small>${longDate(session.date)}</small></span>${icon('chevron')}</div><div class="history-metrics"><span>${icon('clock')}${session.durationSeconds===undefined?'Duration not recorded':duration(session.durationSeconds)}</span><span>${number(t.volume)} kg</span><span>${t.sets} sets</span></div><div class="history-exercises">${session.exercises.slice(0,3).map(e=>`<span><b>${e.sets.length} ×</b> ${esc(e.name)}</span>`).join('')}${session.exercises.length>3?`<small>+${session.exercises.length-3} more exercises</small>`:''}</div></button>`;
}

function progressView() {
  const s=stats(),ids=[...new Set(state.sessions.flatMap(x=>x.exercises.map(e=>e.exerciseId)))];
  return `${heading('','Progress','Your logged training, over time.',`<button class="icon-button heading-action" data-action="export" aria-label="Export backup">${icon('download')}</button>`)}
    <section class="progress-totals"><div><span>Workouts</span><strong>${s.sessions}</strong></div><div><span>Week streak</span><strong>${s.streak}</strong></div><div><span>Sets completed</span><strong>${s.totalSets}</strong></div><div><span>Volume <small>kg × reps</small></span><strong>${number(s.totalVolume)}</strong></div></section>
    <div class="section-top history-title"><h2>Exercise progress</h2><span class="muted">${ids.length} ${ids.length===1?'exercise':'exercises'}</span></div><div class="exercise-trends">${ids.map(id=>{const h=exerciseHistory(state,id),latest=h.at(-1);return `<button class="trend-row" data-trend="${esc(id)}"><span class="history-icon">${icon('progress')}</span><span><strong>${esc(exerciseName(id))}</strong><small>${h.length} ${h.length===1?'workout':'workouts'} · Last ${fmt(latest.date)}</small></span><b>${number(Math.max(...h.map(x=>x.bestWeight)))}<small> kg best</small></b>${icon('chevron')}</button>`;}).join('')||'<div class="empty-state"><h3>Build your training history</h3><p>Your best weights and session volume appear after your first saved workout.</p><button class="button primary full-width" data-nav="train">Choose a workout</button></div>'}</div>`;
}

function focusDayTab() {
  const tab=app.querySelector(`[role="tab"][data-day="${selectedDay}"]`);
  tab?.focus({preventScroll:true});
  tab?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function bindApp() {
  app.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();navigate(el.dataset.nav);}));
  app.querySelectorAll('[data-day]').forEach(el=>el.addEventListener('click',()=>{selectedDay=Number(el.dataset.day);render();focusDayTab();}));
  app.querySelectorAll('button[data-exercise]:not(.library-card)').forEach(el=>el.addEventListener('click',()=>openDemo(el.dataset.exercise)));
  app.querySelectorAll('[data-log-day]').forEach(el=>el.addEventListener('click',()=>{selectedDay=Number(el.dataset.logDay);openLog();}));
  app.querySelectorAll('[data-routine]').forEach(el=>el.addEventListener('click',()=>openRoutine(Number(el.dataset.routine))));
  app.querySelectorAll('[data-trend]').forEach(el=>el.addEventListener('click',()=>openExerciseHistory(el.dataset.trend)));
  app.querySelectorAll('[data-session]').forEach(el=>el.addEventListener('click',()=>openHistory(el.dataset.session)));
  app.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>({log:()=>openLog(),'empty-workout':()=>openLog(true),'new-routine':openNewRoutine,'edit-plan':()=>openPlanEditor(false),'new-block':()=>openPlanEditor(true),settings:openSettings,export:exportData})[el.dataset.action]?.()));
  app.querySelector('[role="tablist"]')?.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const count=plan().days.length;
    selectedDay=event.key==='Home'?0:event.key==='End'?count-1:(selectedDay+(event.key==='ArrowRight'?1:-1)+count)%count;
    render();focusDayTab();
  });
  const search=app.querySelector('#exercise-search');
  search?.addEventListener('input',()=>{libraryQuery=search.value;updateLibraryResults();});
  app.querySelectorAll('[data-guide-filter]').forEach(button=>button.addEventListener('click',()=>{guideFilter=button.dataset.guideFilter;updateLibraryResults();}));
  app.querySelector('.library-grid')?.addEventListener('click',event=>{
    const exercise=event.target.closest('[data-exercise]');
    if(exercise){openDemo(exercise.dataset.exercise);return;}
    if(event.target.closest('#reset-library-filters')){
      libraryQuery='';muscleFilter='All';equipmentFilter='All';guideFilter='all';
      search.value='';app.querySelector('#muscle-filter').value='All';app.querySelector('#equipment-filter').value='All';
      updateLibraryResults();search.focus();
    }
  });
  app.querySelector('#equipment-filter')?.addEventListener('change',event=>{equipmentFilter=event.target.value;updateLibraryResults();});
  app.querySelector('#muscle-filter')?.addEventListener('change',event=>{muscleFilter=event.target.value;updateLibraryResults();});
}
function workoutFocusSelector(element) {
  if(!element || !element.closest('.log-modal'))return null;
  if(element.id)return `#${CSS.escape(element.id)}`;
  for(const attr of ['data-complete','data-previous','data-add-set','data-set-menu','data-ex-options','data-log-demo','data-log-history','data-rest']) {
    if(element.hasAttribute(attr))return `[${attr}="${CSS.escape(element.getAttribute(attr))}"]`;
  }
  if(element.hasAttribute('data-field'))return `[data-field="${CSS.escape(element.dataset.field)}"][data-ei="${CSS.escape(element.dataset.ei)}"][data-si="${CSS.escape(element.dataset.si)}"]`;
  return null;
}
function rememberWorkoutPosition(element=document.activeElement) {
  const backdrop=modalRoot.querySelector('.modal-backdrop');
  if(!backdrop?.querySelector('.log-modal'))return;
  workoutPosition.scroll=backdrop.scrollTop;
  const selector=workoutFocusSelector(element);
  if(selector)workoutPosition.focus=selector;
}
function showModal(content,kind='',preserveFocus=false) {
  rememberWorkoutPosition();
  homeCleanup?.();homeCleanup=null;homeEpoch+=1;
  animationCleanup?.();animationCleanup=null;
  if(!modalRoot.firstElementChild) modalTrigger=document.activeElement;
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${kind}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">${content}</section></div>`;
  document.body.classList.add('modal-open');
  app.inert = true;
  modalRoot.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeModal));
  modalRoot.querySelector('.modal-backdrop').addEventListener('click',event=>{if(event.target===event.currentTarget) closeModal();});
  if(!preserveFocus || !modalRoot.contains(document.activeElement)) modalRoot.querySelector('.modal').focus();
}
function closeModal() {
  if(modal?.type==='plan' && JSON.stringify(planDraft)!==planDraftOriginal && !confirm('Discard your unsaved plan changes?'))return;
  animationCleanup?.();animationCleanup=null;
  rememberWorkoutPosition();
  if(modal?.fromLog&&state.draft){openLog();return;}
  const triggerId=modalTrigger?.id;
  const triggerData=modalTrigger?.dataset;
  modalRoot.innerHTML='';app.inert=false;document.body.classList.remove('modal-open');modal=null;render();
  const attribute=triggerData&&Object.keys(triggerData).find(key=>['nav','action','exercise','session','logDay'].includes(key));
  const selector=attribute?`[data-${attribute.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}="${CSS.escape(triggerData[attribute])}"]`:null;
  const target=triggerId?document.getElementById(triggerId):selector?app.querySelector(selector):null;
  (target||app.querySelector('h1'))?.focus({preventScroll:true});
}
const closeButton = () => `<button class="icon-button close-button" data-close aria-label="Close dialog">${icon('close')}</button>`;
function openDemo(id,fromLog=false) {
  const e=getExercise(id),science=MOVEMENT_SCIENCE[id];if(!e||!science)return;
  if(!exercise3d.has(id)){openFormGuide(e,science,fromLog);return;}
  const demo=science.demonstration;
  modal={type:'demo',id,fromLog};
  showModal(`<div class="demo-topbar"><button class="icon-button" data-close aria-label="Close dialog">${icon('chevron')}</button><span>Exercise guide</span><button class="text-button" id="exercise-history">History</button></div><div class="demo-heading"><p class="eyebrow">${esc(e.equipment)}</p><h2 id="modal-title">${esc(e.name)}</h2></div>
    <div class="demo-view-switch" role="group" aria-label="Guide view"><button class="active" data-demo-mode="movement" aria-pressed="true">3D movement</button><button data-demo-mode="anatomy" aria-pressed="false">Anatomy</button></div>
    <div id="three-panel"><div class="anatomy-stage"><div class="anatomy-viewport" id="anatomy-viewport"></div><div class="viewer-loading" id="viewer-status" role="status"><span class="loading-orbit"></span>Loading anatomical model</div><div class="phase-indicator" data-phase="hold" hidden><i></i><span id="phase-name">Loading</span><span id="phase-movement">Drag to rotate</span></div><div class="anatomy-selection" id="anatomy-selection" hidden></div><div class="viewer-hint">Drag to rotate · Tap a muscle</div></div>
    <div class="camera-controls" role="group" aria-label="Camera angle"><button data-camera="front">Front</button><button data-camera="side">Side</button><button data-camera="back">Back</button><button data-camera="three-quarter" aria-label="Reset 3D camera">Reset</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button></div>
    <div class="anatomy-layers"><label>Layer<select id="anatomy-layer" aria-label="Anatomy layer"><option value="muscles">Muscles + bones</option><option value="bones">Skeleton</option></select></label><label>Speed<select id="anatomy-speed" aria-label="Playback speed"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></label></div>
    <div class="demo-playback" id="demo-playback"><button class="play-toggle" aria-label="Pause animation" disabled>${icon('pause')}</button><div class="timeline"><input id="animation-position" aria-label="Animation position" type="range" min="0" max="6" step="0.01" value="0" disabled><div><span>One controlled repetition</span><span id="animation-time">0.0 / 6.0 s</span></div></div></div><div class="phase-presets" role="group" aria-label="Inspect movement phase"><button data-phase-preset="lifting"><i class="shortening-dot"></i>Lifting phase</button><button data-phase-preset="lowering"><i class="lengthening-dot"></i>Lowering phase</button></div></div>
    <div class="demo-detail"><section class="muscle-section"><div class="section-top"><h3>Muscles involved</h3><span class="muted">Main movers</span></div><div class="muscle-tags">${science.primary.map(m=>`<span>${esc(m)}</span>`).join('')}</div><p class="secondary-muscles">Assisting: ${science.secondary.length?science.secondary.map(esc).join(', '):'Not listed'}.</p><details class="stabilizer-details"><summary>Stabilizers</summary><p>${science.stabilizers.map(esc).join(', ')}.</p></details></section>
    <section class="form-cues"><h3>Setup & movement</h3><p>${esc(science.setup)}</p><ol class="cue-list">${science.cues.map(cue=>`<li>${esc(cue)}</li>`).join('')}</ol></section>
    <details class="anatomy-explanation"><summary>How to read this model ${icon('plus')}</summary><p><span class="shortening-text">Coral</span> marks the lifting phase. <span class="lengthening-text">Cyan</span> marks the lowering phase.</p><p>${esc(COLOR_EXPLANATION)}</p><p>${esc(science.mechanics)}</p><p>The anatomy comes from Z-Anatomy and BodyParts3D. The joint rig and exercise motion are illustrative adaptations, not a measured simulation of your body.</p></details>
    <details class="anatomy-explanation source-details"><summary>Sources & model credits ${icon('plus')}</summary>${science.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ${icon('arrow')}</a>`).join('')}<a href="${esc(demo.url)}" target="_blank" rel="noopener noreferrer">${esc(demo.title)} ${icon('arrow')}</a><p>Model and rendered previews adapted from Z-Anatomy by Gauthier Kervyn and BodyParts3D by the Database Center for Life Science. Modified rig, mesh reduction, exercise poses and Blender lighting for Cant Pin Me.</p><a href="./assets/anatomy/ATTRIBUTION.txt" target="_blank">Model attribution and license</a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">Adapted model: CC BY-SA 4.0</a><a href="./assets/anatomy/anatomy.glb" download>Download the adapted model</a></details>${fromLog?'<button class="button primary full-width" id="back-to-log">Back to workout</button>':''}</div>`,'demo-modal anatomy-demo');
  let viewer=null,closed=false,playing=true,currentMode='movement',loadGeneration=0;
  const viewport=modalRoot.querySelector('#anatomy-viewport'),status=modalRoot.querySelector('#viewer-status');
  const slider=modalRoot.querySelector('#animation-position'),toggle=modalRoot.querySelector('.play-toggle');
  animationCleanup=()=>{closed=true;viewer?.dispose();};
  modalRoot.querySelector('#exercise-history').addEventListener('click',()=>openExerciseHistory(id,fromLog));
  modalRoot.querySelector('#back-to-log')?.addEventListener('click',()=>openLog());
  const update=info=>{
    if(closed)return;playing=!info.paused;
    slider.value=String(info.time);slider.setAttribute('aria-valuetext',`${info.time.toFixed(1)} seconds, ${info.phase}`);
    modalRoot.querySelector('#animation-time').textContent=`${info.time.toFixed(1)} / 6.0 s`;
    toggle.innerHTML=icon(info.paused?'play':'pause');toggle.setAttribute('aria-label',info.paused?'Play animation':'Pause animation');
    modalRoot.querySelector('#phase-movement').textContent=info.mode==='anatomy'?'Drag to rotate':info.phase==='hold'?'Change direction':info.phase==='lifting'?science.concentric:science.eccentric;
    modalRoot.querySelector('#phase-name').textContent=info.mode==='anatomy'?'Anatomy':info.phase==='hold'?'Turnaround':info.phase==='lifting'?'Lifting':'Lowering';
    modalRoot.querySelector('.phase-indicator').dataset.phase=info.phase==='lifting'?'shortening':info.phase==='lowering'?'lengthening':'hold';
  };
  const controls=[...modalRoot.querySelectorAll('.camera-controls button, .anatomy-layers select, .phase-presets button, [data-demo-mode]'),toggle,slider];
  const phase=modalRoot.querySelector('.phase-indicator');
  const fail=generation=>{
    if(closed||generation!==loadGeneration)return;
    loadGeneration++;viewer?.dispose();viewer=null;controls.forEach(control=>control.disabled=true);phase.hidden=true;
    status.hidden=false;status.innerHTML='The 3D model could not load. The instructions are below. <button type="button" class="viewer-retry">Try again</button>';
    status.querySelector('button').addEventListener('click',loadViewer);
  };
  function loadViewer() {
    const generation=++loadGeneration;
    controls.forEach(control=>control.disabled=true);phase.hidden=true;status.hidden=false;
    status.innerHTML='<span class="loading-orbit"></span>Loading anatomical model';
    loadAnatomyModule().then(({mountAnatomyViewer})=>{
      if(closed||!viewport.isConnected)return;
      viewer=mountAnatomyViewer(viewport,{exerciseId:id,onUpdate:update,onSelect:selection=>{const label=modalRoot.querySelector('#anatomy-selection');label.hidden=!selection;if(selection)label.textContent=readableMuscleName(selection.name);},onError:()=>fail(generation)});
      return viewer.ready.then(()=>{if(closed||generation!==loadGeneration)return;status.hidden=true;phase.hidden=false;controls.forEach(control=>control.disabled=false);});
    }).catch(()=>fail(generation));
  }
  loadViewer();
  toggle.addEventListener('click',()=>viewer?.setPaused(playing));
  slider.addEventListener('input',()=>viewer?.setTime(Number(slider.value)));
  modalRoot.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>viewer?.setCamera(button.dataset.camera)));
  modalRoot.querySelector('#zoom-in').addEventListener('click',()=>viewer?.zoom(.86));modalRoot.querySelector('#zoom-out').addEventListener('click',()=>viewer?.zoom(1.16));
  modalRoot.querySelector('#anatomy-layer').addEventListener('change',event=>viewer?.setLayer(event.target.value));
  modalRoot.querySelector('#anatomy-speed').addEventListener('change',event=>viewer?.setSpeed(event.target.value));
  modalRoot.querySelectorAll('[data-phase-preset]').forEach(button=>button.addEventListener('click',()=>{const firstLowering=FIRST_LOWERING_IDS.includes(id);viewer?.setMode('movement');viewer?.setTime((button.dataset.phasePreset==='lowering')===firstLowering?1.62:4.38);}));
  modalRoot.querySelectorAll('[data-demo-mode]').forEach(button=>button.addEventListener('click',()=>{
    currentMode=button.dataset.demoMode;
    modalRoot.querySelector('#demo-playback').hidden=currentMode==='anatomy';modalRoot.querySelector('.phase-presets').hidden=currentMode==='anatomy';
    modalRoot.querySelectorAll('[data-demo-mode]').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});
    viewer?.setMode(currentMode);
  }));

}

function openFormGuide(e,science,fromLog) {
  modal={type:'demo',id:e.id,fromLog};
  showModal(`<div class="demo-topbar"><button class="icon-button" data-close aria-label="Close dialog">${icon('chevron')}</button><span>Exercise guide</span><button class="text-button" id="exercise-history">History</button></div><div class="demo-heading"><p class="eyebrow">${esc(e.equipment)}</p><h2 id="modal-title">${esc(e.name)}</h2></div><div class="demo-detail"><section class="muscle-section"><div class="section-top"><h3>Muscles involved</h3><span class="muted">Main movers</span></div><div class="muscle-tags">${science.primary.map(m=>`<span>${esc(m)}</span>`).join('')}</div><p class="secondary-muscles">Assisting: ${science.secondary.length?science.secondary.map(esc).join(', '):'Not listed'}.</p><details class="stabilizer-details"><summary>Stabilizers</summary><p>${science.stabilizers.map(esc).join(', ')}.</p></details></section><section class="form-cues"><h3>Setup & movement</h3><p>${esc(science.setup)}</p><ol class="cue-list">${science.cues.map(cue=>`<li>${esc(cue)}</li>`).join('')}</ol><p>${esc(science.mechanics)}</p></section><details class="anatomy-explanation source-details"><summary>Sources ${icon('plus')}</summary>${science.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ${icon('arrow')}</a>`).join('')}</details>${fromLog?'<button class="button primary full-width" id="back-to-log">Back to workout</button>':''}</div>`,'demo-modal anatomy-demo');
  modalRoot.querySelector('#exercise-history').addEventListener('click',()=>openExerciseHistory(e.id,fromLog));
  modalRoot.querySelector('#back-to-log')?.addEventListener('click',()=>openLog());
}

function openLog(empty=false) {
  if(persistence.recoveryRequired){toast('Restore a backup in Settings before starting a workout. Your original data is preserved.');openSettings();return;}
  if(!state.draft) {
    const d=day();
    const draft={id:uid(),loggingVersion:2,startedAt:new Date().toISOString(),pausedAt:null,pausedMs:0,restEndsAt:null,planId:plan().id,dayId:empty?'free-workout':d.id,dayName:empty?'Workout':d.name,date:todayKey(),notes:'',exercises:empty?[]:d.exercises.map(e=>newLogExercise(e.exerciseId,e.sets,e.reps))};
    if(!persist({...state,draft}))return;
  } else if(state.draft.loggingVersion!==2) {
    const draft=structuredClone(state.draft);
    draft.loggingVersion=2;draft.startedAt=new Date().toISOString();draft.pausedAt=null;draft.pausedMs=0;draft.restEndsAt=null;
    draft.exercises.forEach(e=>{e.restSeconds=90;e.sets.forEach(set=>{set.checked=Boolean(String(set.reps).trim()||String(set.weight).trim());set.type='normal';});});
    if(!persist({...state,draft}))return;
  }
  modal={type:'log'};renderLog();
}
function newLogExercise(id,count=3,targetReps=10) {
  return {exerciseId:id,name:exerciseName(id),restSeconds:90,targetReps,sets:Array.from({length:count},()=>({reps:'',weight:'',checked:false,type:'normal'}))};
}
function changeDraft(change) {
  const next=structuredClone(state);change(next.draft);
  return persist(next);
}
function renderLog(preserveFocus=false) {
  const draft=state.draft;if(!draft)return;
  if(workoutPositionId!==draft.id){workoutPositionId=draft.id;workoutPosition={scroll:0,focus:null};}
  rememberWorkoutPosition();
  modal={type:'log'};
  showModal(`<h2 id="modal-title" class="sr-only">Active workout</h2><div class="workout-topbar"><button class="icon-button minimize-workout" data-close aria-label="Minimize workout">${icon('chevron')}</button><span>Workout in progress</span><button class="finish-button" id="finish-workout">Finish</button></div>
    <div class="workout-title"><input aria-label="Workout name" id="workout-name" maxlength="60" value="${esc(draft.dayName)}"></div><div class="workout-stats"><button id="pause-workout" aria-label="${draft.pausedAt?'Resume':'Pause'} workout timer"><span>Duration ${icon(draft.pausedAt?'play':'pause')}</span><strong data-elapsed>${duration(elapsedSeconds(draft))}</strong></button><div><span>Volume</span><strong><span data-volume>0</span><small> kg</small></strong></div><div><span>Sets</span><strong data-completed>0</strong></div></div>
    <form id="workout-form"><div class="log-exercises">${draft.exercises.map((e,ei)=>{
      const previous=previousSets(state,e.exerciseId,draft.date);
      return `<section class="log-exercise"><div class="log-exercise-heading"><button type="button" class="log-thumbnail" data-log-demo="${esc(e.exerciseId)}" aria-label="View ${esc(e.name)} guide">${exerciseThumbnail(e.exerciseId)}</button><h3><button type="button" data-log-demo="${esc(e.exerciseId)}">${esc(e.name)}</button></h3><button type="button" class="icon-button" data-ex-options="${ei}" aria-label="${esc(e.name)} options">${icon('more')}</button></div>
      <div class="exercise-tools"><label>${icon('clock')}<span class="sr-only">Rest timer for ${esc(e.name)}</span><select aria-label="Rest timer for ${esc(e.name)}" data-rest="${ei}">${[0,30,60,90,120,150,180,240,300,600].map(n=>`<option value="${n}" ${n===(e.restSeconds??90)?'selected':''}>${n?`Rest ${duration(n)}`:'Rest off'}</option>`).join('')}</select></label><button type="button" class="text-button" data-log-history="${esc(e.exerciseId)}">History ${icon('chevron')}</button></div>
      <div class="set-header"><span>SET</span><span>PREVIOUS</span><span>KG</span><span>REPS</span><span>${icon('check')}</span></div>${e.sets.map((set,si)=>{const prev=previous[si];return `<div class="set-row ${set.checked?'completed':''}"><button type="button" class="set-type" data-set-menu="${ei},${si}" aria-label="${esc(e.name)} set ${si+1} type ${esc(set.type||'normal')}">${set.type&&set.type!=='normal'?{warmup:'W',drop:'D',failure:'F'}[set.type]:si+1}</button><button type="button" class="previous-set" data-previous="${ei},${si}" aria-label="Copy previous ${esc(e.name)} set ${si+1}" ${!prev?'disabled':''}>${prev?`${prev.weight?number(prev.weight):'BW'} × ${prev.reps}`:'–'}</button><input aria-label="${esc(e.name)} set ${si+1} weight in kg" type="number" min="0" max="10000" step="any" inputmode="decimal" data-ei="${ei}" data-si="${si}" data-field="weight" placeholder="${prev?prev.weight:'0'}" value="${esc(set.weight)}"><input aria-label="${esc(e.name)} set ${si+1} reps" type="number" min="1" max="1000" step="1" inputmode="numeric" data-ei="${ei}" data-si="${si}" data-field="reps" placeholder="${prev?.reps||e.targetReps||'Reps'}" value="${esc(set.reps)}"><button type="button" class="complete-set ${set.checked?'checked':''}" data-complete="${ei},${si}" aria-pressed="${Boolean(set.checked)}" aria-label="Complete ${esc(e.name)} set ${si+1}">${icon('check')}</button></div>`;}).join('')}<button type="button" class="add-set" data-add-set="${ei}">${icon('plus')} Add set</button></section>`;
    }).join('')}</div>${draft.exercises.length?'':'<div class="empty-state"><h3>Build your workout</h3><p>Add an exercise, then log the sets you complete.</p></div>'}<button type="button" class="button secondary full-width add-exercise" id="add-log-exercise">${icon('plus')} Add exercise</button><p class="log-help">Tap a set number to change its type or delete it. Only checked sets are saved.</p><label class="notes-label log-notes">Workout notes<textarea id="workout-notes" maxlength="2000" placeholder="Notes for next time">${esc(draft.notes)}</textarea></label><div class="log-toolbar"><label>Workout date<input id="workout-date" name="date" type="date" value="${esc(draft.date)}" max="${todayKey()}" required></label><span data-draft-status>${lastSaveError?'Changes not saved':'Draft saved on this device'}</span></div><p class="form-error" id="log-error" role="alert"></p><button type="button" class="text-button danger full-width" id="discard-workout">Discard workout</button></form><div class="rest-bar" ${restRemaining(draft)?'':'hidden'} aria-label="Rest timer"><span class="rest-time"><small>Rest timer</small><strong data-rest-remaining>${duration(restRemaining(draft))}</strong></span><button class="rest-adjust" data-adjust-rest="-15" aria-label="Remove 15 seconds">−15</button><button class="rest-adjust" data-adjust-rest="15" aria-label="Add 15 seconds">+15</button><button class="rest-skip" id="skip-rest">Skip</button></div>`,'log-modal',preserveFocus);
  const backdrop=modalRoot.querySelector('.modal-backdrop');
  backdrop.scrollTop=workoutPosition.scroll;
  modalRoot.querySelector(workoutPosition.focus||'.modal')?.focus({preventScroll:true});
  modalRoot.querySelector('.log-modal').addEventListener('click',event=>rememberWorkoutPosition(event.target.closest('button, input, select, textarea')),true);
  modalRoot.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{
    const next=structuredClone(state),set=next.draft.exercises[Number(input.dataset.ei)].sets[Number(input.dataset.si)];set[input.dataset.field]=input.value;
    if(set.checked)set.checked=false;
    state=next;persist();
    const row=input.closest('.set-row');row.classList.remove('completed');const complete=row.querySelector('.complete-set');complete.classList.remove('checked');complete.setAttribute('aria-pressed','false');updateWorkoutMetrics();
  }));
  modalRoot.querySelector('#workout-name').addEventListener('input',event=>{state.draft.dayName=event.target.value;persist();});
  modalRoot.querySelector('#workout-date').addEventListener('change',event=>{if(changeDraft(d=>d.date=event.target.value))renderLog(true);});
  modalRoot.querySelector('#workout-notes').addEventListener('input',event=>{state.draft.notes=event.target.value;persist();});
  modalRoot.querySelectorAll('[data-rest]').forEach(input=>input.addEventListener('change',()=>changeDraft(d=>d.exercises[Number(input.dataset.rest)].restSeconds=Number(input.value))));
  modalRoot.querySelectorAll('[data-add-set]').forEach(button=>button.addEventListener('click',()=>{const i=Number(button.dataset.addSet);if(draft.exercises[i].sets.length>=30){toast('Up to 30 sets per exercise.');return;}if(changeDraft(d=>d.exercises[i].sets.push({reps:'',weight:'',checked:false,type:'normal'})))renderLog(true);}));
  modalRoot.querySelectorAll('[data-complete]').forEach(button=>button.addEventListener('click',()=>{
    const [ei,si]=button.dataset.complete.split(',').map(Number),set=state.draft.exercises[ei].sets[si];
    if(!set.checked&&(!String(set.reps).trim()||!Number.isInteger(Number(set.reps))||Number(set.reps)<1||Number(set.reps)>1000||!Number.isFinite(Number(set.weight))||Number(set.weight)<0||Number(set.weight)>10000)){toast('Enter valid reps and weight before checking this set.');return;}
    if(changeDraft(d=>{const current=d.exercises[ei];current.sets[si].checked=!current.sets[si].checked;if(current.sets[si].checked){const rest=current.restSeconds??90;d.restEndsAt=rest&&current.sets[si+1]?.type!=='drop'?Date.now()+rest*1000:null;}}))renderLog(true);
  }));
  modalRoot.querySelectorAll('[data-previous]').forEach(button=>button.addEventListener('click',()=>{const[ei,si]=button.dataset.previous.split(',').map(Number),prev=previousSets(state,state.draft.exercises[ei].exerciseId,state.draft.date)[si];if(prev&&changeDraft(d=>Object.assign(d.exercises[ei].sets[si],{reps:String(prev.reps),weight:String(prev.weight),checked:false})))renderLog(true);}));
  modalRoot.querySelectorAll('[data-set-menu]').forEach(button=>button.addEventListener('click',()=>openSetMenu(...button.dataset.setMenu.split(',').map(Number))));
  modalRoot.querySelectorAll('[data-ex-options]').forEach(button=>button.addEventListener('click',()=>openExerciseOptions(Number(button.dataset.exOptions))));
  modalRoot.querySelectorAll('[data-log-demo]').forEach(button=>button.addEventListener('click',()=>openDemo(button.dataset.logDemo,true)));
  modalRoot.querySelectorAll('[data-log-history]').forEach(button=>button.addEventListener('click',()=>openExerciseHistory(button.dataset.logHistory,true)));
  modalRoot.querySelector('#add-log-exercise').addEventListener('click',()=>openExercisePicker());
  modalRoot.querySelector('#pause-workout').addEventListener('click',()=>{if(changeDraft(d=>{if(d.pausedAt){d.pausedMs=(d.pausedMs||0)+Date.now()-d.pausedAt;d.pausedAt=null;}else d.pausedAt=Date.now();}))renderLog(true);});
  modalRoot.querySelectorAll('[data-adjust-rest]').forEach(button=>button.addEventListener('click',()=>{if(changeDraft(d=>d.restEndsAt=Math.max(Date.now(),(d.restEndsAt||Date.now())+Number(button.dataset.adjustRest)*1000)))updateWorkoutMetrics();}));
  modalRoot.querySelector('#skip-rest').addEventListener('click',()=>{if(changeDraft(d=>d.restEndsAt=null))updateWorkoutMetrics();});
  modalRoot.querySelector('#discard-workout').addEventListener('click',()=>{if(confirm('Discard this unfinished workout? Saved workouts stay in your history.')){if(persist({...state,draft:null}))closeModal();}});
  modalRoot.querySelector('#finish-workout').addEventListener('click',finishWorkout);
  modalRoot.querySelector('#workout-form').addEventListener('submit',event=>{event.preventDefault();finishWorkout();});
  updateWorkoutMetrics();
}
function updateWorkoutMetrics() {
  if(!state.draft)return;
  const t=workoutTotals(state.draft.exercises,{completedOnly:true});
  document.querySelectorAll('[data-elapsed]').forEach(el=>el.textContent=duration(elapsedSeconds(state.draft)));
  modalRoot.querySelectorAll('[data-volume]').forEach(el=>el.textContent=number(t.volume));
  modalRoot.querySelectorAll('[data-completed]').forEach(el=>el.textContent=t.sets);
  const remaining=restRemaining(state.draft),bar=modalRoot.querySelector('.rest-bar');
  if(bar){bar.hidden=!remaining;bar.querySelector('[data-rest-remaining]').textContent=duration(remaining);}
  modalRoot.querySelector('.log-modal')?.classList.toggle('resting',Boolean(remaining));
}
function openSetMenu(ei,si) {
  const ex=state.draft.exercises[ei],set=ex.sets[si];modal={type:'set-menu',fromLog:true};
  showModal(`<div class="modal-header"><div><span class="eyebrow">${esc(ex.name)} · SET ${si+1}</span><h2 id="modal-title">Set type</h2></div>${closeButton()}</div><div class="settings-content option-list">${[['normal','Normal set'],['warmup','Warm-up set'],['drop','Drop set'],['failure','Failure set']].map(([key,label])=>`<button class="button secondary full-width" data-type="${key}">${label}${(set.type||'normal')===key?icon('check'):''}</button>`).join('')}<button class="text-button danger full-width" id="delete-set" ${ex.sets.length<2?'disabled':''}>Delete set</button><button class="button secondary full-width" id="back-to-workout">Back to workout</button></div>`,'options-modal');
  modalRoot.querySelectorAll('[data-type]').forEach(el=>el.addEventListener('click',()=>{if(changeDraft(d=>d.exercises[ei].sets[si].type=el.dataset.type))renderLog();}));
  modalRoot.querySelector('#delete-set').addEventListener('click',()=>{if(set.checked&&!confirm('Delete this completed set from the workout?'))return;if(changeDraft(d=>d.exercises[ei].sets.splice(si,1)))renderLog();});
  modalRoot.querySelector('#back-to-workout').addEventListener('click',()=>renderLog());
}
function openExerciseOptions(ei) {
  const ex=state.draft.exercises[ei];modal={type:'exercise-options',fromLog:true};
  showModal(`<div class="modal-header"><div><h2 id="modal-title">${esc(ex.name)}</h2></div>${closeButton()}</div><div class="settings-content option-list"><button class="button secondary full-width" id="replace-exercise">Replace exercise</button><button class="button secondary full-width" id="move-up" ${ei===0?'disabled':''}>Move up</button><button class="button secondary full-width" id="move-down" ${ei===state.draft.exercises.length-1?'disabled':''}>Move down</button><button class="text-button danger full-width" id="remove-exercise">Remove exercise</button><button class="button secondary full-width" id="back-to-workout">Back to workout</button></div>`,'options-modal');
  modalRoot.querySelector('#replace-exercise').addEventListener('click',()=>openExercisePicker('',ei));
  for(const [id,offset] of [['move-up',-1],['move-down',1]])modalRoot.querySelector('#'+id).addEventListener('click',()=>{if(changeDraft(d=>{[d.exercises[ei],d.exercises[ei+offset]]=[d.exercises[ei+offset],d.exercises[ei]];}))renderLog();});
  modalRoot.querySelector('#remove-exercise').addEventListener('click',()=>{if(ex.sets.some(s=>s.checked)&&!confirm('Remove this exercise and its completed sets from this workout?'))return;if(changeDraft(d=>d.exercises.splice(ei,1)))renderLog();});
  modalRoot.querySelector('#back-to-workout').addEventListener('click',()=>renderLog());
}
function pickerResults(query) {
  const matches=filterExercises(EXERCISES,{query});
  return matches.map(e=>`<button class="picker-row" data-pick="${esc(e.id)}"><span class="log-thumbnail">${exerciseThumbnail(e.id)}</span><span><strong>${esc(e.name)}</strong><small>${esc(e.muscle)} · ${esc(e.equipment)}</small></span>${icon('plus')}</button>`).join('')||'<p class="muted">No exercises match this search.</p>';
}
function openExercisePicker(query='',replaceIndex=null) {
  modal={type:'picker',fromLog:true};
  showModal(`<div class="modal-header"><div><h2 id="modal-title">${replaceIndex===null?'Add exercise':'Replace exercise'}</h2></div>${closeButton()}</div><div class="settings-content exercise-picker"><div class="search-box">${icon('search')}<input id="picker-search" type="search" aria-label="Find an exercise" placeholder="Search exercises" value="${esc(query)}"></div><div class="picker-list">${pickerResults(query)}</div><button class="button secondary full-width" id="picker-back">Back to workout</button></div>`,'picker-modal');
  const list=modalRoot.querySelector('.picker-list');
  modalRoot.querySelector('#picker-search').addEventListener('input',event=>{list.innerHTML=pickerResults(event.target.value);});
  list.addEventListener('click',event=>{const button=event.target.closest('[data-pick]');if(!button)return;if(replaceIndex===null&&state.draft.exercises.length>=30){toast('Up to 30 exercises per workout.');return;}if(replaceIndex!==null&&state.draft.exercises[replaceIndex].sets.some(s=>s.checked)&&!confirm('Replace this exercise and remove its completed sets from this workout?'))return;if(changeDraft(d=>{const exercise=newLogExercise(button.dataset.pick);if(replaceIndex===null)d.exercises.push(exercise);else d.exercises[replaceIndex]=exercise;}))renderLog();});
  modalRoot.querySelector('#picker-back').addEventListener('click',()=>renderLog());
}
function finishWorkout() {
  try {
    const session=buildCompletedSession(state.draft),t=workoutTotals(session.exercises);
    modal={type:'review',fromLog:true};
    showModal(`<div class="modal-header"><div><span class="eyebrow">FINISH WORKOUT</span><h2 id="modal-title">${esc(session.dayName)}</h2><p>${longDate(session.date)} · ${duration(session.durationSeconds||0)}</p></div>${closeButton()}</div><div class="settings-content"><div class="celebration-stats"><span><strong>${t.sets}</strong>completed sets</span><span><strong>${t.reps}</strong>reps</span><span><strong>${number(t.volume)}</strong>kg volume</span></div><p class="muted">Unchecked sets will be left out. Your routine stays unchanged.</p><p class="form-error" id="log-error" role="alert"></p><div class="settings-actions"><button class="button primary full-width" id="save-workout">Save workout ${icon('check')}</button><button class="button secondary full-width" id="keep-training">Keep training</button></div></div>`,'review-modal');
    modalRoot.querySelector('#keep-training').addEventListener('click',()=>renderLog());
    modalRoot.querySelector('#save-workout').addEventListener('click',()=>{
      try{const finalSession=buildCompletedSession(state.draft);const next=completeWorkout({...state,draft:null},finalSession);if(!persist(next))return;chooseNextDay();modal={type:'saved'};closeModal();navigate('history');openHistory(finalSession.id);toast('Workout saved.');}catch(error){modalRoot.querySelector('#log-error').textContent=error.message;}
    });
  } catch(error) { const target=modalRoot.querySelector('#log-error');if(target){target.textContent=error.message;target.scrollIntoView({block:'center',behavior:'smooth'});}toast(error.message); }
}
function openExerciseHistory(id,fromLog=false) {
  const entries=exerciseHistory(state,id),best=entries.length?Math.max(...entries.map(e=>e.bestWeight)):0;
  modal={type:'exercise-history',fromLog};
  const points=entries.slice(-12),maxVolume=Math.max(1,...points.map(e=>e.volume));
  showModal(`<div class="modal-header"><div><span class="eyebrow">EXERCISE HISTORY</span><h2 id="modal-title">${esc(exerciseName(id))}</h2></div>${closeButton()}</div><div class="settings-content"><div class="progress-totals"><div><span>Best weight</span><strong>${number(best)}<small> kg</small></strong></div><div><span>Workouts</span><strong>${entries.length}</strong></div></div>${entries.length?`<section class="exercise-chart"><h3>Volume per workout</h3><p>Weight × reps · kg</p><div class="volume-bars" role="img" aria-label="${esc(points.map(e=>`${longDate(e.date)}: ${number(e.volume)} kg`).join('; '))}">${points.map(e=>`<div><span style="height:${Math.max(2,e.volume/maxVolume*110)}px" title="${esc(longDate(e.date))}: ${e.volume} kg"></span><small>${fmt(e.date)}</small></div>`).join('')}</div></section><div class="history-detail">${[...entries].reverse().map(e=>`<section><h3>${esc(e.dayName)} <small>${fmt(e.date)}</small></h3>${e.sets.map((set,i)=>`<div><span>${set.type&&set.type!=='normal'?setTypeName(set.type):`Set ${i+1}`}</span><strong>${set.weight?`${number(set.weight)} kg × `:''}${set.reps} reps</strong></div>`).join('')}</section>`).join('')}</div>`:'<div class="empty-state"><h3>No sets recorded yet</h3><p>Complete this exercise in a workout to see your history here.</p></div>'}<button class="button secondary full-width" id="history-guide">Movement & muscle guide</button>${fromLog?'<button class="button primary full-width" id="history-back">Back to workout</button>':''}</div>`,'exercise-history-modal');
  modalRoot.querySelector('#history-guide').addEventListener('click',()=>openDemo(id,fromLog));
  modalRoot.querySelector('#history-back')?.addEventListener('click',()=>renderLog());
}
function openNewRoutine() {
  openPlanEditor(false);
  if(planDraft.days.length>=14){toast('Up to 14 routines per block.');return;}
  planDraft.days.push({id:uid(),name:'New routine',focus:'',exercises:[{exerciseId:EXERCISES[0].id,sets:3,reps:10}]});
  renderPlanEditor();modalRoot.querySelector('.editor-day:last-child')?.scrollIntoView({block:'start'});
}

function openPlanEditor(isNew) {
  planDraft=structuredClone(plan());
  if(isNew){planDraft.id=uid();planDraft.name=`Block ${state.plans.length+1}`;planDraft.startDate=todayKey();planDraft.endDate=addMonths(todayKey(),3);planDraft.days.forEach(d=>d.id=uid());}
  planDraftOriginal=JSON.stringify(planDraft);
  modal={type:'plan',isNew};renderPlanEditor();
}
function renderPlanEditor() {
  const isNew=modal.isNew;
  showModal(`<div class="modal-header"><div><span class="eyebrow">PLAN EDITOR</span><h2 id="modal-title">${isNew?'New training block':'Edit your plan'}</h2><p>${isNew?'Your earlier plans and workout logs stay in your history.':'Changes apply to future workouts. Saved logs stay as they are.'}</p></div>${closeButton()}</div><form id="plan-form"><div class="plan-fields"><label>Block name<input id="plan-name" maxlength="60" value="${esc(planDraft.name)}" required></label><label>Start date<input type="date" id="plan-start" value="${esc(planDraft.startDate)}" required></label><div><span>Ends after 3 months</span><strong id="plan-end">${longDate(planDraft.endDate)}</strong></div></div><div class="editor-days">${planDraft.days.map((d,di)=>`<section class="editor-day"><div class="editor-day-heading"><span>DAY ${di+1}</span><input aria-label="Day ${di+1} name" data-day-name="${di}" maxlength="60" value="${esc(d.name)}" required><button type="button" class="icon-button" data-delete-day="${di}" ${planDraft.days.length===1?'disabled':''} aria-label="Remove day ${di+1}">${icon('close')}</button></div><input class="focus-input" aria-label="Day ${di+1} focus" data-day-focus="${di}" maxlength="120" value="${esc(d.focus)}" placeholder="Focus, e.g. chest, back & shoulders"><div class="editor-exercise-head"><span>EXERCISE</span><span>SETS</span><span>REPS</span><span></span></div>${d.exercises.map((e,ei)=>`<div class="editor-exercise"><select aria-label="Day ${di+1} exercise ${ei+1}" data-plan-ex="${di},${ei}">${EXERCISES.map(x=>`<option value="${esc(x.id)}" ${x.id===e.exerciseId?'selected':''}>${esc(x.name)}</option>`).join('')}</select><input type="number" min="1" max="20" value="${e.sets}" aria-label="Day ${di+1} exercise ${ei+1} target sets" data-plan-sets="${di},${ei}" required><input type="number" min="1" max="1000" value="${e.reps}" aria-label="Day ${di+1} exercise ${ei+1} target reps" data-plan-reps="${di},${ei}" required><button type="button" class="icon-button" data-delete-ex="${di},${ei}" ${d.exercises.length===1?'disabled':''} aria-label="Remove exercise ${ei+1} from day ${di+1}">${icon('close')}</button></div>`).join('')}<button type="button" class="add-set" data-add-ex="${di}">${icon('plus')} Add exercise</button></section>`).join('')}</div><button type="button" class="button secondary compact" id="add-day">${icon('plus')} Add training day</button><p class="form-error" id="plan-error" role="alert"></p><div class="log-footer"><span class="muted">${planDraft.days.length} days per week · 3 months</span><button class="button primary" type="submit">${isNew?'Start this block':'Save plan'}${icon('check')}</button></div></form>`,'plan-modal');
  modalRoot.querySelector('#plan-name').addEventListener('input',e=>planDraft.name=e.target.value);
  modalRoot.querySelector('#plan-start').addEventListener('input',e=>{planDraft.startDate=e.target.value;if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){planDraft.endDate=addMonths(e.target.value,3);modalRoot.querySelector('#plan-end').textContent=longDate(planDraft.endDate);}});
  modalRoot.querySelectorAll('[data-day-name]').forEach(el=>el.addEventListener('input',()=>planDraft.days[Number(el.dataset.dayName)].name=el.value));
  modalRoot.querySelectorAll('[data-day-focus]').forEach(el=>el.addEventListener('input',()=>planDraft.days[Number(el.dataset.dayFocus)].focus=el.value));
  for(const [attr,field] of [['planEx','exerciseId'],['planSets','sets'],['planReps','reps']]) modalRoot.querySelectorAll(`[data-${attr.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}]`).forEach(el=>el.addEventListener('input',()=>{const [di,ei]=el.dataset[attr].split(',').map(Number);planDraft.days[di].exercises[ei][field]=field==='exerciseId'?el.value:Number(el.value);}));
  modalRoot.querySelectorAll('[data-delete-day]').forEach(el=>el.addEventListener('click',()=>{planDraft.days.splice(Number(el.dataset.deleteDay),1);renderPlanEditor();}));
  modalRoot.querySelectorAll('[data-delete-ex]').forEach(el=>el.addEventListener('click',()=>{const[di,ei]=el.dataset.deleteEx.split(',').map(Number);planDraft.days[di].exercises.splice(ei,1);renderPlanEditor();}));
  modalRoot.querySelectorAll('[data-add-ex]').forEach(el=>el.addEventListener('click',()=>{const d=planDraft.days[Number(el.dataset.addEx)];if(d.exercises.length>=12){toast('Up to 12 exercises per day.');return;}d.exercises.push({exerciseId:EXERCISES.find(e=>!d.exercises.some(x=>x.exerciseId===e.id))?.id||EXERCISES[0].id,sets:3,reps:10});renderPlanEditor();}));
  modalRoot.querySelector('#add-day').addEventListener('click',()=>{if(planDraft.days.length>=14){toast('Your block can have up to 14 routines.');return;}planDraft.days.push({id:uid(),name:`Day ${planDraft.days.length+1}`,focus:'Choose your focus',exercises:[{exerciseId:'goblet-squat',sets:3,reps:10}]});renderPlanEditor();});
  modalRoot.querySelector('#plan-form').addEventListener('submit',event=>{
    event.preventDefault();
    planDraft.name=planDraft.name.trim();planDraft.days.forEach(d=>d.name=d.name.trim());
    const next={...state,plans:isNew?[...state.plans,planDraft]:state.plans.map(p=>p.id===planDraft.id?planDraft:p),activePlanId:planDraft.id};
    if(!validateState(next)){modalRoot.querySelector('#plan-error').textContent='Check the plan name, day names, dates, and set targets. Set and rep targets must be positive whole numbers.';return;}
    if(persist(next)){planDraftOriginal=JSON.stringify(planDraft);selectedDay=0;closeModal();navigate('plan');toast(isNew?'Your new training block is ready.':'Plan updated. Your workout history is unchanged.');}
  });
}
function openHistory(id) {
  const session=state.sessions.find(s=>s.id===id);if(!session)return;
  modal={type:'history',id};
  showModal(`<div class="modal-header"><div><span class="eyebrow">${longDate(session.date)}</span><h2 id="modal-title">${esc(session.dayName)}</h2><p>${session.durationSeconds===undefined?'Saved workout':duration(session.durationSeconds)+' duration'} · ${esc(state.plans.find(p=>p.id===session.planId)?.name||'Previous block')}</p></div>${closeButton()}</div><div class="history-detail">${session.exercises.map(e=>`<section><h3>${esc(e.name)}</h3>${e.sets.map((set,i)=>`<div><span>${set.type&&set.type!=='normal'?setTypeName(set.type):`Set ${i+1}`}</span><strong>${set.weight?`${set.weight} kg × `:''}${set.reps} reps</strong></div>`).join('')}</section>`).join('')}${session.notes?`<section><h3>Session notes</h3><p class="preserve-lines">${esc(session.notes)}</p></section>`:''}</div><div class="log-footer"><button class="text-button danger" id="delete-session">Delete workout</button><button class="button secondary" data-close>Done</button></div>`,'history-modal');
  modalRoot.querySelector('#delete-session').addEventListener('click',()=>{if(confirm('Delete this workout? Its sets, reps, and weights will be removed from your history.')){if(persist({...state,sessions:state.sessions.filter(s=>s.id!==id)})){closeModal();toast('Workout deleted. Progress has been recalculated.');}}});
}
function exportData() {
  const {raw,kind}=persistence.exportBackup(state);
  if(raw === null){toast('The browser did not allow access to the original data. Restore a saved backup to recover.');return;}
  const blob=new Blob([raw],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`cant-pin-me-${kind==='recovery'?'recovery':'backup'}-${todayKey()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(kind==='recovery'?'Original data exported for recovery. It may not be restorable.':kind==='saved'?'Backup exported from the last saved data. Invalid unsaved changes are not included.':'Backup exported. Keep this file somewhere safe.');
}
function openSettings() {
  modal={type:'settings'};
  showModal(`<div class="modal-header"><div><span class="eyebrow">STORAGE & BACKUP</span><h2 id="modal-title">Settings & backup</h2></div>${closeButton()}</div><div class="settings-content"><section><h3>${icon('lock')} Saved in this browser</h3><p>Your plan, workout drafts, and completed logs stay on this device. They do not sync between browsers or phones. Clearing browser data removes them.</p><div class="settings-actions"><button class="button primary compact" id="settings-export">${icon('download')} Export backup</button><label class="button secondary compact import-label">${icon('upload')} Restore backup<input id="import-file" type="file" accept="application/json,.json"></label></div><p class="form-error" id="import-error" role="alert"></p></section><section><h3>Training totals</h3><p>Volume is the sum of weight multiplied by reps for each logged set. A weekly streak counts consecutive weeks with a workout.</p></section><section><h3>On your iPhone</h3><p>Open this app in Safari, tap Share, then Add to Home Screen. Keep a backup when moving to a new device.</p></section><section><h3>Exercise demos</h3><p>The looping illustrations show the movement and include form cues. You can pause each demo. Reduced-motion preferences pause animations by default.</p></section></div>`,'settings-modal');
  modalRoot.querySelector('#settings-export').addEventListener('click',exportData);
  modalRoot.querySelector('#import-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('This backup is larger than 10 MB.');
      const data=JSON.parse(await file.text());
      if(!validateState(data))throw new Error('This file is not a valid Cant Pin Me backup. Nothing has changed.');
      if(data.unit!=='kg')throw new Error('This version uses kilograms. A backup in pounds cannot be restored without converting its weights.');
      if(!confirm(`Replace this browser data with ${data.sessions.length} saved workouts from this backup? Export your current data first if you want to keep it.`))return;
      if(persist(data,{replace:true})){chooseNextDay();closeModal();toast('Backup restored. Your workouts are ready.');}
    }catch(error){modalRoot.querySelector('#import-error').textContent=error.message;}
    event.target.value='';
  });
}
document.addEventListener('keydown',event=>{
  if(!modal)return;
  if(event.key==='Escape'){closeModal();return;}
  if(event.key==='Tab'){
    const elements=[...modalRoot.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]')].filter(el=>el.offsetParent!==null);
    const first=elements[0],last=elements.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===modalRoot.querySelector('.modal'))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
window.addEventListener('storage',event=>{if(event.key==='form-workouts-v1'||event.key===null){lastSaveError='Your data changed in another tab. Reload before making more changes.';updateSaveStatus();toast(lastSaveError);}});
setInterval(updateWorkoutMetrics,1000);
render();
if(loaded.error)toast(loaded.error);
