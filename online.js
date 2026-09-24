import {spotLocation} from './dx-location.js';
import {locatorPosition} from './map.js';
import {bandFor} from './adif.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let autoTimer,calculating=false,calculationQueued=false;
let connectionRevision=0;
let base='',token='',timer,spots=[],selected=null,epoch=0,table=null,hooks;
export function setupOnline(callbacks){
 hooks=callbacks;
 $('dxConnect').onclick=connect;$('dxDisconnect').onclick=disconnect;
 $('dxBand').onchange=renderSpots;$('dxMode').onchange=renderSpots;
 $('dxRows').onclick=e=>{const b=e.target.closest('[data-spot]');if(b){selected=spots.find(s=>s.id===Number(b.dataset.spot));renderSpots();}};
 $('dxToLog').onclick=()=>{const s=spots.find(s=>s.id===selected?.id);if(s)hooks.toLog({...s,mode:spotMode(s)});};
 $('dxToPropagation').onclick=()=>{
  if(!selected)return;
  epoch++;table=null;
  const location=spotLocation(selected,hooks.contacts());
  $('propFrequency').value=selected.freq;$('propTarget').textContent='· DX Cluster · '+selected.call;
  $('propTX').value=hooks.profile()?.locator||'';$('propRX').value=location.grid;
  $('propSource').textContent=location.source;
  const m=spotMode(selected);$('propMode').value=({CW:'19',FT8:'13',FT4:'17',AM:'49'})[m]||'38';
  hooks.navigate('propagation');drawWheel();
  if(locatorPosition($('propTX').value)&&location.grid)calculate();
  else $('propStatus').textContent=location.grid?'Preencha o locator TX no perfil da estação ou neste campo.':'Introduza o locator RX para calcular.';
 };
 $('propForm').onsubmit=e=>{e.preventDefault();calculate();};
 const changed=e=>{
  if(e.target.id==='propRX')$('propSource').textContent='Locator introduzido manualmente.';
  epoch++;table=null;drawWheel();clearTimeout(autoTimer);calculationQueued=false;
  if(!validPrediction()){$('propStatus').textContent='Preencha locators válidos e uma potência entre 1 e 1500 W.';return;}
  $('propStatus').textContent='A atualizar…';autoTimer=setTimeout(calculate,500);
 };
 $('propForm').oninput=changed;$('propForm').onchange=changed;
 $('propTX').value=hooks.profile()?.locator||'';drawWheel();
 addEventListener('offline',()=>{epoch++;clearTimeout(autoTimer);calculationQueued=false;clearTimeout(timer);$('dxStatus').textContent='Sem Internet. A ligação será retomada quando regressar à aplicação com rede.';$('propStatus').textContent='Sem Internet. A previsão requer ligação.';});
 addEventListener('online',()=>{if(token)poll();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)closeCluster();});
 addEventListener('pagehide',closeCluster);
 fetch('./online-config.json',{cache:'no-store'}).then(r=>r.json()).then(c=>{if(c.serviceUrl){const u=new URL(c.serviceUrl);if(u.protocol!=='https:'&&u.hostname!=='127.0.0.1')throw Error('Endereço do serviço inválido.');base=u.href.replace(/\/$/,'');$('serviceStatus').textContent='Serviço online configurado. O primeiro pedido pode demorar cerca de um minuto.';loadServers();}else $('serviceStatus').textContent='A aguardar ativação do serviço online.';}).catch(()=>$('serviceStatus').textContent='Não foi possível verificar o serviço online.');
}
export function enterOnline(page){if(page==='propagation'&&!$('propTX').value)$('propTX').value=hooks.profile()?.locator||'';if(page==='dx'&&!$('dxCall').value)$('dxCall').value=hooks.profile()?.station||'';}
async function api(path,data,auth=token){
 if(!navigator.onLine)throw Error('Esta função precisa de Internet.');if(!base)throw Error('O serviço online ainda não está ativado.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),95000);
 try{const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(auth?{Authorization:'Bearer '+auth}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal,cache:'no-store'});const result=await r.json();if(!r.ok){const e=Error(result.error||'Serviço indisponível.');e.status=r.status;throw e;}return result;}catch(e){if(e.name==='AbortError')throw Error('O serviço não respondeu a tempo. Tente novamente.');throw e;}finally{clearTimeout(timeout);}
}
async function loadServers(){try{const r=await api('/servers');$('dxServer').innerHTML=r.servers.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');}catch(e){$('dxStatus').textContent=e.message;}}
function releaseCluster(sessionToken){
 if(!sessionToken||!base)return;
 // A simple text request avoids an authentication preflight during page shutdown.
 try{if(navigator.sendBeacon?.(base+'/dx/disconnect',sessionToken))return;}catch{}
 fetch(base+'/dx/disconnect',{method:'POST',body:sessionToken,keepalive:true,credentials:'omit'}).catch(()=>{});
}
function resetCluster(){
 connectionRevision++;const previous=token;token='';clearTimeout(timer);spots=[];selected=null;
 renderSpots();$('dxStatus').textContent='Desligado';$('dxConnect').disabled=false;$('dxDisconnect').disabled=true;$('dxServer').disabled=false;$('dxCall').disabled=false;
 return previous;
}
function closeCluster(){releaseCluster(resetCluster());}
async function connect(){
 if(token||document.hidden)return;
 const revision=++connectionRevision;
 $('dxConnect').disabled=true;$('dxStatus').textContent='A ligar…';
 try{
  const r=await api('/dx/connect',{server:$('dxServer').value,call:$('dxCall').value.trim().toUpperCase()});
  if(revision!==connectionRevision||document.hidden){releaseCluster(r.token);return;}
  token=r.token;$('dxDisconnect').disabled=false;$('dxServer').disabled=true;$('dxCall').disabled=true;await poll();
 }catch(e){if(revision===connectionRevision)$('dxStatus').textContent=e.message;}
 finally{if(revision===connectionRevision&&!token)$('dxConnect').disabled=false;}
}
async function disconnect(){const previous=resetCluster();if(previous)try{await api('/dx/disconnect',{},previous);}catch{releaseCluster(previous);}}

let polling=false;
async function poll(){if(polling||!token||document.hidden||!navigator.onLine)return;polling=true;const current=token;try{const r=await api('/dx/status');if(token!==current)return;spots=r.spots;$('dxStatus').textContent=r.status+' · '+new Date().toLocaleTimeString('pt-PT');renderSpots();}catch(e){if(token!==current)return;$('dxStatus').textContent=e.message;if(e.status===410){await disconnect();$('dxStatus').textContent='A ligação expirou. Toque em Ligar para retomar.';}}finally{polling=false;if(token&&navigator.onLine&&!document.hidden)timer=setTimeout(poll,5000);}}
function spotMode(s){const m=String(s.comment||'').toUpperCase().match(/\b(FT8|FT4|CW|USB|LSB|SSB|FM|AM|RTTY|PSK31|JS8|Q65|DSTAR|DMR|C4FM)\b/);return m?m[1]:'';}
function renderSpots(){const list=spots.filter(s=>(!$('dxBand').value||bandFor(s.freq)===$('dxBand').value)&&(!$('dxMode').value||spotMode(s)===$('dxMode').value));if(!list.some(s=>s.id===selected?.id))selected=null;$('dxRows').innerHTML=list.map(s=>`<button type="button" data-spot="${s.id}" class="spot ${s.id===selected?.id?'spot-selected':''}" aria-pressed="${s.id===selected?.id}"><strong>${esc(s.call)}</strong><span>${Number(s.freq).toFixed(3)} MHz · ${esc(bandFor(s.freq))} · ${esc(spotMode(s)||'Modo não identificado')}</span><small>${esc(s.time)} UTC · ${esc(s.comment)} · ${esc(s.spotter)}</small></button>`).join('')||'<p class="muted">Sem spots para os filtros selecionados.</p>';$('dxToLog').disabled=$('dxToPropagation').disabled=!selected;}
function validPrediction(){return $('propForm').checkValidity()&&locatorPosition($('propTX').value)&&locatorPosition($('propRX').value);}
async function calculate(){
 clearTimeout(autoTimer);
 if(!validPrediction()){$('propStatus').textContent='Preencha locators válidos e uma potência entre 1 e 1500 W.';return;}
 // Complete the current request before sending the latest inputs to the server.
 if(calculating){calculationQueued=true;return;}
 calculationQueued=false;calculating=true;
 const data=Object.fromEntries(new FormData($('propForm'))),current=++epoch;
 data.tx=data.tx.trim().toUpperCase();data.rx=data.rx.trim().toUpperCase();
 table=null;drawWheel();$('propCalculate').disabled=true;$('propStatus').textContent='A calcular…';
 try{
  const r=await api('/propagation',{...data,power:Number(data.power),rxantenna:data.txantenna});
  if(epoch!==current)return;
  table=r.table;drawWheel();$('propStatus').textContent='Previsão: '+r.date.split('-').reverse().join('-')+' · Horas locais';
 }catch(e){if(epoch===current)$('propStatus').textContent=e.message;}
 finally{calculating=false;$('propCalculate').disabled=false;if(calculationQueued){calculationQueued=false;calculate();}}
}
function localHour(hour){const day=new Date();day.setUTCHours(hour,0,0,0);return day.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit',hour12:false});}
function drawWheel(){
 const bands=[['3','80m'],['5','60m'],['7','40m'],['10','30m'],['14','20m'],['18','17m'],['21','15m'],['24','12m'],['28','10m']];const hour=new Date().getUTCHours(),band=bandFor($('propFrequency').value);let svg='<svg viewBox="0 0 500 500" role="group" aria-label="Previsão por banda e hora local">';
 const pt=(r,a)=>[250+r*Math.sin(a),250-r*Math.cos(a)].join(' ');
 for(let h=0;h<24;h++){const a=(h-.5)*Math.PI/12,b=(h+.5)*Math.PI/12;svg+=`<text x="${250+233*Math.sin(h*Math.PI/12)}" y="${254-233*Math.cos(h*Math.PI/12)}" text-anchor="middle" fill="#bbd4e5" font-size="11">${localHour(h).replace(/:00$/,'')}</text>`;bands.forEach(([key,label],i)=>{const inner=52+i*18,outer=inner+18,v=table?Number(table[h][key]):null,chosen=h===hour&&(!band||label===band),d=`M ${pt(inner,a)} L ${pt(outer,a)} A ${outer} ${outer} 0 0 1 ${pt(outer,b)} L ${pt(inner,b)} A ${inner} ${inner} 0 0 0 ${pt(inner,a)} Z`;svg+=`<path d="${d}" fill="${v===null?'#344859':`hsl(${(1-v)*180},95%,48%)`}" stroke="${chosen?'#fff':'#082235'}" stroke-width="${chosen?1.4:.7}" tabindex="0" role="button" data-hour="${h}" data-band="${label}" data-value="${v===null?'—':Math.round(v*100)+'%'}" aria-label="${localHour(h)} local, ${label}, ${v===null?'sem previsão':Math.round(v*100)+'%'}"/>`;});}
 svg+='<text id="wheelHour" x="250" y="240" text-anchor="middle" fill="white" font-size="13">Hora local</text><text id="wheelBand" x="250" y="259" text-anchor="middle" fill="white" font-size="13">Banda</text><text id="wheelValue" x="250" y="278" text-anchor="middle" fill="white" font-size="13">—</text>';
 bands.forEach(([,label],i)=>svg+=`<text x="250" y="${250-(61+i*18)+4}" text-anchor="middle" fill="white" stroke="#071f34" stroke-width="3" paint-order="stroke" font-size="10" pointer-events="none">${label}</text>`);$('propWheel').innerHTML=svg+'</svg>';
 const update=e=>{const p=e.target.closest('path[data-hour]');if(!p)return;$('wheelHour').textContent=localHour(Number(p.dataset.hour))+' local';$('wheelBand').textContent=p.dataset.band;$('wheelValue').textContent=p.dataset.value;};$('propWheel').onclick=update;$('propWheel').onfocusin=update;
}
