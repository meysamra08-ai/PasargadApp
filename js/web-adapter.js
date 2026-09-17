(function(){
  if(window.pasargad) return;
  const KEY='pasargad_web_store_v1';
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}};
  const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const state=load();
  state.years=state.years||['1405']; state.customers=state.customers||[]; state.sends=state.sends||[]; state.cheques=state.cheques||[]; state.follows=state.follows||[];
  const norm=v=>String(v??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,'').trim().toLowerCase();
  const digits=v=>String(v??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
  const next=a=>a.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;
  const ok=(x)=>({success:true,...x});
  const fail=error=>({success:false,error});
  const methods={
    getFiscalYears:async()=>ok({years:state.years}),
    createFiscalYear:async({year})=>{if(!state.years.includes(String(year)))state.years.push(String(year));save(state);return ok({years:state.years});},
    deleteFiscalYear:async({year})=>{state.years=state.years.filter(x=>x!==String(year));save(state);return ok({years:state.years});},
    clearFiscalYear:async({year})=>{const y=String(year);state.customers=state.customers.filter(x=>String(x.fiscalYear)!==y);state.sends=state.sends.filter(x=>String(x.fiscalYear)!==y);state.follows=state.follows.filter(x=>String(x.fiscalYear)!==y);save(state);return ok();},
    getCustomers:async({fiscalYear}={})=>ok({customers:state.customers.filter(x=>!fiscalYear||String(x.fiscalYear)===String(fiscalYear))}),
    addCustomer:async(d)=>{const y=String(d.fiscalYear||'1405');if(state.customers.some(x=>String(x.fiscalYear)===y&&(norm(x.name)===norm(d.name)||(digits(x.mobile)&&digits(x.mobile)===digits(d.mobile))||(digits(x.phone)&&digits(x.phone)===digits(d.phone)))))return fail('مشتری با همین مشخصات قبلاً ثبت شده است.');const x={...d,id:next(state.customers),fiscalYear:y};state.customers.push(x);save(state);return ok({customer:x});},
    updateCustomer:async(d)=>{const i=state.customers.findIndex(x=>Number(x.id)===Number(d.id));if(i<0)return fail('مشتری پیدا نشد.');state.customers[i]={...state.customers[i],...d};save(state);return ok({customer:state.customers[i]});},
    deleteCustomer:async({id})=>{state.customers=state.customers.filter(x=>Number(x.id)!==Number(id));save(state);return ok();},
    getCustomerProfile:async({id})=>{const c=state.customers.find(x=>Number(x.id)===Number(id));return c?ok({customer:c,contacts:[],followUps:state.follows.filter(x=>Number(x.customer_id)===Number(id))}):fail('مشتری پیدا نشد.');},
    getCustomerFollowUps:async({fiscalYear}={})=>ok({followUps:state.follows.filter(x=>!fiscalYear||String(x.fiscalYear)===String(fiscalYear))}),
    addCustomerContact:async(d)=>{if(d.followUpText){state.follows.push({id:next(state.follows),customer_id:d.customerId,customer_name:(state.customers.find(x=>x.id==d.customerId)||{}).name||'',follow_up_date:d.followUpDate,follow_up_text:d.followUpText,done:false,fiscalYear:d.fiscalYear});save(state);}return ok();},
    updateCustomerFollowUp:async({contactId,done})=>{const x=state.follows.find(x=>Number(x.id)===Number(contactId));if(x)x.done=!!done;save(state);return ok();},
    getSendControlRecords:async({fiscalYear,customerId}={})=>ok({records:state.sends.filter(x=>(!fiscalYear||String(x.fiscalYear)===String(fiscalYear))&&(!customerId||Number(x.customerId)===Number(customerId)))}),
    addSendControlRecord:async(d)=>{const x={...d,id:next(state.sends)};state.sends.push(x);save(state);return ok({record:x});},
    updateSendControlStatus:async(d)=>{const x=state.sends.find(x=>Number(x.id)===Number(d.id));if(x)Object.assign(x,d);save(state);return ok();},
    updateSendControlCustomerName:async(d)=>{state.sends.filter(x=>Number(x.customerId)===Number(d.customerId)).forEach(x=>x.customerName=d.customerName);save(state);return ok();},
    getCheques:async()=>state.cheques,
    addCheque:async(d)=>{const x={...d,id:next(state.cheques)};state.cheques.push(x);save(state);return ok({cheque:x});},
    updateCheque:async(d)=>{const i=state.cheques.findIndex(x=>Number(x.id)===Number(d.id));if(i>=0)state.cheques[i]={...state.cheques[i],...d};save(state);return ok();},
    deleteCheque:async({id})=>{state.cheques=state.cheques.filter(x=>Number(x.id)!==Number(id));save(state);return ok();},
    confirmChequeStatus:async(d)=>methods.updateCheque(d),
    getPrintSettings:async()=>ok({settings:{}}),savePrintSettings:async()=>ok(),getPrinters:async()=>[],
    previewReport:async()=>ok(),printReport:async()=>ok(),printCurrentPage:async()=>{window.print();return ok();},previewCurrentPage:async()=>{window.print();return ok();},
    getAppearanceSettings:async()=>ok({settings:{}}),saveAppearanceSettings:async()=>ok(),getSplashImage:async()=>ok({path:''}),
    createBackup:async()=>fail('پشتیبان‌گیری فایل در نسخه وب غیرفعال است.'),getBackupSettings:async()=>ok({}),chooseBackupSecondPath:async()=>fail('در نسخه وب پشتیبانی نمی‌شود.'),restoreBackup:async()=>fail('در نسخه وب پشتیبانی نمی‌شود.'),finishBackupBeforeExit:()=>{},onBackupBeforeExit:()=>{}
  };
  window.pasargad=methods;
  window.__pasargadWeb=true;
  window.addEventListener('beforeunload',()=>save(state));
})();
