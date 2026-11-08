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
   <button class="btn soft" data-action="client">Ссылка клиенту / в мессенджер</button>
   <button class="btn soft" data-action="crm">В CRM клиенту</button><button class="btn soft" data-action="task">Поставить задачу</button>
   <button class="btn soft" data-action="owners">Написать собственникам / показ</button>
   ${me.can_rk?'<button class="btn soft" data-action="rk">В рекламу</button>':''}
   ${me.can_mail?`<a class="btn soft" href="mail.html?selection=${data.id}">В рассылку с правками</a>`:''}
   ${me.plan==='max'||me.role==='admin'?'<button class="btn soft" data-action="video">Видео и СММ</button>':''}
   <button class="btn soft" data-action="deal">В сделку</button><button class="btn soft" data-action="lawyer">Проверка юриста</button><button class="btn soft" data-action="broker">Ипотека</button>
   <button class="btn soft" data-action="market">Сравнить с рынком</button><button class="btn soft" data-action="similar">Похожие объекты</button>
   </div><p data-status role="status"></p></details>`;
  const status=m=>el.querySelector('[data-status]').textContent=m;
  el.onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,list=nums();if(!list.length)return status('Выберите хотя бы один объект');b.disabled=true;
   try{
    if(action==='client'){
      const r=await call('sel_list');const selection=r.items.find(x=>x.id===data.id);if(!selection?.link)throw new Error('Сначала продлите или создайте ссылку клиенту в «Моих подборках»');
      const phone=prompt('Телефон клиента для WhatsApp. Оставьте пустым, чтобы скопировать ссылку:','');if(phone===null)return;
      const text=`${data.title}\n${data.intro||''}\n${selection.link}`;
      if(phone.trim()){const digits=phone.replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');if(!/^\d{11,15}$/.test(digits))throw new Error('Укажите телефон с кодом страны');window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`,'_blank','noopener');}
      else {await navigator.clipboard.writeText(text);status('Ссылка и текст скопированы');}
    }else if(action==='crm'){
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
