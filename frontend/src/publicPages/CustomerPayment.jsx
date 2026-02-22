import React, {useState, useEffect} from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export default function CustomerPayment({uuid}){
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{
    if(!uuid) return
    fetch(`${API_URL.replace(/\/$/, '')}/public/orders/${uuid}`)
      .then(r=>{ if(!r.ok) throw new Error('Order not found'); return r.json() })
      .then(j=> setOrder(j))
      .catch(e=> setError(e.message))
      .finally(()=> setLoading(false))
  },[uuid])

  if(loading) return (<div style={{padding:20,fontFamily:'sans-serif'}}>Loading...</div>)
  if(error) return (<div style={{padding:20,fontFamily:'sans-serif'}}>{error}</div>)
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

  const handleSubmit = async (e)=>{
    e.preventDefault()
    setError('')
    if(!file){ setError('Please choose a file'); return }
    const fd = new FormData()
    fd.append('installment', inst)
    fd.append('file', file)
    setUploading(true)
    try{
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/public/orders/${uuid}/slip`, {
        method:'POST', body: fd
      })
      if(!res.ok) throw new Error('Upload failed')
      await res.json()
      window.location.href = '/payment-success'
    }catch(err){
      setError(err.message||'Upload error')
    }finally{setUploading(false)}
  }

  return (
    <div style={{fontFamily:'sans-serif',padding:16,maxWidth:480,margin:'0 auto'}}>
      <h2 style={{marginTop:8}}>ชำระเงินสำหรับออเดอร์ {order.order_no}</h2>
      <p style={{color:'#666'}}>สถานะ: {order.status}</p>
      <div style={{background:'#fff',padding:12,borderRadius:8,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',marginTop:8}}>
        <div style={{fontSize:20,fontWeight:700}}>ยอดที่ต้องจ่าย: ฿{amount}</div>
        <div style={{marginTop:8,color:'#444'}}>งวด: {inst}</div>
      </div>

      <form onSubmit={handleSubmit} style={{marginTop:16}}>
        <label style={{display:'block',marginBottom:8}}>แนบรูปสลิป (jpg/png, &lt;=5MB)</label>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
        {error && <div style={{color:'red',marginTop:8}}>{error}</div>}
        <button type="submit" disabled={uploading} style={{marginTop:12,padding:'10px 14px',background:'#0b74de',color:'#fff',border:'none',borderRadius:6}}> {uploading?'Uploading...':'Upload Slip & Send'} </button>
      </form>

      <div style={{marginTop:18,fontSize:13,color:'#777'}}>หากมีปัญหา ติดต่อผู้ขายเพื่อขอคำแนะนำ</div>
    </div>
  )
}
