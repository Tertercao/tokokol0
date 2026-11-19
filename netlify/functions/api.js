const c=require('crypto'),E=process.env,b=s=>Buffer.from(s).toString('base64url');
const T={Stores:['id','name'],Users:['id','store','username','hash','role','name'],Products:['id','store','name','category','price','cost','stock','barcode'],Sales:['id','store','date','user','items','total','method','discount','tax','status']};
const N=['price','cost','stock','total','discount','tax'],FL={};
let tk,ex=0;
async function gt(){if(Date.now()<ex)return tk;const n=Math.floor(Date.now()/1e3),h=b(JSON.stringify({alg:'RS256',typ:'JWT'})),p=b(JSON.stringify({iss:E.GOOGLE_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:n,exp:n+3600})),s=c.sign('RSA-SHA256',Buffer.from(h+'.'+p),(E.GOOGLE_KEY||'').replace(/\\n/g,'\n')).toString('base64url');
const r=await(await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion='+h+'.'+p+'.'+s})).json();
if(!r.access_token)throw new Error('Gagal masuk Google: cek GOOGLE_EMAIL & GOOGLE_KEY');tk=r.access_token;ex=Date.now()+3e6;return tk}
const g=async(u,o={})=>{const r=await(await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+E.SHEET_ID+u,{...o,headers:{Authorization:'Bearer '+await gt(),'Content-Type':'application/json'}})).json();if(r.error)throw new Error('Sheets: '+r.error.message);return r};
const row=(t,o)=>T[t].map(k=>N.includes(k)&&o[k]!==undefined&&o[k]!==''?+o[k]:o[k]??'');
const all=async t=>((await g(`/values/${t}!A2:Z`)).values||[]).map((v,i)=>({_r:i+2,...Object.fromEntries(T[t].map((k,j)=>[k,v[j]??'']))})).filter(o=>o.id);
const add=(t,o)=>g(`/values/${t}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{method:'POST',body:JSON.stringify({values:[row(t,o)]})});
const put=(t,o)=>g(`/values/${t}!A${o._r}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({values:[row(t,o)]})});
const sg=p=>c.createHmac('sha256',E.JWT_SECRET||'').update(p).digest('base64url');
const tok=o=>{const p=b(JSON.stringify({...o,exp:Date.now()+432e5}));return p+'.'+sg(p)};
const ver=t=>{const[p,s]=(t||'').split('.');if(!s||sg(p)!==s)return;const o=JSON.parse(Buffer.from(p,'base64url'));return o.exp>Date.now()?o:0};
const hs=(w,s=c.randomBytes(8).toString('hex'))=>s+':'+c.scryptSync(String(w),s,32).toString('hex');
const id=()=>Date.now().toString(36)+c.randomBytes(2).toString('hex');
const bad=m=>{throw new Error(m)};

exports.handler=async e=>{
const out=(s,x)=>({statusCode:s,headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});
try{
const{a,d={}}=JSON.parse(e.body||'{}');
if(a==='setup'){
 if(!E.SETUP_KEY||d.key!==E.SETUP_KEY)bad('Kunci setup salah / SETUP_KEY belum diisi');
 const have=(await g('')).sheets.map(s=>s.properties.title),miss=Object.keys(T).filter(t=>!have.includes(t));
 if(miss.length)await g(':batchUpdate',{method:'POST',body:JSON.stringify({requests:miss.map(title=>({addSheet:{properties:{title}}}))})});
 for(const t of miss)await put(t,{_r:1,...Object.fromEntries(T[t].map(k=>[k,k]))});
 if(!(await all('Users')).length){await add('Stores',{id:'s1',name:'Toko Utama'});await add('Users',{id:'u1',store:'s1',username:d.username,hash:hs(d.password),role:'superadmin',name:'Superadmin'})}
 return out(200,{msg:'Setup selesai. Silakan masuk.'})}
if(a==='login'){
 const k=String(d.username||'').trim().toLowerCase(),f=FL[k]&&Date.now()-FL[k].t<6e5?FL[k]:{n:0,t:0};if(f.n>=5)bad('Terlalu banyak percobaan gagal. Coba lagi 10 menit lagi.');
 const x=(await all('Users')).find(u=>u.username===String(d.username||'').trim()&&u.hash===hs(d.password||'',u.hash.split(':')[0]));
 if(!x){FL[k]={n:f.n+1,t:Date.now()};bad('Username atau password salah')}
 delete FL[k];
 const st=(await all('Stores')).find(s=>s.id===x.store)||{};
 return out(200,{token:tok({id:x.id,store:x.store,role:x.role,name:x.name}),me:{name:x.name,role:x.role,store:x.store,storeName:st.name}})}
const u=ver((e.headers.authorization||'').slice(7));if(!u)bad('Sesi habis, silakan masuk lagi');
const sa=u.role==='superadmin',adm=u.role!=='user',sid=sa&&d.store?d.store:u.store,need=ok=>{if(!ok)bad('Tidak punya akses')},t=d.t;

if(a==='chpw'){const x=(await all('Users')).find(r=>r.id===u.id);if(!x||x.hash!==hs(d.old||'',x.hash.split(':')[0]))bad('Password lama salah');if(String(d.nw||'').length<6)bad('Password baru minimal 6 karakter');await put('Users',{...x,hash:hs(d.nw)});return out(200,{})}
if(a==='list'){
 need(['Products','Stores'].includes(t)||(t==='Users'&&adm));
 let r=await all(t);r=t==='Stores'?(sa?r:r.filter(s=>s.id===u.store)):r.filter(x=>x.store===sid);
 return out(200,r.map(({hash,...x})=>x))}

if(a==='save'||a==='del'){
 need(t==='Stores'?sa:adm&&['Products','Users'].includes(t));
 const k=d.id||(d.o&&d.o.id),x=k?(await all(t)).find(r=>r.id===k&&(t==='Stores'||r.store===sid)):null;
 if(k&&!x)bad('Data tidak ditemukan');
 if(t==='Users'&&x&&((x.role==='superadmin'&&!sa)||(a==='del'&&x.id===u.id)))bad('Tidak diizinkan');
 if(a==='del'){if(!x)bad('Data tidak ditemukan');await put(t,{_r:x._r});return out(200,{})}
 const o={...x};for(const f of T[t])if(!['id','store','hash','role'].includes(f)&&d.o[f]!==undefined)o[f]=d.o[f];
 if(!o.name)bad('Nama wajib diisi');
 if(!x){o.id=id();if(t!=='Stores')o.store=sid}
 if(t==='Users'){
  o.role=sa?(['user','admin','superadmin'].includes(d.o.role)?d.o.role:'user'):(x?x.role:'user');
  if(d.o.password)o.hash=hs(d.o.password);else if(!x)bad('Password wajib diisi');
  if(!o.username)bad('Username wajib diisi');
  if((await all('Users')).some(r=>r.username===o.username&&r.id!==o.id))bad('Username sudah dipakai')}
 x?await put(t,o):await add(t,o);return out(200,{id:o.id})}

if(a==='sale'){
 const ps=(await all('Products')).filter(p=>p.store===sid),items=[];
 if(!Array.isArray(d.items)||!d.items.length)bad('Keranjang kosong');
 for(const it of d.items){const q=parseInt(it.q),p=ps.find(x=>x.id===it.id);if(!p||!(q>0))bad('Item tidak valid');if(+p.stock<q)bad('Stok kurang: '+p.name);items.push({i:p.id,n:p.name,q,p:+p.price,c:+p.cost});p.stock=+p.stock-q;await put('Products',p)}
 const sub=items.reduce((s,i)=>s+i.p*i.q,0),ds=Math.min(Math.max(+d.discount||0,0),sub),tx=Math.min(Math.max(+d.tax||0,0),100),total=Math.round((sub-ds)*(1+tx/100));
 const sale={id:id(),store:sid,date:new Date().toISOString(),user:u.name,items:JSON.stringify(items),total,method:['Tunai','QRIS','Transfer'].includes(d.method)?d.method:'Tunai',discount:ds,tax:tx,status:'ok'};
 await add('Sales',sale);return out(200,{...sale,items,subtotal:sub})}
if(a==='void'){need(adm);const s=(await all('Sales')).find(r=>r.id===d.id&&r.store===sid);if(!s)bad('Transaksi tidak ditemukan');if(s.status==='batal')bad('Sudah dibatalkan');
 const ps=await all('Products');for(const i of JSON.parse(s.items)){const p=ps.find(x=>x.store===sid&&(i.i?x.id===i.i:x.name===i.n));if(p){p.stock=+p.stock+i.q;await put('Products',p)}}
 await put('Sales',{...s,status:'batal'});return out(200,{})}

if(a==='report'){need(adm);return out(200,(await all('Sales')).filter(s=>s.store===sid).slice(-500))}
bad('Aksi tidak dikenal')
}catch(err){return out(400,{error:err.message})}};
