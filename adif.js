export const bands=['160m','80m','60m','40m','30m','20m','17m','15m','12m','10m','6m','4m','2m','70cm','23cm'];
export const modes=['LSB','USB','CW','FM','AM','FT8','FT4','RTTY','PSK31','JS8','Q65','MSK144','JT65','JT9','DSTAR','DMR','C4FM','SSB','MFSK','PSK','DATA'];
export function bandFor(freq){const f=Number(freq);return [[1.8,2,'160m'],[3.5,4,'80m'],[5,5.5,'60m'],[7,7.3,'40m'],[10.1,10.15,'30m'],[14,14.35,'20m'],[18.068,18.168,'17m'],[21,21.45,'15m'],[24.89,24.99,'12m'],[28,29.7,'10m'],[50,54,'6m'],[70,71,'4m'],[144,148,'2m'],[420,450,'70cm'],[1240,1300,'23cm']].find(([a,b])=>f>=a&&f<=b)?.[2]||'';}
export function validate(c){
 if(!/^[A-Z0-9/\-]{2,30}$/i.test(c.call||''))throw Error('Indicativo inválido.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(c.date||'')||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(c.time||''))throw Error('Data ou hora UTC inválida.');
 const d=new Date(c.date+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==c.date)throw Error('Data UTC inválida.');
 if(c.freq!==''&&(!Number.isFinite(Number(c.freq))||Number(c.freq)<=0||Number(c.freq)>100000))throw Error('Frequência inválida.');
 if(!c.mode)throw Error('Falta o modo.');
 return c;
}
const field=(k,v)=>{v=String(v??'');return v?`<${k}:${Array.from(v).length}>${v}`:'';};
export function exportADIF(contacts){return 'CT7ASY Logbook Web\n<ADIF_VER:5>3.1.4<PROGRAMID:18>CT7ASY Logbook Web<EOH>\n'+contacts.map(c=>{const f={CALL:c.call,NAME:c.name,GRIDSQUARE:(c.locator||'').slice(0,8),GRIDSQUARE_EXT:(c.locator||'').slice(8),FREQ:c.freq,BAND:c.band,MODE:c.mode,QSO_DATE:c.date.replaceAll('-',''),TIME_ON:c.time.replaceAll(':','').padEnd(6,'0'),RST_SENT:c.rst_sent,RST_RCVD:c.rst_rcvd,QTH:c.qth,COUNTRY:c.country,COMMENT:c.notes,STATION_CALLSIGN:c.station,MY_GRIDSQUARE:(c.station_locator||'').slice(0,8),MY_GRIDSQUARE_EXT:(c.station_locator||'').slice(8),APP_CT7ASY_KIND:c.kind,SWL:c.kind==='SWL'?'Y':'N'};if(c.mode==='FT4'){f.MODE='MFSK';f.SUBMODE='FT4';}if(['USB','LSB'].includes(c.mode)){f.MODE='SSB';f.SUBMODE=c.mode;}if(c.mode==='PSK31'){f.MODE='PSK';f.SUBMODE='PSK31';}return Object.entries(f).map(([k,v])=>field(k,v)).join('')+'<EOR>\n';}).join('');}
export function parseADIF(text){
 let pos=0,record={},records=[];
 while(pos<text.length){const start=text.indexOf('<',pos);if(start<0)break;const end=text.indexOf('>',start);if(end<0)throw Error('ADIF incompleto.');const [raw,len]=text.slice(start+1,end).split(':');const key=raw.trim().toUpperCase();pos=end+1;
  if(key==='EOH'){record={};records=[];continue;}if(key==='EOR'){if(Object.keys(record).length)records.push(record);record={};continue;}
  if(len!==undefined){if(!/^\d+$/.test(len)||Number(len)>2000000)throw Error('Comprimento ADIF inválido.');let value='',count=0;while(count<Number(len)&&pos<text.length){const ch=String.fromCodePoint(text.codePointAt(pos));value+=ch;pos+=ch.length;count++;}if(count!==Number(len))throw Error('Campo ADIF incompleto.');record[key]=value;}
 }
 if(Object.keys(record).length)throw Error('Falta <EOR> no último contacto.');
 if(!records.length)throw Error('O ficheiro não contém contactos ADIF.');
 return records.map((r,i)=>{const date=r.QSO_DATE||'',time=r.TIME_ON||'';try{if(!/^\d{8}$/.test(date)||!/^\d{4}(\d{2})?$/.test(time))throw Error('Data ou hora UTC inválida.');return validate({call:(r.CALL||'').toUpperCase(),name:r.NAME||'',locator:(r.GRIDSQUARE||'')+(r.GRIDSQUARE_EXT||''),freq:r.FREQ||'',band:r.BAND||bandFor(r.FREQ),mode:r.SUBMODE||r.MODE||'',date:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6),time:time.slice(0,2)+':'+time.slice(2,4)+(time.length===6?':'+time.slice(4):''),rst_sent:r.RST_SENT||'',rst_rcvd:r.RST_RCVD||'',qth:r.QTH||'',country:r.COUNTRY||'',notes:r.COMMENT||r.NOTES||'',station:r.STATION_CALLSIGN||'',station_locator:(r.MY_GRIDSQUARE||'')+(r.MY_GRIDSQUARE_EXT||''),kind:r.SWL==='Y'||r.APP_CT7ASY_KIND==='SWL'?'SWL':'QSO'});}catch(e){throw Error(`Contacto ${i+1}: ${e.message}`);}});
}
export function fingerprint(c){return JSON.stringify([c.call,c.date,c.time.length===5?c.time+':00':c.time,c.freq?Number(c.freq):'',c.band,c.mode,c.station,c.station_locator,c.kind,c.name||'',c.qth||'',c.country||'',c.rst_sent||'',c.rst_rcvd||'',c.notes||'',c.locator||'']);}
