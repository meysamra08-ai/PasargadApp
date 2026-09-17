(function(){
  function p(v){ return typeof toPersianDigits==='function' ? toPersianDigits(v) : String(v ?? ''); }
  function e(v){ return typeof toEnglishDigits==='function' ? toEnglishDigits(v) : String(v ?? ''); }
  function set(id,v){ var el=document.getElementById(id); if(el) el.textContent=p(v); }
  function esc(v){ var d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML; }
  function year(){ return String(window.activeFiscalYear || localStorage.getItem('pasargadFiscalYear') || '1405').replace(/[^0-9]/g,''); }
  async function load(){
    var fy=year(); set('managementFiscalYear',fy);
    var customers=[], sends=[], cheques=[], follows=[], dailyRows=[];
    try { var r=await window.pasargad.getCustomers({fiscalYear:fy}); customers=(r&&r.success&&Array.isArray(r.customers))?r.customers:[]; } catch(err){console.error(err);}
    try { var r=await window.pasargad.getSendControlRecords({fiscalYear:fy}); sends=(r&&r.success&&Array.isArray(r.records))?r.records:[]; } catch(err){console.error(err);}
    try { var r=await window.pasargad.getCheques(); cheques=Array.isArray(r)?r:((r&&Array.isArray(r.cheques))?r.cheques:[]); } catch(err){console.error(err);}
    try { var r=await window.pasargad.getCustomerFollowUps({fiscalYear:fy}); follows=(r&&r.success&&Array.isArray(r.followUps))?r.followUps:[]; } catch(err){console.error(err);}
    try { dailyRows=JSON.parse(localStorage.getItem('pasargadDailyAffairsRows') || '[]'); if(!Array.isArray(dailyRows)) dailyRows=[]; } catch(err){ dailyRows=[]; }
    cheques=cheques.filter(function(c){return e(c.fiscalYear??c.fiscal_year??'')===fy;});
    var sent=sends.filter(x=>x.status==='sent'||x.status==='ارسال شده').length;
    var pending=sends.length-sent;
    var registered=cheques.filter(x=>x.status==='registered').length;
    var unregistered=cheques.filter(x=>x.status==='notRegistered').length;
    var returned=cheques.filter(x=>x.status==='returned').length;
    var sendCustomerIds=[...new Set(sends.map(x=>String(x.customerId||'')).filter(Boolean))];
    set('managementChequeTotal',cheques.length); set('managementChequeMeta','ثبت شده: '+p(registered)+' | عودت: '+p(returned));
    set('managementCustomerTotal',customers.length); set('managementCustomerMeta','پیگیری باز: '+p(follows.length));
    set('managementSendTotal',sends.length); set('managementSendMeta','ارسال نشده: '+p(pending));
    var dailyPending=dailyRows.filter(function(item){ return item.status !== 'انجام شد'; }).length;
    set('managementFollowTotal',dailyPending);
    set('managementChequeAll',cheques.length); set('managementChequeRegistered',registered); set('managementChequeUnregistered',unregistered); set('managementChequeReturned',returned);
    set('managementSendAll',sends.length); set('managementSendSent',sent); set('managementSendPending',pending); set('managementSendCustomers',sendCustomerIds.length);
    var cl=document.getElementById('managementCustomersList');
    if(cl){ cl.innerHTML=customers.slice(0,5).map(function(c){return '<div class="management-list-row"><div><strong>'+esc(c.name||'—')+'</strong><br><small>'+esc(c.mobile||c.phone||'بدون شماره تماس')+'</small></div><span>'+esc(c.last_contact||'—')+'</span></div>';}).join('') || '<div class="management-empty">مشتری ثبت نشده است.</div>'; }
    var sl=document.getElementById('managementSendList');
    if(sl){ sl.innerHTML=sends.slice(0,5).map(function(x){return '<div class="management-list-row"><div><strong>'+esc(x.customerName||'—')+'</strong><br><small>'+esc(x.invoiceNo||'بدون شماره')+' | '+esc(x.documentType||'—')+'</small></div><span>'+esc(x.status==='sent'||x.status==='ارسال شده'?'ارسال شده':'ارسال نشده')+'</span></div>';}).join('') || '<div class="management-empty">رکوردی ثبت نشده است.</div>'; }
  }
  window.managementDashboardInit=load;
})();
