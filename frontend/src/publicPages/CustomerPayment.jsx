import React, {useState, useEffect} from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

function getUuidFromLocation(){
  try{
    const p = window.location.pathname.split('/').filter(Boolean)
    // support /pay/:uuid
    const idx = p.indexOf('pay')
    if(idx >= 0 && p.length > idx+1) return p[idx+1]
    // fallback: last segment
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

  // Keep file preview hook above any early returns to satisfy Rules of Hooks
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if(loading) return (<div style={{padding:20,fontFamily:'sans-serif'}}>Loading...</div>)
  if(error) return (<div style={{padding:20,fontFamily:'sans-serif',color:'red'}}>{error}</div>)
  if(!order) return (<div style={{padding:20,fontFamily:'sans-serif'}}>No order</div>)

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
      // redirect to a success page (public static) and include slip file ref
      const r = (payload && payload.file_name) ? encodeURIComponent(payload.file_name) : ''
      const u = encodeURIComponent(order.order_uuid || order.order_no || '')
      window.location.href = `/success.html?u=${u}${r?('&r='+r):''}`
    }catch(err){
      setError(err.message||'Upload error')
    }finally{setUploading(false)}
  }

  

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">ชำระเงิน — ออเดอร์ {order.order_no}</h3>
              <p className="text-sm text-gray-500 mt-1">สถานะ: <span className="font-medium text-gray-700">{order.status}</span></p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">งวด</div>
              <div className="text-xl font-bold text-teal-600">{inst}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">ยอดที่ต้องจ่าย</div>
              <div className="text-3xl font-extrabold text-gray-900 mt-1">฿{amount}</div>
              <p className="text-xs text-gray-500 mt-2">รวมค่าจัดส่ง/ภาษี และหักมัดจำแล้ว (ถ้ามี)</p>

              <div className="mt-4">
                <div className="text-sm text-gray-600">สลิปที่อัปโหลดแล้ว</div>
                <div className="flex gap-3 mt-2">
                  {order.slips?.booking && (
                    <a href={absoluteSlipUrl(order.slips.booking)} target="_blank" rel="noreferrer" className="block w-28 h-20 overflow-hidden rounded shadow-sm">
                      <img src={absoluteSlipUrl(order.slips.booking)} alt="booking" className="w-full h-full object-cover"/>
                    </a>
                  )}
                  {order.slips?.deposit && (
                    <a href={absoluteSlipUrl(order.slips.deposit)} target="_blank" rel="noreferrer" className="block w-28 h-20 overflow-hidden rounded shadow-sm">
                      <img src={absoluteSlipUrl(order.slips.deposit)} alt="deposit" className="w-full h-full object-cover"/>
                    </a>
                  )}
                  {order.slips?.balance && (
                    <a href={absoluteSlipUrl(order.slips.balance)} target="_blank" rel="noreferrer" className="block w-28 h-20 overflow-hidden rounded shadow-sm">
                      <img src={absoluteSlipUrl(order.slips.balance)} alt="balance" className="w-full h-full object-cover"/>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded border">
              <form onSubmit={handleSubmit} aria-label="Upload slip form">
                <label className="block text-sm font-medium text-gray-700">แนบรูปสลิป (jpg/png, &lt;=5MB)</label>
                <div className="mt-2 flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center px-3 py-2 bg-white border rounded-md shadow-sm text-sm text-gray-700 hover:bg-gray-50">
                    เลือกไฟล์
                    <input type="file" accept="image/png,image/jpeg" onChange={e=>setFile(e.target.files[0])} className="sr-only" />
                  </label>
                  <div className="text-sm text-gray-600">{file ? file.name : 'ยังไม่ได้เลือกไฟล์'}</div>
                </div>

                {preview && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500">ตัวอย่างไฟล์</div>
                    <div className="mt-2 w-full h-40 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      <img src={preview} alt="preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                )}

                {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
                {successMsg && <div className="mt-3 text-sm text-green-600">{successMsg}</div>}

                <button type="submit" disabled={uploading} className="mt-4 w-full inline-flex justify-center items-center gap-2 rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-semibold hover:bg-teal-500 disabled:opacity-60">
                  {uploading ? 'Uploading…' : 'Upload Slip & Send'}
                </button>

                <div className="mt-3 text-xs text-gray-500">หากมีปัญหา ติดต่อผู้ขายเพื่อขอคำแนะนำ</div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
