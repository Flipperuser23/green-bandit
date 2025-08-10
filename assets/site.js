function pad(n){return n.toString().padStart(2,"0")}
function setStamp(){
  const el = document.getElementById('timeStamp');
  if(!el) return;
  const d=new Date();
  const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  el.textContent = ts;
}
setStamp(); setInterval(setStamp, 1000);
const yearEl=document.getElementById('year'); if(yearEl) yearEl.textContent = new Date().getFullYear();

// Theme
const themeBtn = document.getElementById('themeBtn');
const LS_THEME = 'gbfc-theme';
function setTheme(mode){
  document.body.dataset.theme = (mode==='light') ? 'light' : 'dark';
  localStorage.setItem(LS_THEME, mode);
}
themeBtn?.addEventListener('click', ()=>{
  const mode = (localStorage.getItem(LS_THEME)||'dark')==='dark'?'light':'dark';
  setTheme(mode);
});
setTheme(localStorage.getItem(LS_THEME)||'dark');

// Music (optional if file exists)
(function(){
  const a = document.getElementById('bgm');
  const btn = document.getElementById('musicBtn');
  if(!a){ return; }
  let wanted = localStorage.getItem('gbfc-music') || 'on';
  function setIcon(){ if(btn) btn.textContent = (a.paused ? 'Play Theme' : 'Mute Theme'); }
  async function start(){ try{ if(wanted==='on'){ await a.play(); } }catch{} setIcon(); }
  btn?.addEventListener('click', async ()=>{
    if(a.paused){ await a.play(); wanted='on'; } else { a.pause(); wanted='off'; }
    localStorage.setItem('gbfc-music', wanted); setIcon();
  });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden && !a.paused){ a.volume = 0.15; } else { a.volume = 1.0; }});
  start();
})();

// Nav active
(function(){
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('a.link').forEach(a=>{
    if(a.getAttribute('href')===here) a.classList.add('active');
  });
})();

// Sightings local store
const LS_SIGHT = 'gbfc-sightings';
function loadS(){ try{ return JSON.parse(localStorage.getItem(LS_SIGHT)||'[]')}catch(e){return []} }
function saveS(items){ localStorage.setItem(LS_SIGHT, JSON.stringify(items)); }
function renderS(){
  const list = document.getElementById('sightingsList');
  if(!list) return;
  const items = loadS();
  list.innerHTML = '';
  if(!items.length){
    const empty = document.createElement('div'); empty.className='tiny'; empty.textContent='No sightings yet. You could be the first 👀';
    list.appendChild(empty); return;
  }
  for(const it of items){
    const card = document.createElement('div'); card.className='item';
    const h = document.createElement('div'); h.innerHTML = `<strong>${it.where}</strong> <span class="tiny">· ${it.vibe}</span>`;
    const p = document.createElement('div'); p.className='tiny'; p.textContent = it.time;
    const d = document.createElement('div'); d.textContent = it.details;
    card.appendChild(h); card.appendChild(d); card.appendChild(p); list.appendChild(card);
  }
}
function hookSightForm(){
  const f = document.getElementById('sightingForm'); const msg = document.getElementById('saveMsg');
  if(!f) return;
  f.addEventListener('submit', (e)=>{
    e.preventDefault();
    const where = document.getElementById('where').value.trim();
    const details = document.getElementById('details').value.trim();
    const vibe = document.getElementById('vibe').value;
    if(!where || !details){ msg.textContent='Please fill out both fields (PG only).'; return; }
    const items = loadS();
    items.unshift({ where, details, vibe, time: new Date().toLocaleString() });
    saveS(items);
    renderS(); f.reset(); msg.textContent='Saved locally ✔'; setTimeout(()=>msg.textContent='', 1500);
  });
  const clearBtn = document.getElementById('clearBtn');
  clearBtn?.addEventListener('click', ()=>{
    if(confirm('Clear all locally saved sightings?')){ localStorage.removeItem(LS_SIGHT); renderS(); }
  });
}
renderS(); hookSightForm();

// Live Chat (same-port WebSocket at /ws, BroadcastChannel fallback)
let ws;
const chatLog = document.querySelector('.chatlog');
const chatForm = document.getElementById('chatForm');
const chatName = document.getElementById('chatName');
const chatMsg = document.getElementById('chatMsg');
const statusEl = document.getElementById('chatStatus');
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('gbfc-chat') : null;

function appendMsg(who, text){
  if(!chatLog) return;
  const div = document.createElement('div');
  div.className = 'msg ' + (who==='me' ? 'me' : (who==='sys' ? 'sys' : 'them'));
  div.textContent = (who==='sys') ? text : `${who}: ${text}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function startWS(){
  try{
    const proto = (location.protocol==='https:'?'wss':'ws');
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = ()=>{ statusEl && (statusEl.textContent='Connected'); appendMsg('sys','Connected to live chat.'); };
    ws.onmessage = (e)=>{
      try{
        const data = JSON.parse(e.data);
        if(data.type==='chat') appendMsg(data.name || 'anon', data.text || '');
        if(data.type==='sys') appendMsg('sys', data.text || '');
      }catch(err){}
    };
    ws.onclose = ()=>{ statusEl && (statusEl.textContent='Offline'); appendMsg('sys','Server connection closed. Using local channel.'); };
    ws.onerror = ()=>{ statusEl && (statusEl.textContent='Error'); };
  }catch(e){ statusEl && (statusEl.textContent='Unavailable'); }
}
if(chatForm){
  startWS();
  if(bc){ bc.onmessage = (e)=>{ const data = e.data; if(data && data.type==='chat') appendMsg(data.name || 'anon', data.text || ''); }; }
  chatForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = chatName.value.trim() || 'anon';
    const text = chatMsg.value.trim();
    if(!text) return;
    const payload = { type:'chat', name, text };
    appendMsg('me', text);
    if(ws && ws.readyState===1) ws.send(JSON.stringify(payload));
    else if(bc) bc.postMessage(payload);
    chatMsg.value='';
  });
}

// Uploads
const fileInput = document.getElementById('media');
const preview = document.getElementById('preview');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMsg = document.getElementById('uploadMsg');
function addPreview(file, url){
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption'); cap.className='tiny'; cap.textContent = file.name;
  if(file.type.startsWith('image/')){ const img = document.createElement('img'); img.src = url; fig.appendChild(img); }
  else if(file.type.startsWith('video/')){ const vid = document.createElement('video'); vid.src = url; vid.controls = true; fig.appendChild(vid); }
  else { const div = document.createElement('div'); div.textContent = 'Unsupported file'; fig.appendChild(div); }
  fig.appendChild(cap); preview?.appendChild(fig);
}
if(fileInput){
  fileInput.addEventListener('change', ()=>{
    preview.innerHTML = '';
    [...fileInput.files].forEach(f=> addPreview(f, URL.createObjectURL(f)));
  });
}
async function doUpload(){
  if(!fileInput || !fileInput.files.length){ uploadMsg.textContent='Pick image/video files first.'; return; }
  const fd = new FormData();
  [...fileInput.files].forEach(f=> fd.append('media', f));
  try{
    const res = await fetch('/upload', { method:'POST', body: fd });
    if(!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    uploadMsg.textContent = 'Uploaded ✔ — ' + (data.files || []).map(x=>x.url).join(', ');
  }catch(e){
    uploadMsg.textContent = 'Upload failed.';
  }
}
uploadBtn?.addEventListener('click', doUpload);
