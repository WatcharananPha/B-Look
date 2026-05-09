import React, { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

function getUuidFromPath() {
  try {
    const parts = window.location.pathname.split('/').filter(Boolean)
    // supports /slip/:uuid
    const idx = parts.indexOf('slip')
    if (idx >= 0 && parts.length > idx + 1) return parts[idx + 1]
    return parts[parts.length - 1] || null
  } catch { return null }
}

export default function SlipUploadPage({ uuid }) {
  const [order, setOrder]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [file, setFile]         = useState(null)
  const [preview, setPreview]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  const orderUuid = uuid || getUuidFromPath()

  // Fetch order info
  useEffect(() => {
    if (!orderUuid) {
      setError('ไม่พบรหัสออเดอร์ในลิงก์นี้')
      setLoading(false)
      return
    }
    fetch(`${API_URL}/public/orders/${orderUuid}`)
      .then(async r => {
        if (!r.ok) {
          let msg = 'ไม่พบออเดอร์นี้ — ลิงก์อาจหมดอายุหรือไม่ถูกต้อง'
          try { const j = await r.json(); msg = j.detail || msg } catch {}
          throw new Error(msg)
        }
        return r.json()
      })
      .then(setOrder)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [orderUuid])

  // Preview blob URL lifecycle
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      setError('รองรับเฉพาะไฟล์ JPG หรือ PNG เท่านั้น')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกิน 5MB — กรุณาบีบอัดรูปก่อน')
      return
    }
    setError('')
    setFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('กรุณาเลือกไฟล์สลิปก่อน'); return }
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('installment', 'booking')
      const res = await fetch(`${API_URL}/public/orders/${orderUuid}/slip`, {
        method: 'POST',
        body: fd
      })
      if (!res.ok) {
        let msg = 'อัปโหลดไม่สำเร็จ'
        try { const j = await res.json(); msg = j.detail || msg } catch {}
        throw new Error(msg)
      }
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        <p className="text-gray-400 text-sm">กำลังโหลด...</p>
      </div>
    </div>
  )

  // ── Invalid UUID / Not Found ─────────────────────────────────────────────────
  if (!order && error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center border border-red-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">ลิงก์ไม่ถูกต้อง</h2>
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <p className="text-gray-400 text-xs">กรุณาติดต่อแอดมินเพื่อขอลิงก์ใหม่</p>
      </div>
    </div>
  )

  // ── Success ──────────────────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">ส่งสำเร็จแล้ว!</h2>
        <p className="text-gray-600 text-sm mb-1">
          ออเดอร์ <span className="font-mono font-bold">{order?.order_no}</span>
        </p>
        <p className="text-gray-400 text-xs mt-4 leading-relaxed">
          ทีมงานได้รับสลิปของคุณแล้ว<br />
          จะตรวจสอบและยืนยันภายใน 1 วันทำการ
        </p>
        <div className="mt-6 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400">
          หากพบปัญหา ติดต่อ B-LOOK ผ่านทาง Line/Facebook
        </div>
      </div>
    </div>
  )

  // ── Main Upload Form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col sm:items-center sm:justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white sm:rounded-2xl sm:shadow-xl overflow-hidden min-h-screen sm:min-h-0 flex flex-col">

        {/* Header */}
        <div className="bg-[#1a1c23] px-6 py-8 text-white shrink-0">
          <div className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">B-LOOK</div>
          <h1 className="text-2xl font-black leading-snug">ส่งหลักฐาน<br />การชำระเงิน</h1>
          {order && (
            <div className="mt-3 space-y-0.5">
              <p className="text-slate-300 text-sm">
                ออเดอร์: <span className="font-mono font-bold text-white">{order.order_no}</span>
              </p>
              {order.customer_name && (
                <p className="text-slate-400 text-xs">{order.customer_name}</p>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 gap-5">

          {/* Drop zone */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              แนบรูปสลิป
              <span className="ml-1 text-gray-400 font-normal text-xs">JPG/PNG · ไม่เกิน 5MB</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="เลือกไฟล์สลิป"
              />
              <div className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                file
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              }`}>
                <div className="text-4xl mb-2">{file ? '📎' : '📸'}</div>
                <div className="text-sm font-semibold text-gray-700">
                  {file ? file.name : 'แตะที่นี่เพื่อเลือกรูป'}
                </div>
                {file
                  ? <div className="text-xs text-emerald-600 mt-1 font-medium">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  : <div className="text-xs text-gray-400 mt-1">หรือลากไฟล์มาวาง</div>
                }
              </div>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 p-2">
              <img
                src={preview}
                alt="ตัวอย่างสลิป"
                className="w-full max-h-60 object-contain rounded-xl"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!file || uploading}
            className="mt-auto w-full py-4 bg-[#1a1c23] hover:bg-slate-800 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-base transition-all flex items-center justify-center gap-2 shadow-md"
          >
            {uploading ? (
              <>
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                กำลังส่ง...
              </>
            ) : (
              '✉️  ยืนยันส่งสลิป'
            )}
          </button>

          <p className="text-center text-xs text-gray-400 pb-2">
            หากพบปัญหา กรุณาติดต่อแอดมิน
          </p>
        </form>
      </div>
    </div>
  )
}
