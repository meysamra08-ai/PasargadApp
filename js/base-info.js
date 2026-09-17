(function(){
'use strict';
let rows=[];
function fy(){return String(localStorage.getItem('pasargadFiscalYear')||'1405').replace(/[^0-9]/g,'')||'1405';}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fa(v){return String(v??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);}
window.baseInfoLoadCustomers=async function(){
 const body=document.getElementById('baseInfoCustomerRows'); if(!body)return;
 try{const r=await window.pasargad.getCustomers({fiscalYear:fy()}); if(!r?.success)throw Error(r?.error||'خطا'); rows=r.customers||[]; window.baseInfoRenderCustomers();}
 catch(e){console.error('base info customers:',e);body.innerHTML='<tr><td colspan="5" class="customer-empty">خطا در دریافت اطلاعات مشتریان.</td></tr>';}
};
window.baseInfoRenderCustomers=function(){
 const body=document.getElementById('baseInfoCustomerRows'); if(!body)return;
 const q=(document.getElementById('baseInfoCustomerSearch')?.value||'').trim().toLowerCase();
 const filtered=rows.filter(c=>(`${c.name||''} ${c.mobile||''} ${c.phone||''}`).toLowerCase().includes(q));
 const count=document.getElementById('baseInfoCustomerCount'); if(count)count.textContent=fa(filtered.length)+' مشتری';
 body.innerHTML=filtered.length?filtered.map((c,i)=>`<tr><td>${fa(i+1)}</td><td>${esc(c.name||'—')}</td><td>${esc(c.mobile||'—')}</td><td>${esc(c.phone||'—')}</td><td><button class="base-info-action" type="button" onclick="baseInfoEditCustomer(${Number(c.id)})">ویرایش</button><button class="base-info-action danger" type="button" onclick="baseInfoDeleteCustomer(${Number(c.id)})">حذف</button></td></tr>`).join(''):'<tr><td colspan="5" class="customer-empty">مشتری‌ای پیدا نشد.</td></tr>';
};
window.baseInfoOpenNewCustomer=function(){
 if(typeof window.customerOpenNew==='function'){window.customerOpenNew();const m=document.getElementById('customerEditor');if(m)m.dataset.returnToBaseInfo='1';}
};
window.baseInfoEditCustomer=function(id){
 const c=rows.find(x=>Number(x.id)===Number(id)); if(!c)return;
 if(typeof window.customerOpenProfile==='function'){window.customerOpenProfile(id); setTimeout(()=>{if(typeof window.customerOpenEdit==='function')window.customerOpenEdit();},0);}
};
window.baseInfoDeleteCustomer=async function(id){
 const c=rows.find(x=>Number(x.id)===Number(id)); if(!c)return;
 if(!confirm('مشتری «'+(c.name||'')+'» حذف شود؟'))return;
 const r=await window.pasargad.deleteCustomer({id,fiscalYear:fy()});
 if(!r?.success){alert(r?.error||'حذف انجام نشد.');return;}
 await window.baseInfoLoadCustomers();
 window.dispatchEvent(new CustomEvent('pasargadCustomerSaved'));
};
window.baseInfoRefreshForFiscalYear=function(){window.baseInfoLoadCustomers();};
window.baseInfoInit=function(){window.baseInfoLoadCustomers();};
window.addEventListener('pasargadCustomerSaved',()=>{if(document.getElementById('baseInfoToolPage')&&!document.getElementById('baseInfoToolPage').hidden)window.baseInfoLoadCustomers();});
})();
