let customerRowsCache = [];

async function loadCustomers(){
    const body=document.getElementById("customerRows");
    if(!body || !window.pasargad || !window.pasargad.getCustomers) return;
    try{
        const result=await window.pasargad.getCustomers();
        if(!result || !result.success) throw new Error(result?.error || "خطا در دریافت مشتریان");
        customerRowsCache=result.customers || [];
        const q=(document.getElementById("customerSearch")?.value || "").trim().toLowerCase();
        const list=customerRowsCache.filter(c => `${c.name||""} ${c.mobile||""} ${c.phone||""}`.toLowerCase().includes(q));
        body.innerHTML=list.length ? list.map((c,i)=>`<tr>
            <td>${i+1}</td><td>${escapeCustomer(c.name)}</td><td>${escapeCustomer(c.mobile)||"—"}</td>
            <td>${escapeCustomer(c.phone)||"—"}</td><td>${escapeCustomer(c.last_contact)||"—"}</td>
            <td><button type="button" class="customer-action" onclick="viewCustomerSoon(${Number(c.id)})">مشاهده</button></td>
        </tr>`).join("") : `<tr><td colspan="6" class="customer-empty">مشتری‌ای پیدا نشد.</td></tr>`;
    }catch(error){
        body.innerHTML=`<tr><td colspan="6" class="customer-empty">خطا در دریافت اطلاعات مشتریان.</td></tr>`;
        console.error(error);
    }
}
function escapeCustomer(value){
    return String(value ?? "").replace(/[&<>'"]/g, ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function openCustomerModal(){document.getElementById("customerModal")?.removeAttribute("hidden");document.getElementById("customerName")?.focus();}
function closeCustomerModal(){document.getElementById("customerModal")?.setAttribute("hidden","");}
async function saveCustomer(){
    const name=document.getElementById("customerName")?.value.trim();
    if(!name){alert("نام مشتری را وارد کنید.");return;}
    const result=await window.pasargad.addCustomer({
        name,
        mobile:document.getElementById("customerMobile")?.value.trim(),
        phone:document.getElementById("customerPhone")?.value.trim(),
        address:document.getElementById("customerAddress")?.value.trim(),
        notes:document.getElementById("customerNotes")?.value.trim()
    });
    if(!result?.success){alert(result?.error || "ثبت مشتری انجام نشد.");return;}
    ["customerName","customerMobile","customerPhone","customerAddress","customerNotes"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});
    closeCustomerModal();
    await loadCustomers();
    const m=document.getElementById("customerMessage"); if(m){m.textContent="مشتری با موفقیت ثبت شد.";setTimeout(()=>m.textContent="",2500);}
}
function viewCustomerSoon(id){
    const c=customerRowsCache.find(x=>Number(x.id)===Number(id));
    if(c) alert(`پرونده «${c.name}» در مرحله بعد تکمیل می‌شود.`);
}
document.addEventListener("DOMContentLoaded",()=>loadCustomers());
