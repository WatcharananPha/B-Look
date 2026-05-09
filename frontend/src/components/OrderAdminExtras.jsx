import React, {useState} from 'react'
import { Link, Copy, CheckCircle, XCircle, ExternalLink, X, ZoomIn } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

// Role helpers (mirrored from App.jsx)
const _normalizeRole = (r) => (r || '').toUpperCase()
const _hasRole = (role, ...allowed) => allowed.flat().includes(_normalizeRole(role))

export default function OrderAdminExtras({order, onApproved}){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [tracking, setTracking] = useState('')
  const [file, setFile] = useState(null)
  // Slip image lightbox preview
  const [previewSlip, setPreviewSlip] = useState(null) // { url, type, label }

  if(!order) return null

  const userRole = _normalizeRole(localStorage.getItem('user_role'))
  const origin = window.location.origin || ''
  const publicLink = `${origin}/pay/${order.order_uuid || order.id || ''}`
  const orderStatus = (order.status || '').toUpperCase()

  // Resolve a relative static path (e.g. /static/slips/…) to a fully-qualified URL.
  const resolveUrl = (path) => {
    if (!path) return null
    if (path.startsWith('http')) return path
    try {
      const apiOrigin = new URL(API_URL).origin
      return path.startsWith('/') ? `${apiOrigin}${path}` : `${apiOrigin}/${path}`
    } catch { return path }
  }

  // Support both flat slip_*_url fields and nested slips object.
  const resolvedSlips = {
    booking: resolveUrl(order.slips?.booking || order.slip_booking_url || null),
    deposit: resolveUrl(order.slips?.deposit || order.slip_deposit_url || null),
    balance: resolveUrl(order.slips?.balance || order.slip_balance_url || null),
  }

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

  const doAction = async (method, path, body, isForm=false) => {
    setError(''); setLoading(true)
    try{
      const token = localStorage.getItem('access_token')
      const headers = token?{'Authorization':'Bearer '+token}:{ }
      let opts = { method, headers }
      if (!isForm) headers['Content-Type'] = 'application/json'
      if (body) opts.body = isForm ? body : JSON.stringify(body)
      const res = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, opts)
      if(!res.ok){ const txt = await res.text(); throw new Error(txt||'Action failed') }
      onApproved && onApproved()
    }catch(e){ setError(e.message||'Error') }
    finally{ setLoading(false) }
  }

  // Workflow actions
  const approveArtwork = () => doAction('PATCH', `/orders/${order.id}/status`, { status: 'ARTWORK_APPROVED' })
  const rejectArtwork = () => doAction('PATCH', `/orders/${order.id}/status`, { status: 'WAITING_ARTWORK' })
  const issueProductionTicket = () => doAction('POST', `/orders/${order.id}/production-ticket`, { note: 'Issued from UI' })

  const uploadPrintFile = async () => {
    if(!file){ setError('กรุณาเลือกไฟล์ก่อนอัปโหลด'); return }
    const form = new FormData()
    form.append('print_file', file)
    await doAction('POST', `/orders/${order.id}/print-file`, form, true)
  }

  const markProductionStep = (step) => doAction('PATCH', `/orders/${order.id}/production-step`, { step, done: true })
  const markQC = (passed) => doAction('PATCH', `/orders/${order.id}/qc`, { passed, note: '' })
  const markShipping = () => doAction('PATCH', `/orders/${order.id}/shipping`, { tracking_number: tracking })

  // Permission helpers
  const canApproveSlip = _hasRole(userRole, 'SALES_ADMIN', 'ADMIN_D', 'ADMIN_OPS', 'ADMIN', 'OWNER', 'SUPERADMIN')
  const canApproveArtwork = _hasRole(userRole, 'SALES_ADMIN', 'ADMIN_D', 'ADMIN_OPS', 'ADMIN', 'OWNER', 'SUPERADMIN')
  const canUploadPrintFile = _hasRole(userRole, 'GRAPHIC_DESIGNER', 'ADMIN', 'OWNER', 'SUPERADMIN')
  const canDoProduction = _hasRole(userRole, 'PRODUCTION', 'ADMIN_OPS', 'ADMIN', 'OWNER', 'SUPERADMIN')
  const canIssueTicket = _hasRole(userRole, 'ADMIN_OPS', 'ADMIN', 'OWNER', 'SUPERADMIN')
  const canDoQC = _hasRole(userRole, 'ADMIN_OPS', 'ADMIN', 'OWNER', 'SUPERADMIN')
  const canShip = _hasRole(userRole, 'SHIPPING_ADMIN', 'ADMIN_OPS', 'ADMIN_D', 'ADMIN', 'OWNER', 'SUPERADMIN')

  const PRODUCTION_STEPS = [
    { key: 'printing', label: '① พิมพ์' },
    { key: 'screening', label: '② สกรีน' },
    { key: 'cutting', label: '③ ตัด' },
    { key: 'sewing', label: '④ เย็บ' },
  ]

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mt-4 print:hidden" style={{width: '320px'}}>
      {/* Slip image lightbox */}
      {previewSlip && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setPreviewSlip(null)}>
          <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-bold text-sm px-3 py-1 bg-white/10 rounded-full">{previewSlip.label}</span>
              <button onClick={() => setPreviewSlip(null)} className="text-white/70 hover:text-white transition p-1"><X size={22}/></button>
            </div>
            <img src={previewSlip.url} alt={previewSlip.label} className="w-full max-h-[65vh] object-contain rounded-xl shadow-2xl"/>
            {/* Approve/Reject from lightbox */}
            {canApproveSlip && (
              <div className="flex gap-3 mt-4">
                <button disabled={loading} onClick={() => { approveSlip(previewSlip.type, true); setPreviewSlip(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm transition disabled:opacity-50">
                  <CheckCircle size={16}/> อนุมัติสลิป
                </button>
                <button disabled={loading} onClick={() => { approveSlip(previewSlip.type, false); setPreviewSlip(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition disabled:opacity-50">
                  <XCircle size={16}/> ปฏิเสธ
                </button>
              </div>
            )}
            <div className="flex justify-center mt-3">
              <a href={previewSlip.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition">
                <ExternalLink size={12}/> เปิดรูปเต็มหน้า
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Link size={16} className="text-blue-500"/>
          จัดการสลิป & ลิงก์ชำระเงิน
        </h3>
      </div>

      <div className="p-4 space-y-5">
        {/* Public payment link */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Public Link สำหรับลูกค้า</div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 truncate flex-1 font-mono select-all">
              {publicLink}
            </div>
            <button onClick={doCopy}
              className={`p-2 rounded-lg transition-all flex items-center justify-center border ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
              title="Copy Link">
              {copied ? <CheckCircle size={16}/> : <Copy size={16}/>}
            </button>
            <a href={publicLink} target="_blank" rel="noreferrer"
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300 rounded-lg transition-all"
              title="Open Link">
              <ExternalLink size={16}/>
            </a>
          </div>
        </div>

        {/* Slip verification */}
        {canApproveSlip && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">ตรวจสอบสลิปการโอน</div>
            <div className="grid grid-cols-1 gap-3">
              {['booking', 'deposit', 'balance'].map((type) => {
                const slipUrl = resolvedSlips[type]
                if (!slipUrl) return null
                const labels = { booking: 'มัดจำจอง', deposit: 'มัดจำ 50%', balance: 'ยอดคงเหลือ' }
                return (
                  <div key={type} className="bg-slate-50 rounded-lg border border-slate-200 p-2 flex gap-3">
                    {/* Thumbnail — click to open lightbox preview */}
                    <button type="button" onClick={() => setPreviewSlip({ url: slipUrl, type, label: labels[type] })}
                      className="shrink-0 relative group block w-20 h-20 bg-white rounded border border-slate-200 overflow-hidden cursor-zoom-in" title="คลิกเพื่อดูรูปขยาย">
                      <img src={slipUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={`slip-${type}`} loading="lazy"/>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                        <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 drop-shadow"/>
                      </div>
                    </button>
                    <div className="flex flex-col justify-between py-0.5 flex-1">
                      <div className="text-xs font-bold text-slate-800">{labels[type]}</div>
                      <div className="flex gap-1.5 mt-2">
                        <button disabled={loading} onClick={() => approveSlip(type, true)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded text-xs font-semibold transition-colors disabled:opacity-50">
                          <CheckCircle size={14}/> อนุมัติ
                        </button>
                        <button disabled={loading} onClick={() => approveSlip(type, false)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-semibold transition-colors disabled:opacity-50">
                          <XCircle size={14}/> ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!resolvedSlips.booking && !resolvedSlips.deposit && !resolvedSlips.balance && (
                <div className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  ยังไม่มีการแนบสลิป
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workflow Actions */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Flow Actions</div>
          <div className="space-y-2">

            {/* Approve / Reject Artwork — WAITING_CUSTOMER_APPROVAL */}
            {canApproveArtwork && orderStatus === 'WAITING_CUSTOMER_APPROVAL' && (
              <div className="flex gap-2">
                <button onClick={approveArtwork} disabled={loading}
                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-sm font-semibold disabled:opacity-50">
                  <CheckCircle size={14} className="inline mr-1"/>อนุมัติ Artwork
                </button>
                <button onClick={rejectArtwork} disabled={loading}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-sm font-semibold disabled:opacity-50">
                  <XCircle size={14} className="inline mr-1"/>ส่งกลับแก้
                </button>
              </div>
            )}

            {/* Upload Print File — ARTWORK_APPROVED (fixed: was READY_FOR_PRODUCTION) */}
            {canUploadPrintFile && orderStatus === 'ARTWORK_APPROVED' && (
              <div>
                <div className="text-xs text-slate-500 mb-1">อัปโหลดไฟล์พิมพ์ (→ IN_PRODUCTION)</div>
                <div className="flex gap-2">
                  <input type="file" accept="image/*,.pdf,.ai,.eps,.psd" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="flex-1 text-xs"/>
                  <button onClick={uploadPrintFile} disabled={loading||!file}
                    className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded text-xs font-semibold disabled:opacity-50">
                    Upload
                  </button>
                </div>
              </div>
            )}

            {/* Production Steps — IN_PRODUCTION (4 steps) */}
            {canDoProduction && orderStatus === 'IN_PRODUCTION' && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">ขั้นตอนการผลิต</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRODUCTION_STEPS.map(step => {
                    const done = order.production_steps?.[step.key]
                    return (
                      <button key={step.key} onClick={() => !done && markProductionStep(step.key)} disabled={loading || done}
                        className={`py-1.5 rounded text-xs font-semibold border flex items-center justify-center gap-1 transition ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default' : 'bg-slate-50 hover:bg-blue-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                        {done ? <CheckCircle size={12}/> : null}
                        {step.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Issue Production Ticket / QC Sign-off — READY_FOR_SHIPPING */}
            {canIssueTicket && orderStatus === 'READY_FOR_SHIPPING' && (
              <button onClick={issueProductionTicket} disabled={loading}
                className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-sm font-semibold disabled:opacity-50">
                Issue Production Ticket (QC)
              </button>
            )}

            {/* QC Pass / Fail — IN_PRODUCTION */}
            {canDoQC && orderStatus === 'IN_PRODUCTION' && (
              <div className="flex gap-2">
                <button onClick={()=>markQC(true)} disabled={loading}
                  className="flex-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded text-xs font-semibold disabled:opacity-50">
                  QC ผ่าน
                </button>
                <button onClick={()=>markQC(false)} disabled={loading}
                  className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-semibold disabled:opacity-50">
                  QC ไม่ผ่าน
                </button>
              </div>
            )}

            {/* Shipping — READY_FOR_SHIPPING */}
            {canShip && orderStatus === 'READY_FOR_SHIPPING' && (
              <div className="flex gap-2">
                <input placeholder="Tracking Number" value={tracking} onChange={(e)=>setTracking(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded p-2 focus:ring-2 focus:ring-blue-200 outline-none"/>
                <button onClick={markShipping} disabled={loading || !tracking}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold disabled:opacity-50">
                  จัดส่ง
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-xs bg-red-50 text-red-600 p-2 rounded border border-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

