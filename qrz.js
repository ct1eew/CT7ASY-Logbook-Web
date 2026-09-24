export function setupQRZ({form,notice,navigate}){
 const button=document.getElementById('autoQRZ'),login=document.getElementById('qrzLogin'),status=document.getElementById('qrzStatus');
 let key='',revision=0,found=null,enabled=localStorage.getItem('ct7asy-auto-qrz')==='true';
 const paint=()=>button.setAttribute('aria-pressed',String(enabled));paint();
 async function api(action,data){
  let base='';
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){const config=await fetch('./online-config.json',{cache:'no-store'}).then(r=>r.json());const url=new URL(config.serviceUrl);if(url.protocol!=='https:')throw Error('Serviço QRZ não configurado.');base=url.href.replace(/\/$/,'');}
  const response=await fetch(base+'/qrz/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(90000)});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Abre a pré-visualização local com local-preview.py.');
  const result=await response.json();if(!response.ok)throw Error(result.error||'Falha na ligação ao QRZ.');return result;
 }
 const invalidate=()=>{revision++;found=null;};
 form.elements.call.addEventListener('input',invalidate);form.addEventListener('reset',invalidate);
 button.onclick=()=>{enabled=!enabled;paint();localStorage.setItem('ct7asy-auto-qrz',String(enabled));if(!enabled)invalidate();form.elements.call.focus();if(enabled&&!key)notice('Introduz o login QRZ na página Perfis.');};
 login.onsubmit=async e=>{e.preventDefault();const current=++revision;key='';found=null;const submit=login.querySelector('[type=submit]');submit.disabled=true;status.textContent='A ligar…';try{const result=await api('login',{username:login.elements.username.value.trim(),password:login.elements.password.value});if(current!==revision)return;key=result.key;status.textContent=result.message||'QRZ ligado.';}catch(error){if(current===revision)status.textContent=error.message;}finally{login.elements.password.value='';submit.disabled=false;}};
 document.getElementById('qrzLogout').onclick=()=>{key='';invalidate();status.textContent='Desligado';login.elements.password.value='';};
 form.elements.call.addEventListener('keydown',async e=>{
  if(e.key!=='Enter'||e.isComposing||!enabled)return;
  const call=form.elements.call.value.trim().toUpperCase();if(!call)return;
  if(!key){notice('Liga ao QRZ na página Perfis.');return;}
  const current=++revision,snapshot=Object.fromEntries(['name','qth','country'].map(k=>[k,form.elements[k].value]));
  try{const result=await api('lookup',{key,call});if(current!==revision||call!==form.elements.call.value.trim().toUpperCase())return;
   key=result.key||key;for(const field of ['name','qth','country'])if(form.elements[field].value===snapshot[field]&&result[field])form.elements[field].value=result[field];
   found={call,grid:result.grid||''};notice(result.message||'Dados QRZ preenchidos.');
  }catch(error){if(current===revision)notice(error.message);}
 });
 return {invalidate,locator:()=>found?.call===form.elements.call.value.trim().toUpperCase()?found.grid:''};
}
