import React, {useState, useEffect} from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

function getUuidFromLocation(){
  try{
    const p = window.location.pathname.split('/').filter(Boolean)
    const idx = p.indexOf('pay')
    if(idx >= 0 && p.length > idx+1) return p[idx+1]
    return p[p.length-1]
  }catch{return null}
}

function absoluteSlipUrl(path){
  if(!path) return null
  try{
    if(path.startsWith('http')) return path
    const apiOrigin = new URL(API_URL).origin
    return path.startsWith('/') ? `${apiOrigin}${path}` : `${apiOrigin}/${path}`
  }catch{
    return path
  }
}

export default function CustomerPayment({uuid}){
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const orderUuid = uuid || getUuidFromLocation()

  useEffect(()=>{
    if(!orderUuid) { setError('Missing order UUID'); setLoading(false); return }
    setLoading(true); setError('')
    fetch(`${API_URL.replace(/\/$/, '')}/public/orders/${orderUuid}`)
      .then(async r=>{
        if(!r.ok){
          let txt = 'Order not found'
          try{ const j = await r.json(); txt = j.detail || JSON.stringify(j) }catch{ txt = await r.text().catch(()=>txt) }
          throw new Error(txt)
        }
        return r.json()
      })
      .then(j=> setOrder(j))
      .catch(e=> setError(e.message || 'Failed to load order'))
      .finally(()=> setLoading(false))
  },[orderUuid])

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if(loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">กำลังโหลดข้อมูลออเดอร์...</p>
      </div>
    </div>
  )
  if(error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-red-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">ไม่สามารถโหลดข้อมูลได้</h3>
        <p className="text-red-500 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-[#1a1c23] text-white py-3 rounded-xl font-bold">ลองใหม่อีกครั้ง</button>
      </div>
    </div>
  )
  if(!order) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-500 text-lg">ไม่พบข้อมูลออเดอร์ที่คุณค้นหา</p>
      </div>
    </div>
  )


  const installmentForStatus = (status)=>{
    const s=(status||'').toUpperCase()
    if(s==='WAITING_BOOKING') return 'booking'
    if(s==='WAITING_DEPOSIT') return 'deposit'
    if(s==='WAITING_BALANCE') return 'balance'
    return 'balance'
  }

  const amount = order.amount_due || 0
  const inst = installmentForStatus(order.status)

  const validateFile = (f)=>{
    if(!f) return 'No file selected'
    const allowed = ['image/jpeg','image/png']
    if(!allowed.includes(f.type)) return 'Only JPG/PNG images allowed'
    const MAX = 5 * 1024 * 1024
    if(f.size > MAX) return 'File too large (max 5MB)'
    return null
  }

  const handleSubmit = async (e)=>{
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    const v = validateFile(file)
    if(v){ setError(v); return }

    const fd = new FormData()
    fd.append('installment', inst)
    fd.append('file', file)
    setUploading(true)
    try{
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/public/orders/${orderUuid}/slip`, {
        method:'POST', body: fd
      })
      if(!res.ok){
        let msg = 'Upload failed'
        try{ const j = await res.json(); msg = j.detail || JSON.stringify(j) }catch{ msg = await res.text().catch(()=>msg) }
        throw new Error(msg)
      }
      const payload = await res.json()
      setSuccessMsg('Upload successful')
      const r = (payload && payload.file_name) ? encodeURIComponent(payload.file_name) : ''
      const u = encodeURIComponent(order.order_uuid || order.order_no || '')
      window.location.href = `/success.html?u=${u}${r?('&r='+r):''}`
    }catch(err){
      setError(err.message||'Upload error')
    }finally{setUploading(false)}
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center sm:justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white sm:shadow-xl sm:rounded-2xl overflow-hidden min-h-screen sm:min-h-0 flex flex-col">
        {/* Header Section */}
        <div className="bg-[#1a1c23] px-6 py-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">ชำระเงิน</h2>
              <p className="text-slate-300 mt-1 text-sm">เลขที่ออเดอร์: <span className="font-mono">{order.order_no}</span></p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">สถานะ</div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {order.status}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-6 md:p-8 flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
            
            {/* Left Col: Amount & History */}
            <div className="flex flex-col gap-6">
              {/* Amount Box */}
              <div className="bg-blue-50 rounded-2xl p-6 text-center border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <div className="text-sm font-medium text-blue-800 mb-2">ยอดที่ต้องชำระ (งวด {inst})</div>
                <div className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                  ฿{Number(amount).toLocaleString('th-TH', {minimumFractionDigits: 2})}
                </div>
                <p className="text-xs text-blue-600/70 mt-3 font-medium">รวมค่าจัดส่ง/ภาษี และหักมัดจำแล้ว (ถ้ามี)</p>
              </div>

              {/* Slips History */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex-1">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs">📎</span>
                  ประวัติการโอนเงิน
                </h4>
                
                <div className="flex flex-wrap gap-3">
                  {['booking', 'deposit', 'balance'].map(key => order.slips?.[key] && (
                    <div key={key} className="relative group">
                      <a href={absoluteSlipUrl(order.slips[key])} target="_blank" rel="noreferrer" className="block w-20 h-20 md:w-24 md:h-24 overflow-hidden rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all">
                        <img src={absoluteSlipUrl(order.slips[key])} alt={key} className="w-full h-full object-cover"/>
                      </a>
                      <div className="absolute -bottom-2 -right-2 bg-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-sm capitalize">{key}</div>
                    </div>
                  ))}
                  
                  {!order.slips?.booking && !order.slips?.deposit && !order.slips?.balance && (
                    <div className="text-sm text-gray-400 italic py-2 w-full text-center bg-white rounded-lg border border-dashed border-gray-200">ยังไม่มีประวัติสลิป</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Col: Upload Form */}
            <div className="flex flex-col">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex-1 flex flex-col">
                <h4 className="text-base font-bold text-gray-900 mb-4">แจ้งชำระเงิน</h4>
                
                <form onSubmit={handleSubmit} aria-label="Upload slip form" className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">แนบรูปสลิป <span className="text-gray-400 font-normal">(JPG/PNG ไม่เกิน 5MB)</span></label>
                  
                  <div className="relative mt-1 mb-4 group cursor-pointer">
                    <input type="file" accept="image/png,image/jpeg" onChange={e=>setFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`w-full p-4 border-2 border-dashed rounded-xl text-center bg-gray-50 flex flex-col items-center justify-center transition-colors ${file ? 'border-teal-400 bg-teal-50' : 'border-gray-300 group-hover:border-blue-400 group-hover:bg-blue-50/50'}`}>
                      <span className="text-2xl mb-2">{file ? '✅' : '📸'}</span>
                      <span className="text-sm font-medium text-gray-700">{file ? file.name : 'แตะเพื่อเลือกไฟล์ หรือลากมาวาง'}</span>
                    </div>
                  </div>

                  {preview && (
                    <div className="mt-2 mb-6">
                      <div className="text-xs text-gray-500 mb-2 font-medium">ตัวอย่างไฟล์สลิป</div>
                      <div className="w-full p-2 bg-gray-100 rounded-xl relative">
                        <img src={preview} alt="preview" className="max-h-48 w-auto mx-auto rounded-lg shadow-sm" />
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                    {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">{successMsg}</div>}

                    <button type="submit" disabled={uploading || !file} className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-[#1a1c23] hover:bg-slate-800 text-white px-4 py-3.5 text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {uploading ? (
                        <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> กำลังอัปโหลด...</>
                      ) : (
                        'ยืนยันการชำระเงิน'
                      )}
                    </button>
                    
                    <p className="mt-4 text-center text-xs text-gray-400">หากพบปัญหา กรุณาติดต่อแอดมิน</p>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
