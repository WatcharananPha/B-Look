import React, {useState} from 'react'
import { Link, Copy, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export default function OrderAdminExtras({order, onApproved}){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  if(!order) return null

  const origin = window.location.origin || ''
  const publicLink = `${origin}/pay/${order.order_uuid || order.id || ''}`

  const doCopy = ()=>{
    try{ 
      navigator.clipboard.writeText(publicLink); 
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }catch{ 
      prompt('Copy link:', publicLink) 
    }
  }

  const approveSlip = async (installment, approved=true) =>{
    setError(''); setLoading(true)
    try{
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/orders/${order.id}/approve-slip`,{
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', ...(token?{'Authorization':'Bearer '+token}:{}) },
        body: JSON.stringify({ installment, approved, note: '' })
      })
      if(!res.ok){
        const txt = await res.text()
        throw new Error(txt || 'Approve slip failed')
      }
      onApproved && onApproved()
    }catch(e){ setError(e.message||'Approve error') }
    finally{ setLoading(false) }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mt-4 print:hidden" style={{width: '320px'}}>
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Link size={16} className="text-blue-500"/>
          จัดการสลิป & ลิงก์ชำระเงิน
        </h3>
      </div>

      <div className="p-4 space-y-5">
        {/* Link Section */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Public Link สำหรับลูกค้า</div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 truncate flex-1 font-mono select-all">
              {publicLink}
            </div>
            <button 
              onClick={doCopy} 
              className={`p-2 rounded-lg transition-all flex items-center justify-center border ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
              title="Copy Link"
            >
              {copied ? <CheckCircle size={16}/> : <Copy size={16}/>}
            </button>
            <a 
              href={publicLink} 
              target="_blank" 
              rel="noreferrer"
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300 rounded-lg transition-all"
              title="Open Link"
            >
              <ExternalLink size={16}/>
            </a>
          </div>
        </div>

        {/* Slips Section */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">ตรวจสอบสลิปการโอน</div>
          <div className="grid grid-cols-1 gap-3">
            {['booking', 'deposit', 'balance'].map((type) => {
              if(!order.slips?.[type]) return null;
              
              const labels = { booking: 'มัดจำจอง', deposit: 'มัดจำ 50%', balance: 'ยอดคงเหลือ' };
              
              return (
                <div key={type} className="bg-slate-50 rounded-lg border border-slate-200 p-2 flex gap-3">
                  <a href={order.slips[type]} target="_blank" rel="noreferrer" className="shrink-0 relative group block w-20 h-20 bg-white rounded border border-slate-200 overflow-hidden">
                    <img src={order.slips[type]} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={type}/>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  </a>
                  <div className="flex flex-col justify-between py-0.5 flex-1">
                    <div className="text-xs font-bold text-slate-800">{labels[type]}</div>
                    <div className="flex gap-1.5 mt-2">
                       <button disabled={loading} onClick={()=>approveSlip(type, true)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded text-xs font-semibold transition-colors disabled:opacity-50">
                         <CheckCircle size={14}/> อนุมัติ
                       </button>
                       <button disabled={loading} onClick={()=>approveSlip(type, false)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-semibold transition-colors disabled:opacity-50">
                         <XCircle size={14}/> ปฏิเสธ
                       </button>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {!order.slips?.booking && !order.slips?.deposit && !order.slips?.balance && (
              <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                ยังไม่มีการแนบสลิป
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs bg-red-50 text-red-600 p-2 rounded border border-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
