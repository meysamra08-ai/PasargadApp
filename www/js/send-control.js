(function(){
'use strict';

const DIGITS='۰۱۲۳۴۵۶۷۸۹';
const enDigits=v=>String(v??'').replace(/[۰-۹]/g,d=>String(DIGITS.indexOf(d)));
const faDigits=v=>String(v??'').replace(/[0-9]/g,d=>DIGITS[Number(d)]);
const fiscalYear=()=>enDigits(localStorage.getItem('pasargadFiscalYear')||'1405').replace(/[^0-9]/g,'')||'1405';
const typeStorageKey=()=> 'pasargadSendControlTypes_'+fiscalYear();
const legacyStorageKey=()=> 'pasargadSendControlRows_'+fiscalYear();

function todayJalali(){
  try{
    const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    return faDigits(`${p.find(x=>x.type==='year')?.value||''}/${p.find(x=>x.type==='month')?.value||''}/${p.find(x=>x.type==='day')?.value||''}`);
  }catch(_){return '';}
}
function sendDateTimeJalali(){
  try{
    const parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
    const get=t=>parts.find(x=>x.type===t)?.value||'';
    return faDigits(`${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`);
  }catch(_){return todayJalali();}
}
function sendDateTimeDisplay(value){
  const raw=String(value??'').trim();
  if(!raw || raw==='—') return esc(raw||'—');
  const m=raw.match(/^(\S+)\s+(\S+)$/);
  if(!m) return esc(raw);
  return `<span class="send-date-time"><span class="send-date-time-date">${esc(m[1])}</span><span class="send-date-time-clock">${esc(m[2])}</span></span>`;
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

let customers=[];
let currentRows=[];

async function getCustomers(){
  try{
    if(window.pasargad?.getCustomers){
      const r=await window.pasargad.getCustomers({fiscalYear:fiscalYear()});
      if(r?.success&&Array.isArray(r.customers)) return r.customers;
    }
  }catch(e){console.error('sendControl customers:',e);}
  return [];
}

async function getRows(customerId){
  try{
    if(!window.pasargad?.getSendControlRecords) return [];
    const r=await window.pasargad.getSendControlRecords({fiscalYear:fiscalYear(),customerId:customerId||undefined});
    return r?.success&&Array.isArray(r.records)?r.records:[];
  }catch(e){console.error('sendControl records:',e);return [];}
}

async function migrateLegacyRows(){
  try{
    if(!window.pasargad?.addSendControlRecord||!window.pasargad?.getSendControlRecords)return;
    const existing=await getRows();
    if(existing.length)return;
    const raw=JSON.parse(localStorage.getItem(legacyStorageKey())||'[]');
    if(!Array.isArray(raw)||!raw.length)return;
    for(const r of raw){
      const customerId=Number(r?.customerId);
      if(!customerId||!String(r?.customerName||'').trim())continue;
      await window.pasargad.addSendControlRecord({
        customerId,
        customerName:String(r.customerName||'').trim(),
        invoiceDate:String(r.invoiceDate||'').trim(),
        invoiceNo:String(r.invoiceNo||'').trim(),
        documentType:String(r.documentType||'').trim(),
        sendDate:String(r.sendDate||'').trim(),
        status:r.status==='sent'?'sent':'not-sent',
        fiscalYear:fiscalYear()
      });
    }
  }catch(e){console.warn('sendControl legacy migration skipped:',e);}
}

function loadTypes(){try{const x=JSON.parse(localStorage.getItem(typeStorageKey())||'[]');return Array.isArray(x)?x:[];}catch(_){return [];}}
function saveTypes(types){localStorage.setItem(typeStorageKey(),JSON.stringify(types));}
function renderTypes(){
 const types=loadTypes();
 const box=document.getElementById('sendDocumentTypeList');
 if(box) box.innerHTML=types.map(t=>`<option value="${esc(t)}"></option>`).join('');
 const list=document.getElementById('sendTypeList');
 if(list) list.innerHTML=types.length?types.map((t,i)=>`<div class="send-type-manager-row" data-type-index="${i}"><span>${esc(t)}</span><div><button type="button" class="send-type-edit">ویرایش</button><button type="button" class="send-type-delete">حذف</button></div></div>`).join(''):'<div class="send-type-empty">هنوز نوعی ثبت نشده است.</div>';
}
function createDocumentType(){
 const modal=document.getElementById('sendTypeEditor');
 const input=document.getElementById('sendTypeName');
 if(!modal||!input)return false;
 input.value='';renderTypes();modal.hidden=false;setTimeout(()=>input.focus(),30);return false;
}
function closeTypeEditor(){const modal=document.getElementById('sendTypeEditor');if(modal)modal.hidden=true;}
function saveDocumentType(){
 const input=document.getElementById('sendTypeName');
 const name=(input?.value||'').trim();
 if(!name){alert('لطفاً نام نوع فاکتور / سند را وارد کنید.');input?.focus();return false;}
 const types=loadTypes();
 if(types.some(t=>String(t).trim()===name)){alert('این نوع فاکتور / سند از قبل وجود دارد.');return false;}
 types.push(name);saveTypes(types);renderTypes();
 const typeInput=document.getElementById('sendDocumentType');if(typeInput)typeInput.value=name;
 closeTypeEditor();showEntryMessage('نوع فاکتور / سند با موفقیت ایجاد شد.',true);return false;
}
function editDocumentType(index){
 const types=loadTypes();if(index<0||index>=types.length)return;
 const old=types[index];const next=prompt('نام جدید نوع فاکتور / سند:',old);if(next===null)return;
 const name=next.trim();if(!name){alert('نام نمی‌تواند خالی باشد.');return;}
 if(types.some((t,i)=>i!==index&&String(t).trim()===name)){alert('این نوع فاکتور / سند از قبل وجود دارد.');return;}
 types[index]=name;saveTypes(types);renderTypes();
 const input=document.getElementById('sendDocumentType');if(input&&input.value===old)input.value=name;
}
function deleteDocumentType(index){
 const types=loadTypes();if(index<0||index>=types.length)return;
 const name=types[index];if(!confirm(`نوع «${name}» حذف شود؟`))return;
 types.splice(index,1);saveTypes(types);renderTypes();
 const input=document.getElementById('sendDocumentType');if(input&&input.value===name)input.value='';
}

function renderCustomerOptions(q=''){
 const box=document.getElementById('sendCustomerDropdown');if(!box)return;
 const query=String(q||'').trim().toLowerCase();
 const list=customers.filter(c=>String(c.name||'').toLowerCase().includes(query));
 box.innerHTML=list.length?list.map(c=>`<div class="send-customer-option" data-id="${esc(c.id)}" data-name="${esc(c.name)}">${esc(c.name)}</div>`).join(''):'<div class="send-customer-empty">مشتری‌ای پیدا نشد.</div>';
}
function openCustomerPicker(){const picker=document.getElementById('sendCustomerPicker');if(picker)picker.classList.add('open');renderCustomerOptions(document.getElementById('sendCustomerSearch')?.value||'');return false;}
function clearEntry(){['sendCustomerSearch','sendInvoiceNo','sendDocumentType'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const d=document.getElementById('sendInvoiceDate');if(d)d.value='';const i=document.getElementById('sendCustomerSearch');if(i)i.dataset.customerId='';}
function showEntryMessage(text,ok=true){
 const form=document.getElementById('sendControlEntryForm');
 let box=document.getElementById('sendControlEntryMessage');
 if(!box&&form){box=document.createElement('div');box.id='sendControlEntryMessage';box.className='send-control-entry-message';form.appendChild(box);}
 if(box){box.textContent=text;box.classList.toggle('ok',!!ok);box.classList.toggle('error',!ok);clearTimeout(box._timer);box._timer=setTimeout(()=>{box.textContent='';},3000);}
}

function renderDashboard(rows){
 const total=rows.length,sent=rows.filter(r=>r.status==='sent').length,pending=total-sent;
 const count=new Set(rows.map(r=>String(r.customerId||'')).filter(Boolean)).size;
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=faDigits(v);};
 set('sendMiniTotal',total);set('sendMiniSent',sent);set('sendMiniPending',pending);set('sendMiniCustomers',count);
}
function rowTemplate(index,row){
 const sent=row.status==='sent';
 return `<tr class="send-control-customer-row" data-row-index="${index}" data-customer-id="${esc(row.customerId)}" data-customer-name="${esc(row.customerName||"")}" title="برای مشاهده کارت حساب مشتری دوبار کلیک کنید"><td>${faDigits(index+1)}</td><td>${esc(row.customerName||"—")}</td><td>${esc(row.invoiceDate||"—")}</td><td>${esc(row.invoiceNo||"—")}</td><td>${esc(row.documentType||"—")}</td><td>${sendDateTimeDisplay(row.sendDate||"—")}</td><td><span class="send-status ${sent?"sent":"not-sent"}">${sent?"ارسال شده":"ارسال نشده"}</span></td><td><div class="send-status-actions"><button class="send-status-btn" type="button" ${sent?"disabled":""}>خروج</button><button class="send-status-undo-btn" type="button" ${sent?"":"disabled"} title="بازگشت وضعیت به ارسال نشده" aria-label="بازگشت وضعیت">↶</button></div></td></tr>`;
}
function renderReport(rows){
 currentRows=Array.isArray(rows)?rows:[];
 const tbody=document.getElementById('sendControlRows');if(!tbody)return;
 const filter=document.getElementById('sendStatusFilter')?.value||'all';
 const q=(document.getElementById('sendReportSearch')?.value||'').trim().toLowerCase();
 const visible=currentRows.map((r,i)=>({r,i})).filter(({r})=>{
   if(filter!=='all'&&r.status!==filter)return false;
   if(!q)return true;
   return [r.customerName,r.invoiceNo,r.documentType].some(v=>String(v||'').toLowerCase().includes(q));
 });
 if(!visible.length){tbody.innerHTML='<tr><td colspan="8" class="send-control-empty">موردی با این فیلتر پیدا نشد.</td></tr>';return;}
 tbody.innerHTML=visible.map(({r,i})=>rowTemplate(i,r)).join('');

 // دابل‌کلیک مستقیماً روی خود ردیف ثبت می‌شود.
 // بنابراین به event.target یا ساختار داخلی سلول‌ها وابسته نیست.
 tbody.querySelectorAll('tr.send-control-customer-row').forEach(tr => {
   // کارت حساب فقط با دابل‌کلیک روی ردیف مشتری باز می‌شود؛ کلیک معمولی هیچ اقدامی ندارد.
   tr.addEventListener('dblclick', async function(event) {
     if (event.target.closest('.send-status-btn')) return;

     const customerId = String(
       this.getAttribute('data-customer-id') || ''
     ).trim();

     const customerName = String(
       this.getAttribute('data-customer-name') || ''
     ).trim();

     if (!customerId) {
       console.warn('کد مشتری برای کارت حساب پیدا نشد.');
       return;
     }

     try {
       await openAccountModal(customerId, customerName);
     } catch (error) {
       console.error('open customer account:', error);
       alert('کارت حساب مشتری باز نشد.');
     }
   });
 });
}

function renderCustomerEditOptions(){
 const select=document.getElementById('sendCustomerEditSelect');
 if(!select)return;
 const sorted=[...customers].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fa'));
 select.innerHTML='<option value="">انتخاب مشتری</option>'+sorted.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'—')}</option>`).join('');
}
function customerEditSelected(){
 const select=document.getElementById('sendCustomerEditSelect');
 const input=document.getElementById('sendCustomerEditName');
 const id=String(select?.value||'').trim();
 const c=customers.find(x=>String(x.id)===id);
 if(input)input.value=c?.name||'';
}
async function saveSendCustomerEdit(){
 const select=document.getElementById('sendCustomerEditSelect');
 const input=document.getElementById('sendCustomerEditName');
 const id=String(select?.value||'').trim();
 const name=String(input?.value||'').trim();
 if(!id){alert('ابتدا مشتری را انتخاب کنید.');return;}
 if(!name){alert('نام مشتری را وارد کنید.');return;}
 const c=customers.find(x=>String(x.id)===id);
 if(!c)return;
 const result=await window.pasargad.updateCustomer({id:Number(id),fiscalYear:fiscalYear(),name,mobile:c.mobile||'',phone:c.phone||'',address:c.address||'',notes:c.notes||''});
 if(!result?.success){alert(result?.error||'ویرایش مشتری انجام نشد.');return;}
 if(window.pasargad.updateSendControlCustomerName){await window.pasargad.updateSendControlCustomerName({customerId:Number(id),customerName:name,fiscalYear:fiscalYear()});}
 await refreshSendControlCustomers();
 alert('نام مشتری با موفقیت ویرایش شد.');
}
async function deleteSendCustomer(){
 const select=document.getElementById('sendCustomerEditSelect');
 const id=String(select?.value||'').trim();
 if(!id){alert('ابتدا مشتری را انتخاب کنید.');return;}
 const c=customers.find(x=>String(x.id)===id);
 if(!c)return;
 if(!confirm(`مشتری «${c.name||''}» و اطلاعات مرتبط با او حذف شود؟`))return;
 const result=await window.pasargad.deleteCustomer({id:Number(id),fiscalYear:fiscalYear()});
 if(!result?.success){alert(result?.error||'حذف مشتری انجام نشد.');return;}
 await refreshSendControlCustomers();
 document.getElementById('sendCustomerEditName').value='';
 alert('مشتری با موفقیت حذف شد.');
}
async function refreshSendControlCustomers(){
 customers=await getCustomers();
 renderCustomerEditOptions();
 renderCustomerOptions(document.getElementById('sendCustomerSearch')?.value||'');
 const rows=await getRows();
 renderDashboard(rows);renderReport(rows);
}

async function addRecord(){
 const nameEl=document.getElementById('sendCustomerSearch');
 const customerId=(nameEl?.dataset.customerId||'').trim();
 const name=(nameEl?.value||'').trim();
 const invoiceDate=(document.getElementById('sendInvoiceDate')?.value||'').trim()||todayJalali();
 const invoiceNo=(document.getElementById('sendInvoiceNo')?.value||'').trim();
 const documentType=(document.getElementById('sendDocumentType')?.value||'').trim();
 if(!name||!customerId){showEntryMessage('لطفاً مشتری را از فهرست جستجو و انتخاب کنید.',false);return;}
 if(!invoiceNo){showEntryMessage('لطفاً شماره فاکتور را وارد کنید.',false);return;}
 if(!documentType){showEntryMessage('لطفاً نوع فاکتور / سند را انتخاب کنید.',false);return;}
 if(!window.pasargad?.addSendControlRecord){showEntryMessage('ارتباط با دیتابیس کنترل ارسال برقرار نیست.',false);return;}
 const result=await window.pasargad.addSendControlRecord({customerId:Number(customerId),customerName:name,invoiceDate,invoiceNo,documentType,sendDate:'',status:'not-sent',fiscalYear:fiscalYear()});
 if(!result?.success){showEntryMessage(result?.error||'ثبت اطلاعات انجام نشد.',false);return;}
 const rows=await getRows();renderDashboard(rows);renderReport(rows);clearEntry();showEntryMessage('اطلاعات با موفقیت در دیتابیس ثبت شد.',true);
}

async function markSent(index){
 const row=currentRows[index];
 if(!row||row.status==='sent'||!row.id)return;
 if(!window.pasargad?.updateSendControlStatus){alert('ارتباط با دیتابیس کنترل ارسال برقرار نیست.');return;}
 const result=await window.pasargad.updateSendControlStatus({id:Number(row.id),fiscalYear:fiscalYear(),status:'sent',sendDate:sendDateTimeJalali()});
 if(!result?.success){alert(result?.error||'تغییر وضعیت انجام نشد.');return;}
 const rows=await getRows();renderDashboard(rows);renderReport(rows);
}

async function markNotSent(index){
 const row=currentRows[index];
 if(!row||row.status!=='sent'||!row.id)return;
 if(!window.pasargad?.updateSendControlStatus){alert('ارتباط با دیتابیس کنترل ارسال برقرار نیست.');return;}
 const result=await window.pasargad.updateSendControlStatus({id:Number(row.id),fiscalYear:fiscalYear(),status:'not-sent',sendDate:''});
 if(!result?.success){alert(result?.error||'بازگشت وضعیت انجام نشد.');return;}
 const rows=await getRows();renderDashboard(rows);renderReport(rows);
}

async function openAccountModal(customerId, customerName){
 const id=String(customerId||'').trim();
 const modal=document.getElementById('sendAccountModal');
 if(!modal||!id)return;

 // مشتری فقط با شناسه واقعی خودش از دیتابیس پیدا می‌شود.
 const customer=customers.find(c=>String(c.id)===id);
 if(!customer)return;

 // فقط رکوردهای همین customerId از دیتابیس دریافت می‌شوند؛
 // هیچ‌وقت کل گزارش به کارت حساب داده نمی‌شود.
 const result=await window.pasargad.getSendControlRecords({
   fiscalYear:fiscalYear(),
   customerId:Number(id)
 });

 if(!result?.success)return;

 const normalize=v=>String(v??'')
   .trim()
   .replace(/ي/g,'ی')
   .replace(/ك/g,'ک')
   .replace(/‌/g,' ')
   .replace(/\s+/g,' ');

 const selectedName=normalize(customer.name||customerName);

 // یک کنترل دوم نیز بر اساس نام همان مشتری انجام می‌شود تا
 // حتی در صورت وجود داده قدیمی/اشتباه، اطلاعات مشتری دیگری نمایش داده نشود.
 const finalRows=(result.records||[]).filter(r=>{
   const rowId=String(r.customerId??'').trim();
   const rowName=normalize(r.customerName);
   return rowId===id && rowName===selectedName;
 });

 const nameEl=document.getElementById('sendAccountCustomerName');
 if(nameEl)nameEl.textContent=customer.name||'—';

 const info=document.getElementById('sendAccountCustomerInfo');
 if(info){
   const d=[];
   if(customer.mobile)d.push('موبایل: '+customer.mobile);
   if(customer.phone)d.push('تلفن: '+customer.phone);
   if(customer.address)d.push('آدرس: '+customer.address);
   info.textContent=d.join(' | ')||'اطلاعات تکمیلی مشتری ثبت نشده است.';
 }

 const total=document.getElementById('sendAccountTotal');
 const sent=document.getElementById('sendAccountSent');
 const pending=document.getElementById('sendAccountPending');

 if(total)total.textContent=faDigits(finalRows.length);
 if(sent)sent.textContent=faDigits(finalRows.filter(r=>r.status==='sent').length);
 if(pending)pending.textContent=faDigits(finalRows.filter(r=>r.status!=='sent').length);

 const body=document.getElementById('sendAccountRows');
 if(body){
   body.innerHTML=finalRows.length
     ? finalRows.map((r,i)=>`<tr><td>${faDigits(i+1)}</td><td>${esc(r.invoiceDate||'—')}</td><td>${esc(r.invoiceNo||'—')}</td><td>${esc(r.documentType||'—')}</td><td>${sendDateTimeDisplay(r.sendDate||'—')}</td><td><span class="send-status ${r.status==='sent'?'sent':'not-sent'}">${r.status==='sent'?'ارسال شده':'ارسال نشده'}</span></td></tr>`).join('')
     : '<tr><td colspan="6" class="send-control-empty">برای این مشتری اطلاعاتی ثبت نشده است.</td></tr>';
 }

 modal.hidden=false;
 modal.setAttribute('aria-hidden','false');
}
function closeAccountModal(){const modal=document.getElementById('sendAccountModal');if(modal){modal.hidden=true;modal.setAttribute('aria-hidden','true');}}

function bind(){
 const once=(el,event,fn)=>{if(el&&!el.dataset.bound){el.dataset.bound='1';el.addEventListener(event,fn);}};
 once(document.getElementById('sendCreateTypeBtn'),'click',createDocumentType);
 once(document.querySelector('#sendControl .send-control-print'),'click',()=>window.sendControlPrint());
 once(document.querySelector('#sendControl .send-control-create-customer'),'click',()=>{
   if(typeof window.customerOpenNew==='function'){
     window.customerOpenNew();
     const modal=document.getElementById('customerEditor');
     if(modal) modal.dataset.returnToSendControl='1';
   }else{
     alert('ماژول مدیریت مشتریان در دسترس نیست.');
   }
 });
 once(document.getElementById('sendStatusFilter'),'change',()=>renderReport(currentRows));
 once(document.getElementById('sendReportSearch'),'input',()=>renderReport(currentRows));
 once(document.getElementById('sendCustomerSearch'),'focus',openCustomerPicker);
 once(document.getElementById('sendCustomerSearch'),'click',openCustomerPicker);
 once(document.getElementById('sendCustomerSearch'),'input',e=>{e.target.dataset.customerId='';openCustomerPicker();renderCustomerOptions(e.target.value);});
 once(document.getElementById('sendCustomerDropdown'),'click',e=>{const o=e.target.closest('.send-customer-option');if(!o)return;const i=document.getElementById('sendCustomerSearch');i.value=o.dataset.name||'';i.dataset.customerId=o.dataset.id||'';const d=document.getElementById('sendInvoiceDate');if(d)d.value=todayJalali();document.getElementById('sendCustomerPicker')?.classList.remove('open');});
 once(document.getElementById('sendAccountClose'),'click',closeAccountModal);
 once(document.getElementById('sendAccountModal'),'click',e=>{if(e.target.id==='sendAccountModal')closeAccountModal();});
 once(document.getElementById('sendTypeName'),'keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDocumentType();}});
}

window.sendControlCreateType=createDocumentType;
window.sendControlCloseTypeEditor=closeTypeEditor;
window.sendControlSaveType=saveDocumentType;
window.sendControlOpenCustomerSearch=openCustomerPicker;
window.sendControlPrint=async function(){
  window.sendControlPrintMode = true;
  try {
    if(typeof window.printChequeReport==='function') await window.printChequeReport();
  } catch (error) {
    console.error('sendControl print:', error);
    alert('چاپ گزارش وضعیت ارسال انجام نشد.');
  }
};
window.sendControlOpenCustomer=function(){if(typeof window.customerOpenNew==='function'){window.customerOpenNew();const modal=document.getElementById('customerEditor');if(modal)modal.dataset.returnToSendControl='1';}else alert('ماژول مدیریت مشتریان در دسترس نیست.');};
window.sendControlInit=async function(){
 const box=document.getElementById('sendControl');if(!box)return;
 customers=await getCustomers();
 await migrateLegacyRows();
 const rows=await getRows();
 renderTypes();renderDashboard(rows);renderCustomerOptions('');renderCustomerEditOptions();renderReport(rows);bind();
};

window.addEventListener('click',e=>{
 if(e.target.closest('#sendCustomerEditToggle')){const p=document.getElementById('sendCustomerEditPanel');if(p)p.hidden=!p.hidden;}
 if(e.target.closest('#sendCustomerEditSelect'))customerEditSelected();
 if(e.target.closest('#sendCustomerEditSave'))saveSendCustomerEdit();
 if(e.target.closest('#sendCustomerEditDelete'))deleteSendCustomer();
 if(e.target.closest('#sendAddRecord'))addRecord();
 if(e.target.closest('.send-status-btn')){const tr=e.target.closest('tr');const i=Number(tr?.dataset.rowIndex);if(!Number.isNaN(i))markSent(i);}
 if(e.target.closest('.send-status-undo-btn')){const tr=e.target.closest('tr');const i=Number(tr?.dataset.rowIndex);if(!Number.isNaN(i))markNotSent(i);}
 if(e.target.closest('.send-type-edit'))editDocumentType(Number(e.target.closest('.send-type-manager-row')?.dataset.typeIndex));
 if(e.target.closest('.send-type-delete'))deleteDocumentType(Number(e.target.closest('.send-type-manager-row')?.dataset.typeIndex));
});


document.addEventListener('click',e=>{
 if(!e.target.closest('#sendCustomerPicker'))document.getElementById('sendCustomerPicker')?.classList.remove('open');
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAccountModal();});
window.addEventListener('pasargadCustomerSaved',()=>{if(!document.getElementById('sendControl')?.hidden)window.sendControlInit();});

})();
