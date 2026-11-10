(() => {
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const call=async(action,extra={},fn='web')=>{const token=JSON.parse(localStorage.getItem('token')||'null');const r=await fetch(window.API.replace(/\/web$/,'/'+fn),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,auth:{token},...extra})});const d=await r.json();if(!r.ok||d.error)throw new Error(d.message||'Не удалось выполнить действие');return d;};
 let initPromise;
 window.SELECTION_ACTIONS={async mount(el,data){
  if(!el)return;
  let state;try{state=await (initPromise??=call('init').catch(e=>{initPromise=null;throw e;}));}catch(e){el.textContent=e.message;return;}
  if(!el.isConnected)return;
  const me=state.me,ids=data.items.map(x=>x.num);
  const nums=()=>{const choices=[...document.querySelectorAll('[data-action-pick]')];return choices.length?choices.filter(x=>x.checked).map(x=>+x.value):ids;};
  el.innerHTML=`<details><summary class="btn soft">Действия с подборкой</summary><p>Выберите объекты галочками. Отправка сообщений — только после вашего нажатия.</p><div class="sa-btns">
   <button class="btn soft" data-action="client">🔗 Ссылка клиенту</button>
   <button class="btn soft" data-action="crm">В CRM клиенту</button><button class="btn soft" data-action="task">Поставить задачу</button>
   <button class="btn soft" data-action="owners">Собственникам / показ</button>
   ${me.can_rk?'<button class="btn soft" data-action="rk">В рекламу</button>':''}
   ${me.can_mail?`<a class="btn soft" href="mail.html?selection=${data.id}">В рассылку с правками</a>`:''}
   ${me.plan==='max'||me.role==='admin'?'<button class="btn soft" data-action="video">Видео и СММ</button>':''}
   <button class="btn soft" data-action="deal">В сделку</button><button class="btn soft" data-action="lawyer">Проверка юриста</button><button class="btn soft" data-action="broker">Ипотека</button>
   <button class="btn soft" data-action="market">Сравнить с рынком</button><button class="btn soft" data-action="similar">Похожие объекты</button>
   </div><p data-status role="status"></p></details>`;
  const status=m=>el.querySelector('[data-status]').textContent=m;
  // v5.49 (п. 8): ссылка клиенту — загружаем заранее: на iPhone копирование после ожидания сети браузер запрещает
  // («The request is not allowed by the user agent…»). Окно со ссылкой: Скопировать / Поделиться / WhatsApp / Telegram — каждое своим нажатием.
  const linkP=call('sel_list').then(r=>r.items.find(x=>x.id===data.id)).catch(()=>null);
  const copy=v=>{let ok=false;try{const t=document.createElement('textarea');t.value=v;t.setAttribute('readonly','');t.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(t);t.focus();t.select();t.setSelectionRange(0,v.length);ok=document.execCommand('copy');t.remove();}catch{/* */}
   if(!ok&&navigator.clipboard)navigator.clipboard.writeText(v).then(()=>status('Ссылка скопирована'),()=>status('Не удалось скопировать — выделите ссылку в поле и скопируйте'));else status(ok?'Ссылка скопирована — вставьте клиенту в мессенджер':'Выделите ссылку в поле и скопируйте');};
  async function clientBox(){
   el.querySelector('details').open=true;
   const s=await linkP;const box=el.querySelector('[data-cl]')||el.querySelector('details').appendChild(Object.assign(document.createElement('div'),{className:'sa-cl'}));box.dataset.cl='1';
   if(!s?.link){box.innerHTML='<p>Ссылки клиенту ещё нет или она закрыта — продлите или создайте её в «<a href="./#sels">Моих подборках</a>».</p>';return;}
   const text=`${data.title}${data.intro?'\n'+data.intro:''}\n${s.link}`;
   box.innerHTML=`<b>🔗 Ссылка для клиента</b>${s.live===false?'<p class="muted">⚠️ Срок ссылки истёк — клиент её не откроет. Продлите в «Моих подборках».</p>':''}<input readonly value="${esc(s.link)}" aria-label="Ссылка для клиента" style="width:100%;box-sizing:border-box;margin:6px 0">
    <div class="sa-btns"><button type="button" class="btn primary" data-cl-copy>📋 Скопировать ссылку</button>${navigator.share?'<button type="button" class="btn soft" data-cl-share>⤴ Поделиться</button>':''}
    <a class="btn soft" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn soft" href="https://t.me/share/url?url=${encodeURIComponent(s.link)}&text=${encodeURIComponent(data.title||'Подборка')}" target="_blank" rel="noopener">Telegram</a></div>`;
   box.onclick=async e=>{if(e.target.closest('[data-cl-copy]'))copy(s.link);if(e.target.closest('[data-cl-share]'))try{await navigator.share({title:data.title||'Подборка',text:data.title||'',url:s.link});}catch{/* отменили */}};
   box.querySelector('input').onfocus=e=>e.target.select();
   box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  window.SELECTION_ACTIONS._cb=clientBox;
  if(!window._saCl){window._saCl=1;document.addEventListener('click',e=>{if(e.target.closest('[data-client-link]')){e.preventDefault();window.SELECTION_ACTIONS._cb?.();}});}
  el.onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,list=nums();if(!list.length&&action!=='client')return status('Выберите хотя бы один объект');b.disabled=true;
   try{
    if(action==='client'){await clientBox();}else if(action==='crm'){
      const r=await call('crm_list');const clients=r.clients||r.items||[];
      const box=document.createElement('dialog');box.style.cssText='max-width:90vw;background:var(--bg,#fff);color:var(--text,#222);padding:20px';
      box.innerHTML=`<h3>Кому добавить ${list.length} объектов</h3>${clients.map(c=>`<p><button type="button" class="btn soft" data-client="${c.id}">${esc(c.name||'Без имени')}</button></p>`).join('')}<button class="btn ghost" data-close>Закрыть</button>`;
      box.onclick=async e=>{if(e.target.closest('[data-close]'))box.close();const c=e.target.closest('[data-client]');if(c){c.disabled=true;try{await call('crm_obj_nums',{client_id:+c.dataset.client,nums:list});status('Объекты добавлены клиенту');box.close();}catch(e){status(e.message);c.disabled=false;}}};box.onclose=()=>box.remove();document.body.append(box);box.showModal();
    }else if(action==='task'){
      const text=prompt('Задача:',`Согласовать показ: ${list.map(n=>'№ '+n).join(', ')}`);if(!text)return;
      const due=prompt('Дата и время по Москве: ГГГГ-ММ-ДД ЧЧ:ММ (можно оставить пустым)','');if(due===null)return;
      const value=due.trim()?due.trim().replace(' ','T')+':00+03:00':null;
      if(value&&!Number.isFinite(Date.parse(value)))throw new Error('Неверная дата');await call('crm_task_save',{text,num:list[0],due:value});status('Задача сохранена');
    }else if(action==='owners'){document.querySelector('#sa-text')?.scrollIntoView({behavior:'smooth'});document.querySelector('#sa-text')?.focus();status('Укажите в тексте время показа и нажмите кнопку нужного мессенджера.');}
    else if(action==='rk'){await call('rk_add',{nums:list});location.href='./#rk';}
    else if(action==='video')location.href=`hub.html#video=${list.join(',')}`;
    else if(action==='deal')location.href=`hub.html#deal=new:${list[0]}`;
    else if(action==='lawyer'||action==='broker')location.href=`hub.html#${action}=ask:n${list[0]}`;
    else {localStorage.setItem('helper_q',JSON.stringify(`${action==='market'?'Сравни с рынком':'Найди похожие варианты для'} объектов ${list.map(n=>'№ '+n).join(', ')}`));location.href='hub.html#helper';}
   }catch(e){status(e.message);}finally{b.disabled=false;}
  };
 }};
})();
