(() => {
  'use strict';
  const questions=window.GAME_QUESTIONS;
  let profiles=window.GAME_DATA?.profiles || [];
  const $=id=>document.getElementById(id);
  if(window.GAME_DATA?.demo)$('hostDemo').classList.remove('hidden');
  const fullQuestions=questions.map((q,i)=>`Q${String(i+1).padStart(2,'0')}. ${q.title}\n`+q.options.map((o,j)=>`${'ABCD'[j]}. ${o}`).join('\n')).join('\n\n');
  const view=$('questionList');
  questions.forEach((q,i)=>{
    const div=document.createElement('div');div.className='preview-question';
    const b=document.createElement('b');b.textContent=`Q${i+1}. ${q.title}`;
    const ul=document.createElement('ul');q.options.forEach((o,j)=>{const li=document.createElement('li');li.textContent=`${'ABCD'[j]}. ${o}`;ul.append(li);});
    div.append(b,ul);view.append(div);
  });
  async function copy(str){
    try {await navigator.clipboard.writeText(str);return true;}
    catch(_){const t=document.createElement('textarea');t.value=str;t.style.position='fixed';t.style.opacity=0;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();return ok;}
  }
  $('copyQuestions').addEventListener('click',async()=>{
    const ok=await copy('순장 이름 (단답형, 필수)\n\n'+fullQuestions);
    $('copyQuestions').textContent=ok?'복사 완료 ✓':'복사에 실패했어요';
    setTimeout(()=>$('copyQuestions').textContent='15문항 전체 복사',1900);
  });
  function parseCSV(str){
    str=str.replace(/^\ufeff/,'');
    const lines=[];let row=[],field='',quoted=false;
    for(let i=0;i<str.length;i++){
      const ch=str[i];
      if(ch==='"'){
        if(quoted && str[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
      }else if(ch===','&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&str[i+1]==='\n')i++;row.push(field);if(row.some(s=>s.trim()))lines.push(row);row=[];field='';}
      else field+=ch;
    }
    if(quoted)throw new Error('CSV 큰따옴표 짝이 맞지 않습니다.');
    row.push(field);if(row.some(s=>s.trim()))lines.push(row);
    return lines;
  }
  function readChoice(raw,q){
    const s=String(raw||'').trim();
    if(/^[ABCD]$/i.test(s))return s.toUpperCase();
    const prefix=s.match(/^([ABCD])\s*[.\):\-]\s*/i);
    if(prefix)return prefix[1].toUpperCase();
    const index=q.options.findIndex(o=>o.replace(/\s+/g,' ').trim()===s.replace(/\s+/g,' ').trim());
    if(index>=0)return 'ABCD'[index];
    throw new Error(`${q.id} 응답 “${s||'(빈칸)'}”을 A~D로 읽을 수 없습니다.`);
  }
  function importData(text){
    const rows=parseCSV(text);
    if(rows.length<2)throw new Error('응답 행을 읽지 못했습니다. CSV 첫 행은 제목이어야 합니다.');
    const header=rows[0].map(s=>s.trim());
    const nIndex=header.findIndex(h=>/^name$/i.test(h)||h.includes('순장 이름')||h==='이름'||h==='성함'||h.includes('응답자 이름'));
    if(nIndex<0)throw new Error('이름 열을 찾지 못했습니다. 열 제목을 name 또는 순장 이름으로 지정하세요.');
    const qCols=questions.map((q,i)=>header.findIndex(h=>h.toLowerCase()===q.id ||h.includes(q.title)||new RegExp(`^Q0?${i+1}(?:\\.|\\s|$)`, 'i').test(h)));
    if(qCols.some(x=>x<0)){
      const qStart=nIndex+1;
      if(header.length-qStart<questions.length)throw new Error('15개 답변 열을 찾지 못했습니다. 이름 열 바로 다음부터 문항이 순서대로 있어야 합니다.');
      for(let i=0;i<questions.length;i++)qCols[i]=qStart+i;
    }
    const entries=rows.slice(1).filter(r=>r.some(s=>s.trim()));
    if(entries.length!==29)throw new Error(`29명이 필요하지만 현재 ${entries.length}명의 응답이 있습니다. 구글폼에서 중복 응답을 먼저 정리해 주세요.`);
    const parsed=entries.map((r,i)=>{
      const name=String(r[nIndex]||'').trim();if(!name)throw new Error(`${i+2}행: 순장 이름이 비어 있습니다.`);
      return {id:`p${String(i+1).padStart(2,'0')}`,name,answers:questions.map((q,j)=>{try{return readChoice(r[qCols[j]],q);}catch(e){throw new Error(`${i+2}행 / ${name}: ${e.message}`);}})};
    });
    const dupNames=parsed.filter((p,i)=>parsed.findIndex(q=>q.name===p.name)!==i).map(p=>p.name);
    const patterns={};parsed.forEach(p=>{const k=p.answers.join('');(patterns[k] ||= []).push(p.name);});
    const dupProfiles=Object.values(patterns).filter(a=>a.length>1);
    return {profiles:parsed, warnings:[...new Set(dupNames)].map(n=>`동명이인 확인: ${n}`).concat(dupProfiles.map(names=>`답변 패턴 동일: ${names.join(', ')}`))};
  }
  let imported=null;
  $('csvFile').addEventListener('change',async(ev)=>{
    const file=ev.target.files?.[0];if(!file)return;
    const status=$('importStatus');
    try{
      const text=await file.text(); const data=importData(text);
      imported=data.profiles;profiles=data.profiles;
      status.className='import-status ok';
      status.textContent=`29명 × ${questions.length}문항 검증 완료!\n`+(data.warnings.length?data.warnings.join('\n'):'이름과 답변 형식에 문제가 없습니다.');
      $('downloadData').disabled=false;
      refreshTargetOptions();
    }catch(err){imported=null;status.className='import-status bad';status.textContent=err.message;$('downloadData').disabled=true;}
  });
  $('downloadData').onclick=()=>{
    if(!imported)return;
    const code='window.GAME_DATA = '+JSON.stringify({demo:false,profiles:imported},null,2)+';\n';
    const blob=new Blob([code],{type:'text/javascript;charset=utf-8'}); const uri=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=uri;a.download='data.js';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),1500);
  };
  const baseInput=$('baseUrl');
  let here; try { here=new URL('.',location.href); } catch { here={protocol:'file:',href:''}; }
  baseInput.value=here.protocol==='file:'?'':here.href;
  function refreshTargetOptions(){
    const select=$('targetSelect'),previous=select.value;select.replaceChildren();
    profiles.forEach(p=>{const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.name;select.append(opt);});
    if(profiles.some(p=>p.id===previous))select.value=previous;
    updateLink();
  }
  function link(){
    const base=baseInput.value.trim();
    if(!base){try{const u=new URL('index.html',location.href);u.searchParams.set('t',$('targetSelect').value);return u.href;}catch{return null;}}
    try {const u=new URL('index.html',base.endsWith('/')?base:base+'/');u.searchParams.set('t',$('targetSelect').value);return u.href;}catch{return null;}
  }
  function updateLink(){
    const url=link();$('shareLink').textContent=url||'유효한 웹사이트 주소를 입력하세요.';
    $('previewLink').href=url||'index.html';
    const valid=url && /^https?:\/\//.test(url);
    $('qrImage').style.display=valid?'block':'none';
    if(valid){$('qrImage').src='https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data='+encodeURIComponent(url);}
    $('qrCaption').textContent=valid?'이번 라운드 접속 QR코드':'사이트를 배포한 후 https:// 주소를 입력하면 QR코드가 표시됩니다.';
  }
  baseInput.addEventListener('input',updateLink);
  $('targetSelect').addEventListener('change',updateLink);
  $('copyLink').addEventListener('click',async()=>{
    const url=link();if(!url)return;const ok=await copy(url);$('copyLink').textContent=ok?'복사 완료 ✓':'복사 실패';setTimeout(()=>$('copyLink').textContent='링크 복사',1500);
  });
  refreshTargetOptions();
})();
