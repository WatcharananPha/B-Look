import React from 'react'

export default function PaymentSuccess(){
  return (
    <div style={{fontFamily:'sans-serif',padding:20,maxWidth:480,margin:'0 auto',textAlign:'center'}}>
      <h2>อัปโหลดสลิปสำเร็จ</h2>
      <p>ขอบคุณ! ระบบได้รับสลิปของคุณแล้ว ผู้ขายจะตรวจสอบและอัปเดตสถานะให้ต่อไป</p>
      <a href="/" style={{display:'inline-block',marginTop:12,color:'#0b74de'}}>กลับสู่หน้าแรก</a>
    </div>
  )
}
