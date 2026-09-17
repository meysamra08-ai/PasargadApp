(function(){
'use strict';
let list=[];
let selectedId=null;
let editingId=null;
function customerFiscalYear(){return String(localStorage.getItem('pasargadFiscalYear')||'1405').replace(/[^0-9]/g,'');}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function customerToPersianDigits(v){return String(v??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);}
function customerToEnglishDigits(v){return String(v??'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));}
function customerFormatDate(v){
 const raw=customerToEnglishDigits(v).replace(/\D/g,'').slice(0,8);
 if(!raw)return '';
 let out=raw.slice(0,4);
 if(raw.length>4)out+='/'+raw.slice(4,6);
 if(raw.length>6)out+='/'+raw.slice(6,8);
 return customerToPersianDigits(out);
}
function customerBindDateInputs(){
 ['customerContactDate','customerFollowDate'].forEach(id=>{
  const el=document.getElementById(id); if(!el||el.__customerDateBound)return;
  el.__customerDateBound=true;
  el.addEventListener('input',()=>{const pos=el.selectionStart; const before=el.value; el.value=customerFormatDate(el.value); if(pos!==null){const delta=el.value.length-before.length; try{el.setSelectionRange(Math.max(0,pos+delta),Math.max(0,pos+delta));}catch(_){}}});
  el.addEventListener('blur',()=>{el.value=customerFormatDate(el.value);});
 });
}

function msg(t){const e=document.getElementById('customerMessage');if(e){e.textContent=t||'';if(t)setTimeout(()=>{if(e.textContent===t)e.textContent='';},2500);}}
window.customerLoadList=async function(){
 const body=document.getElementById('customerRows'); if(!body)return;
 try{const r=await window.pasargad.getCustomers({fiscalYear:customerFiscalYear()});if(!r?.success)throw Error(r?.error||'خطا');list=r.customers||[];
 const q=(document.getElementById('customerSearch')?.value||'').trim().toLowerCase();const filtered=list.filter(c=>(`${c.name||''} ${c.mobile||''} ${c.phone||''}`).toLowerCase().includes(q));const a=q?filtered:filtered.slice().sort((x,y)=>Number(y.id)-Number(x.id)).slice(0,2);
 body.innerHTML=a.length?a.map((c,i)=>`<tr><td>${i+1}</td><td>${esc(c.name)}</td><td>${esc(c.mobile)||'—'}</td><td>${esc(c.phone)||'—'}</td><td>${esc(c.last_contact)||'—'}</td><td><button class="customer-action" onclick="customerOpenProfile(${Number(c.id)})">مشاهده</button></td></tr>`).join(''):`<tr><td colspan="6" class="customer-empty">مشتری‌ای پیدا نشد.</td></tr>`;
 }catch(e){console.error(e);body.innerHTML='<tr><td colspan="6" class="customer-empty">خطا در دریافت مشتریان.</td></tr>';}
};
window.customerOpenNew=function(){editingId=null;document.getElementById('customerEditorTitle').textContent='ثبت مشتری جدید';['customerName','customerMobile','customerPhone','customerAddress','customerNotes'].forEach(id=>{const el=document.getElementById(id);el.value='';el.disabled=false;el.readOnly=false;});document.getElementById('customerEditor').hidden=false;document.getElementById('customerName').focus();};
window.customerOpenEdit=function(){const c=list.find(x=>Number(x.id)===Number(selectedId));if(!c)return;editingId=c.id;document.getElementById('customerEditorTitle').textContent='ویرایش مشتری';[['customerName',c.name],['customerMobile',c.mobile],['customerPhone',c.phone],['customerAddress',c.address],['customerNotes',c.notes]].forEach(([id,value])=>{const el=document.getElementById(id);el.value=value||'';el.disabled=false;el.readOnly=false;});document.getElementById('customerEditor').hidden=false;document.getElementById('customerName').focus();};
window.customerCloseEditor=function(){document.getElementById('customerEditor').hidden=true;};
window.customerSave=async function(){const ids=['customerName','customerMobile','customerPhone','customerAddress','customerNotes'];const unlock=()=>ids.forEach(id=>{const el=document.getElementById(id);if(el){el.disabled=false;el.readOnly=false;}});const data={name:document.getElementById('customerName').value.trim(),mobile:document.getElementById('customerMobile').value.trim(),phone:document.getElementById('customerPhone').value.trim(),address:document.getElementById('customerAddress').value.trim(),notes:document.getElementById('customerNotes').value.trim()};if(!data.name){unlock();alert('نام مشتری را وارد کنید.');document.getElementById('customerName')?.focus();return;}try{const r=editingId?await window.pasargad.updateCustomer({id:editingId,fiscalYear:customerFiscalYear(),...data}):await window.pasargad.addCustomer({...data,fiscalYear:customerFiscalYear()});if(!r?.success){unlock();alert(r?.error||'ذخیره مشتری انجام نشد.');document.getElementById('customerName')?.focus();return;}customerCloseEditor();msg(editingId?'اطلاعات مشتری ویرایش شد.':'مشتری با موفقیت ثبت شد.');window.dispatchEvent(new CustomEvent('pasargadCustomerSaved'));if(editingId)await customerOpenProfile(selectedId);else await customerLoadList();}catch(error){console.error('customer save:',error);unlock();alert('ذخیره مشتری انجام نشد.');document.getElementById('customerName')?.focus();}};
window.customerOpenProfile=async function(id){selectedId=id;document.getElementById('customerListPanel').hidden=true;document.getElementById('customerProfilePanel').hidden=false;document.querySelector('.customer-head').hidden=true;await customerLoadProfile();};
async function customerLoadProfile(){const r=await window.pasargad.getCustomerProfile({id:selectedId,fiscalYear:customerFiscalYear()});if(!r?.success){alert(r?.error||'پرونده مشتری دریافت نشد.');return;}const c=r.customer;document.getElementById('customerProfileName').textContent=c.name||'—';document.getElementById('customerProfileMobile').textContent=c.mobile||'—';document.getElementById('customerProfilePhone').textContent=c.phone||'—';document.getElementById('customerProfileAddress').textContent=c.address||'—';document.getElementById('customerProfileNotes').textContent=c.notes||'—';const cr=document.getElementById('customerContactRows');cr.innerHTML=r.contacts.length?r.contacts.map(x=>`<tr><td>${customerFormatDate(x.contact_date)||'—'}</td><td>${esc(x.contact_type)||'—'}</td><td>${esc(x.subject)||'—'}</td><td>${esc(x.notes)||'—'}</td><td>${customerFormatDate(x.follow_up_date)||'—'}</td></tr>`).join(''):'<tr><td colspan="5" class="customer-empty">هنوز تماسی ثبت نشده است.</td></tr>';const fr=document.getElementById('customerFollowRows');fr.innerHTML=r.followUps.length?r.followUps.map(x=>`<tr><td>${customerFormatDate(x.follow_up_date)||'—'}</td><td>${esc(x.follow_up_text)||'—'}</td><td><span class="customer-follow-status ${x.done?'done':'pending'}">${x.done?'انجام شده':'در انتظار پیگیری'}</span>${x.done?'':` <button type="button" class="customer-follow-done" onclick="customerCompleteFollowUp(${Number(x.id)})">انجام شد</button>`}</td></tr>`).join(''):'<tr><td colspan="3" class="customer-empty">پیگیری‌ای ثبت نشده است.</td></tr>';}
window.customerBackToList=function(){selectedId=null;document.getElementById('customerProfilePanel').hidden=true;document.getElementById('customerListPanel').hidden=false;document.querySelector('.customer-head').hidden=false;customerLoadList();};
window.customerDelete=async function(){if(!selectedId)return;if(!confirm('این مشتری و تاریخچه تماس‌های او حذف شود؟'))return;const r=await window.pasargad.deleteCustomer({id:selectedId,fiscalYear:customerFiscalYear()});if(!r?.success){alert(r?.error||'حذف انجام نشد.');return;}msg('مشتری حذف شد.');customerBackToList();};
window.customerCompleteFollowUp=async function(contactId){
 const r=await window.pasargad.updateCustomerFollowUp({contactId:contactId,done:true,fiscalYear:customerFiscalYear()});
 if(!r?.success){alert(r?.error||'تغییر وضعیت پیگیری انجام نشد.');return;}
 await customerLoadProfile();
 await customerLoadFollowUps();
 msg('پیگیری انجام شد.');
};
window.customerOpenPrint=function(){
 if(typeof window.printChequeReport==='function') window.printChequeReport();
 window.customerPrintMode=true;
};

window.customerOpenContact=function(){['customerContactDate','customerContactSubject','customerContactNotes','customerFollowDate','customerFollowText'].forEach(id=>{const el=document.getElementById(id);el.value='';el.disabled=false;el.readOnly=false;});document.querySelectorAll('input[name="customerContactType"]').forEach(el=>{el.disabled=false;el.readOnly=false;});const out=document.querySelector('input[name="customerContactType"][value="خروجی"]');if(out)out.checked=true;customerBindDateInputs();document.getElementById('customerContactModal').hidden=false;document.getElementById('customerContactDate').focus();};
window.customerCloseContact=function(){document.getElementById('customerContactModal').hidden=true;};
window.customerSaveContact=async function(){const r=await window.pasargad.addCustomerContact({customerId:selectedId,fiscalYear:customerFiscalYear(),contactDate:document.getElementById('customerContactDate').value.trim(),contactType:document.querySelector('input[name="customerContactType"]:checked').value,subject:document.getElementById('customerContactSubject').value.trim(),notes:document.getElementById('customerContactNotes').value.trim(),followUpDate:document.getElementById('customerFollowDate').value.trim(),followUpText:document.getElementById('customerFollowText').value.trim()});if(!r?.success){alert(r?.error||'ثبت تماس انجام نشد.');return;}customerCloseContact();await customerLoadProfile();await customerLoadFollowUps();msg('تماس با موفقیت ثبت شد.');};
window.customerLoadFollowUps=async function(){const box=document.getElementById('customerFollowReportRows');if(!box)return;try{const r=await window.pasargad.getCustomerFollowUps({fiscalYear:customerFiscalYear()});if(!r?.success)throw Error(r?.error||'خطا');const rows=r.followUps||[];box.innerHTML=rows.length?rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.customer_name)||'—'}</td><td>${customerFormatDate(x.follow_up_date)||'—'}</td><td>${esc(x.follow_up_text)||'—'}</td><td><button type="button" class="customer-action" onclick="customerOpenProfile(${Number(x.customer_id)})">مشاهده</button></td></tr>`).join(''):'<tr><td colspan="5" class="customer-empty">موردی برای پیگیری ثبت نشده است.</td></tr>';}catch(e){console.error(e);box.innerHTML='<tr><td colspan="5" class="customer-empty">خطا در دریافت گزارش پیگیری.</td></tr>';}};
window.customerRefreshForFiscalYear=function(){customerLoadList();customerLoadFollowUps();if(selectedId)customerLoadProfile();};
window.customerInit=function(){customerLoadList();customerLoadFollowUps();};
})();
