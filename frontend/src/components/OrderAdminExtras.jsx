import React, {useState} from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export default function OrderAdminExtras({order, onApproved}){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if(!order) return null

  const origin = window.location.origin || ''
  const publicLink = `${origin}/pay/${order.order_uuid}`

  const doCopy = ()=>{
    try{ navigator.clipboard.writeText(publicLink); alert('Copied link to clipboard') }catch(e){ prompt('Copy link', publicLink) }
  }

  const approve = async (nextStatus)=>{
    setError(''); setLoading(true)
    try{
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/admin/orders/${order.id}/approve`,{
        method:'POST', headers: { 'Content-Type':'application/json', ...(token?{'Authorization':'Bearer '+token}:{}) }, body: JSON.stringify({ next_status: nextStatus })
      })
      if(!res.ok) throw new Error('Approve failed')
      onApproved && onApproved()
      alert('Order approved')
    }catch(e){ setError(e.message||'Approve error') }
    finally{ setLoading(false) }
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
      alert(approved? 'Slip approved' : 'Slip rejected')
    }catch(e){ setError(e.message||'Approve error') }
    finally{ setLoading(false) }
  }

  return (
    <div style={{padding:10,border:'1px solid #eee',borderRadius:8,background:'#fff'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:12,color:'#666'}}>Public Link</div>
          <div style={{fontWeight:600}}>{publicLink}</div>
        </div>
        <div>
          <button onClick={doCopy} style={{padding:'6px 10px',borderRadius:6,background:'#0b74de',color:'#fff'}}>Copy Link</button>
        </div>
      </div>

      <div style={{marginTop:10}}>
        <div style={{fontSize:12,color:'#666'}}>Slips</div>
        <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
          {order.slips?.booking && (
            <div style={{textAlign:'center'}}>
              <a href={order.slips.booking} target="_blank" rel="noreferrer"><img src={order.slips.booking} style={{width:120,height:80,objectFit:'cover',borderRadius:6}}/></a>
              <div style={{marginTop:6,display:'flex',gap:6,justifyContent:'center'}}>
                <button disabled={loading} onClick={()=>approveSlip('booking', true)} style={{padding:'6px 8px',background:'#16a34a',color:'#fff',borderRadius:6}}>Approve</button>
                <button disabled={loading} onClick={()=>approveSlip('booking', false)} style={{padding:'6px 8px',background:'#ef4444',color:'#fff',borderRadius:6}}>Reject</button>
              </div>
            </div>
          )}

          {order.slips?.deposit && (
            <div style={{textAlign:'center'}}>
              <a href={order.slips.deposit} target="_blank" rel="noreferrer"><img src={order.slips.deposit} style={{width:120,height:80,objectFit:'cover',borderRadius:6}}/></a>
              <div style={{marginTop:6,display:'flex',gap:6,justifyContent:'center'}}>
                <button disabled={loading} onClick={()=>approveSlip('deposit', true)} style={{padding:'6px 8px',background:'#16a34a',color:'#fff',borderRadius:6}}>Approve</button>
                <button disabled={loading} onClick={()=>approveSlip('deposit', false)} style={{padding:'6px 8px',background:'#ef4444',color:'#fff',borderRadius:6}}>Reject</button>
              </div>
            </div>
          )}

          {order.slips?.balance && (
            <div style={{textAlign:'center'}}>
              <a href={order.slips.balance} target="_blank" rel="noreferrer"><img src={order.slips.balance} style={{width:120,height:80,objectFit:'cover',borderRadius:6}}/></a>
              <div style={{marginTop:6,display:'flex',gap:6,justifyContent:'center'}}>
                <button disabled={loading} onClick={()=>approveSlip('balance', true)} style={{padding:'6px 8px',background:'#16a34a',color:'#fff',borderRadius:6}}>Approve</button>
                <button disabled={loading} onClick={()=>approveSlip('balance', false)} style={{padding:'6px 8px',background:'#ef4444',color:'#fff',borderRadius:6}}>Reject</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{marginTop:12,display:'flex',gap:8}}>
        <button disabled={loading} onClick={()=>approve('advance')} style={{padding:'8px 12px',background:'#16a34a',color:'#fff',borderRadius:6}}>Approve / Advance</button>
        <button disabled={loading} onClick={()=>approve('confirm')} style={{padding:'8px 12px',background:'#f59e0b',color:'#fff',borderRadius:6}}>Confirm</button>
      </div>
      {error && <div style={{color:'red',marginTop:8}}>{error}</div>}
    </div>
  )
}
