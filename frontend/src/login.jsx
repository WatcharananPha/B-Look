import React, { useState } from 'react';
import { AlertCircle, User, Key, Lock } from 'lucide-react'; // เพิ่ม Lock icon
import { GoogleLogin } from '@react-oauth/google';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const LOGO_URL = "/logo.jpg";

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/login/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });

      const data = await res.json();

      if (!res.ok) {
        // --- ดักจับ Case Pending (403) ---
        if (res.status === 403) {
            throw new Error("บัญชีของคุณอยู่ระหว่างรออนุมัติ กรุณาติดต่อ Admin");
        }
        throw new Error(data.detail || 'Google Login Failed');
      }

      localStorage.setItem('access_token', data.access_token || data.token);
      localStorage.setItem('user_role', data.role || 'user'); 
      onLogin(data.role || 'user');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${API_URL}/auth/login/access-token`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
          // --- ดักจับ Case Pending (403) ---
          if (response.status === 403) {
              throw new Error("บัญชีของคุณอยู่ระหว่างรออนุมัติ กรุณาติดต่อ Admin");
          }
          if (response.status === 401) {
              throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
          }
          throw new Error(data.detail || 'เข้าสู่ระบบไม่สำเร็จ');
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user_role', data.role || 'user'); // Default user role logic
        
      onLogin(data.role || 'user');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] font-sans text-slate-800 p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-24 h-24 mb-4 rounded-full shadow-lg overflow-hidden border-4 border-white bg-slate-50 flex items-center justify-center">
             <img src={LOGO_URL} alt="B-LOOK Logo" className="w-full h-full object-cover" onError={(e)=>{e.target.onerror=null; e.target.src="https://via.placeholder.com/150?text=B-LOOK"}}/>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">B-LOOK</h1>
          <p className="text-slate-500 mt-2 text-sm">ระบบจัดการออเดอร์และคำนวณราคา</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className={`text-sm p-3 rounded-lg flex items-center ${error.includes("รออนุมัติ") ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              {error.includes("รออนุมัติ") ? <Lock size={16} className="mr-2"/> : <AlertCircle size={16} className="mr-2"/>} 
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ชื่อผู้ใช้</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input type="text" className="w-full pl-10 border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 text-slate-400" size={20} />
              <input type="password" className="w-full pl-10 border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          
          <button type="submit" disabled={isLoading} className={`w-full bg-[#1a1c23] hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-md transition transform hover:scale-[1.02] flex justify-center items-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div className="relative mt-8 mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-400">หรือเข้าสู่ระบบด้วย</span>
          </div>
        </div>

        <div className="flex justify-center w-full">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                    console.error('Google Login Failed');
                    setError("Google Login ไม่สำเร็จ");
                }}
                theme="outline"
                size="large"
                 
                text="continue_with"
            />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;