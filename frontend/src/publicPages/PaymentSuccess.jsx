import React, { useEffect, useState } from 'react'

export default function PaymentSuccess() {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1))
    }, 1000)
    
    // Auto redirect
    const redirect = setTimeout(() => {
      window.location.href = '/'
    }, 5000)

    return () => {
      clearInterval(timer)
      clearTimeout(redirect)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8 border border-gray-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        
        <h2 className="text-2xl font-black text-gray-900 mb-2">ส่งสลิปสำเร็จ!</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          ระบบได้รับหลักฐานการชำระเงินของคุณแล้ว<br/> 
          ทางร้านจะใช้เวลาตรวจสอบและอัปเดตสถานะให้คุณทราบโดยเร็วที่สุด
        </p>

        <a href="/" className="inline-block w-full bg-[#1a1c23] hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-all">
          ตกลง
        </a>
        <p className="text-xs text-gray-400 mt-4">ระบบจะพากลับหน้าหลักใน {countdown} วินาที...</p>
      </div>
    </div>
  )
}

