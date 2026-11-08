(() => {
  window.FILTER_PRESETS = {mount(el,scope,get,set) {
    if (!el || el.querySelector('[data-filter-presets]')) return;
    const box=document.createElement('div');box.dataset.filterPresets='';box.className='chips';
    box.innerHTML='<select aria-label="Сохранённые фильтры"><option value="">Сохранённые фильтры</option></select><button type="button" class="btn ghost" data-save>Сохранить фильтр</button><button type="button" class="btn ghost" data-delete>Удалить фильтр</button><span role="status"></span>';
    el.append(box);const select=box.querySelector('select'),status=box.querySelector('[role=status]');let rows=[],busy=false;
    const call=async(op,extra={})=>{const token=JSON.parse(localStorage.getItem('token')||'null');const r=await fetch(window.API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'filter_presets',auth:{token},scope,op,...extra})});const d=await r.json();if(!r.ok||d.error)throw new Error(d.message||'Не удалось сохранить фильтр');return d;};
    const load=async()=>{rows=(await call('list')).items;select.replaceChildren(new Option('Сохранённые фильтры',''),...rows.map((r,i)=>new Option(r.name,String(i))));};
    select.onchange=()=>{if(select.value!=='')set(rows[Number(select.value)].value);};
    box.onclick=async e=>{if(busy)return;const save=e.target.closest('[data-save]'),del=e.target.closest('[data-delete]');if(!save&&!del)return;
      let name=save?prompt('Название фильтра (до 60 знаков)'):rows[Number(select.value)]?.name;
      if(del&&select.value==='')return;name=name?.trim();if(!name)return;
      if(del&&!confirm(`Удалить фильтр «${name}»?`))return;
      busy=true;try{await call(save?'save':'delete',{name,value:save?get():undefined});await load();status.textContent=save?'Фильтр сохранён':'Фильтр удалён';}catch(e){status.textContent=e.message;}finally{busy=false;}
    };load().catch(e=>status.textContent=e.message);
  }};
})();
