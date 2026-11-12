(() => {
  'use strict';
  const questions = window.GAME_QUESTIONS;
  const dataset = window.GAME_DATA;
  const $ = id => document.getElementById(id);
  const labels = ['A','B','C','D'];
  const screens = ['screenIntro','screenQuestion','screenResult','screenError'];
  let current = 0;
  let answers = [];
  let target;
  const show = key => {
    screens.forEach(id => $(id).classList.toggle('active', id === key));
    window.scrollTo({top:0,behavior:'instant'});
  };
  const fail = msg => {$('errorCopy').textContent=msg; show('screenError');};
  if (!Array.isArray(questions) || questions.length === 0 || !dataset || !Array.isArray(dataset.profiles) || dataset.profiles.length === 0) {
    fail('문항이나 순장 응답을 읽지 못했습니다. 사회자에게 문의하세요.'); return;
  }
  const roster = dataset.profiles;
  const passed = new URLSearchParams(location.search).get('t');
  const targetId = passed || (dataset.demo ? roster[0].id : null);
  target = roster.find(p => p.id === targetId);
  if (!target) {fail('이번 라운드가 아직 설정되지 않았습니다. 사회자가 안내한 QR코드로 접속해주세요.');return;}
  if (dataset.demo) $('demoBanner').classList.remove('hidden');
  const valid = p => Array.isArray(p.answers) && p.answers.length === questions.length && p.answers.every(a => labels.includes(a));
  if (!roster.every(valid)) {fail('응답 형식이 올바르지 않습니다. 사회자가 data.js를 확인해야 합니다.');return;}
  const sectionName = q => q.section === '가벼운 선택'?'01 / THE EVERYDAY':q.section === '관계의 선택'?'02 / THE CONNECTION':'03 / THE YEAR';
  function renderQuestion(){
    const q=questions[current];
    $('sectionLabel').textContent=sectionName(q);
    $('questionCount').textContent=`${String(current+1).padStart(2,'0')} / ${questions.length}`;
    $('progressFill').style.width=`${(current+1)/questions.length*100}%`;
    $('questionTitle').textContent=q.title;
    const wrap=$('options');wrap.replaceChildren();
    q.options.forEach((s,i) => {
      const value=labels[i];
      const b=document.createElement('button');b.type='button';b.className='option'+(answers[current]===value?' is-selected':'');b.setAttribute('role','radio');b.setAttribute('aria-checked',String(answers[current]===value));
      const letter=document.createElement('span');letter.className='option-letter';letter.textContent=value;
      const content=document.createElement('span');content.className='option-text';content.textContent=s;
      b.append(letter,content);
      b.onclick=()=>{answers[current]=value;renderQuestion();};wrap.append(b);
    });
    $('backButton').disabled=current===0;
    $('nextButton').disabled=!answers[current];
    $('nextButton').textContent=current===questions.length-1?'결과 확인하기 ↗':'다음 선택 →';
  }
  function score(p){return p.answers.reduce((count,a,i)=>count+(a===answers[i]?1:0),0);}
  function labeledAnswer(q,v){return `${v}. ${q.options[labels.indexOf(v)]||'—'}`;}
  function line(el, left, right, prefix){
    const row=document.createElement('div');row.className='leader-row';
    const l=document.createElement('span');
    const rank=document.createElement('span');rank.className='leader-rank';rank.textContent=prefix;
    l.append(rank,document.createTextNode(left));
    const r=document.createElement('strong');r.className='leader-score';r.textContent=right;
    row.append(l,r);el.append(row);
  }
  function renderResult(){
    const scored=roster.map((p,i)=>({p,i,score:score(p)}));
    const topScore=Math.max(...scored.map(r=>r.score));
    const winnerGroup=scored.filter(r=>r.score===topScore);
    const sorted=scored.sort((a,b)=>b.score-a.score||(a.p.id===target.id?-1:0)-(b.p.id===target.id?-1:0)||a.i-b.i);
    // Tie ordering never changes rank: all profiles with the same score share a rank.
    const winner=sorted[0];
    const targetScore=score(target);
    const targetRank=1+scored.filter(r=>r.score>targetScore).length;
    const topNames=winnerGroup.map(r=>r.p.name);
    if (winnerGroup.length===1){
      $('matchBadge').textContent='가장 많이 일치한 순장';
      $('winnerName').textContent=winner.p.name;
      $('winnerCopy').textContent=winner.p.id===target.id?'당신이 생각한 그 사람과 가장 많이 일치했어요!':'당신이 생각한 순장보다 이 사람의 실제 선택과 더 많이 겹쳤어요.';
    } else {
      $('matchBadge').textContent=`공동 1위 · ${winnerGroup.length}명`;
      $('winnerName').textContent=topNames.length<=2?topNames.join(' · '):`${topNames[0]} 외 ${topNames.length-1}명`;
      $('winnerCopy').textContent='가장 많이 일치한 순장이 여러 명이에요. 서로 다른 사람들이 같은 선택을 했다는 것도 흥미로운 결과죠.';
    }
    $('winnerScore').textContent=topScore;
    $('totalScore').textContent=`/ ${questions.length} 일치`;
    $('targetName').textContent=target.name;
    $('targetRank').textContent=`${targetRank}위${scored.filter(r=>r.score===targetScore).length>1?' (공동)':''} / ${roster.length}명`;
    $('targetScore').textContent=`${targetScore} / ${questions.length}`;
    $('targetBar').style.width=(targetScore/questions.length*100)+'%';
    $('targetNote').textContent=targetRank===1?'선택이 가장 많이 겹친 순장 중 한 명이에요.':'내가 예상한 선택과 실제 이 순장의 선택이 어떻게 달랐는지 아래에서 확인할 수 있어요.';
    const board=$('topThree');board.replaceChildren();
    sorted.slice(0,3).forEach(({p,score:s})=>{
      const rank=1+scored.filter(r=>r.score>s).length;
      line(board,p.name,`${s} / ${questions.length}`,`${rank}위`);
    });
    const differenceList=$('differences');differenceList.replaceChildren();
    const differences=questions.map((q,i)=>({q,i})).filter(({i})=>answers[i]!==target.answers[i]).slice(0,4);
    if (!differences.length){
      const el=document.createElement('div');el.className='difference-card';el.textContent='놀랍게도 15개 선택이 모두 일치했어요!';differenceList.append(el);
    } else differences.forEach(({q,i})=>{
      const card=document.createElement('div');card.className='difference-card';
      const head=document.createElement('p');head.className='diff-q';head.textContent=`Q${i+1}. ${q.title}`;
      const guess=document.createElement('div');guess.className='diff-answer';
      const g=document.createElement('strong');g.textContent=labeledAnswer(q,answers[i]);guess.append('당신이 예상한 선택: ',g);
      const actual=document.createElement('div');actual.className='diff-answer actual';
      const a=document.createElement('strong');a.textContent=labeledAnswer(q,target.answers[i]);actual.append('실제 이 순장의 선택: ',a);
      card.append(head,guess,actual);differenceList.append(card);
    });
    differenceList.classList.add('hidden');$('revealButton').textContent='우리가 달랐던 선택 보기 ↓';$('revealButton').setAttribute('aria-expanded','false');
    show('screenResult');
  }
  $('startButton').onclick=()=>{current=0;answers=[];renderQuestion();show('screenQuestion');};
  $('backButton').onclick=()=>{if(current>0){current--;renderQuestion();}};
  $('nextButton').onclick=()=>{if(!answers[current])return;if(current<questions.length-1){current++;renderQuestion();}else renderResult();};
  $('restartButton').onclick=()=>{current=0;answers=[];renderQuestion();show('screenQuestion');};
  $('revealButton').onclick=()=>{const el=$('differences');const opening=el.classList.contains('hidden');el.classList.toggle('hidden',!opening);$('revealButton').textContent=opening?'달랐던 선택 접기 ↑':'우리가 달랐던 선택 보기 ↓';$('revealButton').setAttribute('aria-expanded',String(opening));};
  document.addEventListener('keydown',ev=>{
    if(!$('screenQuestion').classList.contains('active')||ev.altKey||ev.ctrlKey||ev.metaKey)return;
    const v=ev.key.toUpperCase(); if(labels.includes(v)){answers[current]=v;renderQuestion();}
    if(ev.key==='Enter' && answers[current])$('nextButton').click();
  });
})();
