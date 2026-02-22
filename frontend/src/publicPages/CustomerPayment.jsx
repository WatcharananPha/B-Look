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
      await res.json()
      setSuccessMsg('Upload successful')
      // redirect to a success page (public static) for simplicity
      window.location.href = '/success.html'
    }catch(err){
      setError(err.message||'Upload error')
    }finally{setUploading(false)}
  }

  return (
    <div style={{fontFamily:'sans-serif',padding:16,maxWidth:640,margin:'0 auto'}}>
      <h2 style={{marginTop:8}}>ชำระเงินสำหรับออเดอร์ {order.order_no}</h2>
      <p style={{color:'#666'}}>สถานะ: {order.status}</p>
      <div style={{background:'#fff',padding:12,borderRadius:8,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',marginTop:8}}>
        <div style={{fontSize:20,fontWeight:700}}>ยอดที่ต้องจ่าย: ฿{amount}</div>
        <div style={{marginTop:8,color:'#444'}}>งวด: {inst}</div>
      </div>

      <div style={{marginTop:12}}>
        <div style={{fontSize:13,color:'#666'}}>สลิปที่อัปโหลดแล้ว</div>
        <div style={{display:'flex',gap:12,marginTop:8}}>
          {order.slips?.booking && (
            <a href={absoluteSlipUrl(order.slips.booking)} target="_blank" rel="noreferrer">
              <img src={absoluteSlipUrl(order.slips.booking)} alt="booking" style={{width:120,height:80,objectFit:'cover',borderRadius:6}}/>
            </a>
          )}
          {order.slips?.deposit && (
            <a href={absoluteSlipUrl(order.slips.deposit)} target="_blank" rel="noreferrer">
              <img src={absoluteSlipUrl(order.slips.deposit)} alt="deposit" style={{width:120,height:80,objectFit:'cover',borderRadius:6}}/>
            </a>
          )}
          {order.slips?.balance && (
            <a href={absoluteSlipUrl(order.slips.balance)} target="_blank" rel="noreferrer">
              <img src={absoluteSlipUrl(order.slips.balance)} alt="balance" style={{width:120,height:80,objectFit:'cover',borderRadius:6}}/>
            </a>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{marginTop:16}}
            aria-label="Upload slip form">
        <label style={{display:'block',marginBottom:8}}>แนบรูปสลิป (jpg/png, &lt;=5MB)</label>
        <input type="file" accept="image/png,image/jpeg" onChange={e=>setFile(e.target.files[0])} />
        {error && <div style={{color:'red',marginTop:8}}>{error}</div>}
        {successMsg && <div style={{color:'green',marginTop:8}}>{successMsg}</div>}
        <button type="submit" disabled={uploading} style={{marginTop:12,padding:'10px 14px',background:'#0b74de',color:'#fff',border:'none',borderRadius:6}}> {uploading?'Uploading...':'Upload Slip & Send'} </button>
      </form>

      <div style={{marginTop:18,fontSize:13,color:'#777'}}>หากมีปัญหา ติดต่อผู้ขายเพื่อขอคำแนะนำ</div>
    </div>
  )
}
