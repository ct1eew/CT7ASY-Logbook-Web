export function locatorPosition(value){
 const s=String(value||'').trim().toUpperCase();
 if(!/^[A-R]{2}\d{2}(?:[A-X]{2}(?:\d{2}(?:[A-X]{2})?)?)?$/.test(s))return null;
 let lon=-180+(s.charCodeAt(0)-65)*20,lat=-90+(s.charCodeAt(1)-65)*10,dx=20,dy=10;
 for(let i=2;i<s.length;i+=2){const numeric=i%4===2,n=numeric?10:24;dx/=n;dy/=n;lon+=(numeric?Number(s[i]):s.charCodeAt(i)-65)*dx;lat+=(numeric?Number(s[i+1]):s.charCodeAt(i+1)-65)*dy;}
 return [lat+dy/2,lon+dx/2];
}
const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let map,layer,tiles,latest,markers=new Map();
export function showMap(state,profile){
 latest={state,profile};
 if(!map){
  map=L.map('contactMap',{zoomControl:true}).setView([30,-15],2);
  tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
  tiles.on('tileerror',()=>{document.getElementById('mapNetwork').textContent='Não foi possível carregar o fundo do mapa. As posições guardadas continuam disponíveis.';});
  layer=L.layerGroup().addTo(map);
  document.getElementById('mapSearch').oninput=()=>draw();
  document.getElementById('mapFit').onclick=()=>draw(true);
  document.getElementById('mapResults').onclick=e=>{const b=e.target.closest('[data-map-id]');if(!b)return;const marker=markers.get(b.dataset.mapId);if(marker){map.setView(marker.getLatLng(),8);marker.openPopup();}};
  addEventListener('online',network);addEventListener('offline',network);
 }
 network();map.invalidateSize();draw(true);
}
function network(){const el=document.getElementById('mapNetwork');if(navigator.onLine){if(!map.hasLayer(tiles))tiles.addTo(map);el.textContent='Mapa online · posições aproximadas pelo centro do locator.';}else{if(map.hasLayer(tiles))map.removeLayer(tiles);el.textContent='Sem Internet: posições disponíveis, fundo cartográfico indisponível.';}}
function draw(fit=false){
 layer.clearLayers();markers.clear();const points=[],q=document.getElementById('mapSearch').value.trim().toLowerCase();
 const station=locatorPosition(latest.profile?.locator);
 if(station){L.circleMarker(station,{radius:10,color:'#071f34',weight:3,fillColor:'#38bdf8',fillOpacity:1}).addTo(layer).bindPopup('<strong>A minha estação · '+escape(latest.profile.station)+'</strong><br>'+escape(latest.profile.locator));points.push(station);}
 const contacts=latest.state.contacts.filter(c=>[c.call,c.name,c.qth,c.country].some(v=>String(v||'').toLowerCase().includes(q)));let located=0;
 document.getElementById('mapResults').innerHTML=contacts.map(c=>{const pos=locatorPosition(c.locator);if(pos){located++;points.push(pos);const marker=L.circleMarker(pos,{radius:8,color:'#082334',weight:2,fillColor:'#ffbf47',fillOpacity:1}).addTo(layer).bindPopup('<strong>'+escape(c.call)+'</strong><br>'+escape(c.locator)+' · '+escape(c.band)+' · '+escape(c.mode)+'<br>'+escape(c.date)+' '+escape(c.time)+' UTC');markers.set(c.id,marker);}return '<button type="button" data-map-id="'+escape(c.id)+'" '+(!pos?'disabled':'')+'>'+escape(c.call)+' · '+escape(c.band)+' · '+(pos?escape(c.locator):'Sem locator')+'</button>';}).join('')||'<p class="muted">Nenhum contacto encontrado.</p>';
 document.getElementById('mapCount').textContent=located+' no mapa · '+(contacts.length-located)+' sem localização';
 if(fit&&points.length)map.fitBounds(points,{padding:[35,35],maxZoom:8});
}
