import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Save, Calculator, AlertCircle, User, Box, FileText, 
  Truck, CreditCard, Tag, LogOut, Search, Plus, Edit, Trash2, 
  CheckCircle, Filter, Phone, MessageCircle, MapPin, XCircle,
  LayoutDashboard, Printer, Copy, Lock, Key, ChevronLeft, ChevronRight, Menu, X, ArrowLeft,
  Download, Settings, DollarSign, ChevronDown, Bell, ShoppingCart, MoreHorizontal
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// --- CONSTANTS (Configuration) ---
const BRANDS = ["BG (B.Look Garment)", "Jersey Express"];
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

// --- HELPER: API Fetch Wrapper ---
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.reload();
        return null;
    }
    if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API Error: ${response.statusText}`);
    }
    return response.status === 204 ? null : response.json();
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
};

// --- COMPONENTS ---

// 2.0 LOGIN PAGE
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Google Login Failed');
      }

      const data = await res.json();
      localStorage.setItem('access_token', data.access_token || data.token);
      localStorage.setItem('user_role', data.role || 'user'); 
      onLogin(data.role || 'user');
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google Login");
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

      if (!response.ok) throw new Error('Username หรือ Password ไม่ถูกต้อง');

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user_role', data.role || 'owner');
        
      onLogin(data.role || 'owner');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] font-sans text-slate-800 p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-[#1a1c23] text-white w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">INVENTORY360</h1>
          <p className="text-slate-500 mt-2 text-sm">ระบบจัดการออเดอร์และคำนวณราคา</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center">
              <AlertCircle size={16} className="mr-2"/> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input type="text" className="w-full pl-10 border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 text-slate-400" size={20} />
              <input type="password" className="w-full pl-10 border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          
          <button type="submit" disabled={isLoading} className={`w-full bg-[#1a1c23] hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-md transition transform hover:scale-[1.02] flex justify-center items-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {isLoading ? "Signing In..." : "เข้าสู่ระบบ"}
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
                width="100%" 
                text="continue_with"
            />
        </div>
      </div>
    </div>
  );
};

// 2.1 DASHBOARD (Redesigned UI, Logic Intact)
const DashboardPage = ({ onEdit }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const userRole = useMemo(() => localStorage.getItem('user_role') || 'owner', []);
    
    // Data States
    const [allOrders, setAllOrders] = useState([]);
    const [stats, setStats] = useState({ newOrders: 0, pendingDelivery: 0, revenue: 0, urgent: 0 });
    const [events, setEvents] = useState([]);
    const [alerts, setAlerts] = useState([]);

    // View State
    const [viewMode, setViewMode] = useState('calendar');
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orders = await fetchWithAuth('/orders/');
                setAllOrders(orders || []);
                
                const newOrders = orders?.length || 0; 
                const pendingDelivery = orders?.filter(o => o.status !== 'delivered').length || 0;
                const revenue = orders?.reduce((sum, o) => sum + (o.grand_total || 0), 0) || 0;
                const urgent = orders?.filter(o => {
                    if (!o.deadline) return false;
                    const diff = new Date(o.deadline) - new Date();
                    return diff > 0 && diff < 5 * 24 * 60 * 60 * 1000;
                }).length || 0;

                setStats({ newOrders, pendingDelivery, revenue, urgent });

                // Map Orders to Calendar Events
                const mappedEvents = (orders || []).map(o => {
                    if (!o.deadline) return null;
                    const d = new Date(o.deadline);
                    return {
                        id: o.id,
                        day: d.getDate(),
                        month: d.getMonth(),
                        year: d.getFullYear(),
                        title: `${o.customer_name}`,
                        type: 'delivery',
                        status: o.status || 'pending',
                        order_no: o.order_no
                    };
                }).filter(e => e !== null);

                const currentMonthEvents = mappedEvents.filter(e => 
                    e.month === currentDate.getMonth() && 
                    e.year === currentDate.getFullYear()
                );
                setEvents(currentMonthEvents);

                // Generate Alerts
                const urgencyAlerts = (orders || []).filter(o => o.status === 'urgent').map(o => ({
                    type: 'CRITICAL', title: `งานด่วน: ${o.order_no}`, desc: `ส่ง: ${o.customer_name}`
                }));
                setAlerts(urgencyAlerts);

            } catch (err) {
                console.error("Dashboard Fetch Error", err);
            }
        };
        fetchData();
    }, [currentDate]);

    // Calendar Helper Logic
    const eventsByDay = events.reduce((acc, evt) => {
        acc[evt.day] = [...(acc[evt.day] || []), evt];
        return acc;
    }, {});
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    // Visual Chart Component
    const SimpleLineChart = () => (
      <svg viewBox="0 0 500 100" className="w-full h-24 stroke-[#a3b18a] fill-none stroke-[3px]" style={{filter: 'drop-shadow(0px 4px 6px rgba(163,177,138,0.3))'}}>
        <path d="M0,80 Q50,70 100,60 T200,50 T300,30 T400,40 T500,10" />
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a3b18a" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#a3b18a" stopOpacity="0"/>
        </linearGradient>
        <path d="M0,80 Q50,70 100,60 T200,50 T300,30 T400,40 T500,10 V100 H0 Z" fill="url(#gradient)" stroke="none" />
      </svg>
    );

    return (
        <div className="p-6 md:p-10 fade-in h-full flex flex-col bg-[#f0f2f5] overflow-y-auto">
            {/* Header Section */}
            <header className="mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#1a1c23] tracking-tight leading-tight">
                        Hi, here's what's happening <br/> in your stores
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white border border-gray-200 rounded-lg p-1 flex shadow-sm">
                        <button className="px-4 py-1.5 text-sm font-semibold text-gray-800 bg-gray-100 rounded-md shadow-sm">Today</button>
                        <button className="px-4 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-md transition">This Week</button>
                        <button className="px-4 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-md transition">This Month</button>
                    </div>
                    <div className="relative">
                        <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center">
                            All Outlets <ChevronDown size={16} className="ml-2 text-gray-400"/>
                        </button>
                    </div>
                </div>
            </header>

            {/* Top Main Card (Revenue & Stats) */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row relative overflow-hidden">
                <div className="flex-1 z-10">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">This month your stores have sold</h3>
                    <div className="text-5xl font-black text-[#1a1c23] mb-2 tracking-tight">
                        ฿{stats.revenue.toLocaleString()}
                    </div>
                    <p className="text-gray-500 text-sm mb-8 font-medium">
                        Based on delivered orders in current period.
                    </p>
                    {/* Visual Chart Area */}
                    <div className="w-full h-32 relative">
                         <div className="absolute top-0 left-0 text-xs font-bold text-gray-400">All Outlets</div>
                         <div className="absolute bottom-0 right-0 text-xs font-bold text-gray-400">30 Apr</div>
                         <div className="mt-6">
                             <SimpleLineChart />
                         </div>
                    </div>
                </div>

                <div className="w-px bg-gray-100 mx-8 hidden lg:block"></div>

                <div className="lg:w-72 flex flex-col justify-center space-y-8 z-10 mt-6 lg:mt-0">
                    <div>
                        <div className="text-sm font-bold text-gray-800 mb-1">Total Orders</div>
                        <div className="text-3xl font-black text-[#1a1c23]">{stats.newOrders}</div>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-800 mb-1">Avg Items per Sale</div>
                        <div className="text-3xl font-black text-[#1a1c23]">
                            {stats.newOrders > 0 ? (stats.revenue / stats.newOrders / 100).toFixed(1) : '0'}
                        </div>
                    </div>
                    <div>
                         <div className="text-sm font-bold text-gray-800 mb-1">Avg Value</div>
                         <div className="text-3xl font-black text-[#1a1c23]">
                            ${stats.newOrders > 0 ? (stats.revenue / stats.newOrders).toFixed(0) : '0'}
                         </div>
                    </div>
                </div>
            </div>

            {/* Bottom Grid Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Calendar (Functionality) */}
                <div className="xl:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-[#1a1c23]">Production Schedule</h3>
                            <p className="text-xs text-gray-400">Monitor upcoming deadlines</p>
                        </div>
                        <div className="flex space-x-2">
                             <div className="flex space-x-1">
                                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={16}/></button>
                                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={16}/></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-800">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1 h-full">
                            {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] font-bold text-gray-400 mb-2">{d}</div>)}
                            {[...Array(firstDayOfMonth)].map((_, i) => <div key={`e-${i}`}></div>)}
                            {[...Array(daysInMonth)].map((_, i) => {
                                const day = i + 1;
                                const evts = eventsByDay[day] || [];
                                const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                                return (
                                    <div key={day} className={`min-h-[60px] border border-gray-100 rounded-lg p-1 relative hover:bg-gray-50 transition ${isToday ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                                        <span className={`text-[10px] font-bold ${isToday ? 'text-yellow-700' : 'text-gray-400'}`}>{day}</span>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            {evts.map((e, idx) => (
                                                <div key={idx} className={`h-1.5 rounded-full w-full ${e.status === 'urgent' ? 'bg-rose-500' : 'bg-[#a3b18a]'}`} title={e.title}></div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Alerts & Transfers */}
                <div className="space-y-6">
                    {/* Card 1: Urgent / Transfer */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 relative">
                        <div className="mb-4">
                             <h3 className="text-lg font-bold text-[#1a1c23] mb-1">Transfer</h3>
                             <p className="text-sm text-gray-500 font-medium">You have {stats.urgent} urgent orders waiting.</p>
                        </div>
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Box size={24} className="text-gray-400"/>
                            </div>
                            <div>
                                <div className="font-bold text-gray-800 text-sm">Urgent Batch</div>
                                <div className="text-xs text-gray-400">Production &rarr; Delivery</div>
                            </div>
                        </div>
                        <button className="text-[10px] font-bold tracking-wider text-gray-500 hover:text-gray-900 uppercase">VIEW TRANSFER</button>
                    </div>

                    {/* Card 2: Purchase Orders / Alerts */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                        <div className="mb-4">
                             <h3 className="text-lg font-bold text-[#1a1c23] mb-1">Alerts</h3>
                             <p className="text-sm text-gray-500 font-medium">System notifications ({alerts.length})</p>
                        </div>
                        <div className="space-y-3 mb-6">
                            {alerts.slice(0, 3).map((alert, i) => (
                                <div key={i} className="flex items-start space-x-3">
                                    <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0"/>
                                    <div>
                                        <p className="text-xs font-bold text-gray-800">{alert.title}</p>
                                        <p className="text-[10px] text-gray-400">{alert.desc}</p>
                                    </div>
                                </div>
                            ))}
                            {alerts.length === 0 && <p className="text-xs text-gray-400 italic">No active alerts.</p>}
                        </div>
                        <button className="text-[10px] font-bold tracking-wider text-gray-500 hover:text-gray-900 uppercase">VIEW ALL ALERTS</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: INVOICE PREVIEW MODAL ---
const InvoiceModal = ({ data, onClose }) => {
  const handlePrint = () => window.print();
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm overflow-y-auto pt-10 pb-10 print:p-0 print:bg-white print:fixed print:inset-0" onClick={onClose}>
      <style>{`@media print { body * { visibility: hidden; } #invoice-content, #invoice-content * { visibility: visible; } #invoice-content { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; box-shadow: none; border: none; } #no-print-btn { display: none !important; } }`}</style>
      <div id="no-print-btn" className="fixed top-4 right-4 z-[60] flex space-x-2 print:hidden">
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center transition font-medium border border-blue-500">
              <Printer size={18} className="mr-2"/> Print / Save PDF
          </button>
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full shadow-lg transition border border-slate-600" title="Close (Esc)">
              <XCircle size={24} />
          </button>
      </div>
      <div id="invoice-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 md:p-12 shadow-2xl relative text-slate-800 font-sans mx-auto rounded-sm mt-4 mb-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-6 mb-8">
            <div>
                <h1 className="text-5xl font-black text-slate-900 mb-2">B-LOOK</h1>
                <p className="text-slate-600 font-semibold">บริษัท บี-ลุค จำกัด</p>
                <p className="text-sm text-slate-500">123 ถนนตัวอย่าง กทม.</p>
            </div>
            <div className="text-right">
                <h2 className="text-3xl font-bold text-slate-800">ใบสั่งผลิต</h2>
                <p className="text-sm"><span className="font-semibold mr-2">วันที่:</span>{new Date().toLocaleDateString('th-TH')}</p>
                <p className="text-sm"><span className="font-semibold mr-2">เลขที่:</span>{data.order_no || "DRAFT"}</p>
            </div>
        </div>
        {/* Customer Info */}
        <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50 mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">ข้อมูลลูกค้า</h3>
            <p className="font-bold text-slate-800 text-lg">{data.customerName || "-"}</p>
            <p className="text-sm text-slate-500">{data.phoneNumber} | {data.contactChannel}</p>
            <p className="text-sm text-slate-500 mt-1">{data.address}</p>
        </div>
        {/* Table */}
        <table className="w-full text-sm mb-8">
            <thead>
                <tr className="bg-slate-900 text-white"><th className="py-3 px-4 text-left">รายการ</th><th className="py-3 px-4 text-right">จำนวน</th><th className="py-3 px-4 text-right">ราคา/หน่วย</th><th className="py-3 px-4 text-right">รวม</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td className="py-4 px-4">
                        <p className="font-bold">{data.brand}</p>
                        <p className="text-xs text-slate-500">ผ้า: {data.fabric} | คอ: {data.neck} | แขน: {data.sleeve}</p>
                    </td>
                    <td className="py-4 px-4 text-right">{data.totalQty}</td>
                    <td className="py-4 px-4 text-right">{data.basePrice.toLocaleString()}</td>
                    <td className="py-4 px-4 text-right">{(data.totalQty * data.basePrice).toLocaleString()}</td>
                </tr>
            </tbody>
        </table>
        {/* Totals */}
        <div className="flex justify-end">
            <div className="w-1/2 space-y-2 text-sm">
                <div className="flex justify-between"><span>รวมเป็นเงิน</span><span>{(data.totalQty * data.basePrice).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>ค่าขนส่ง/อื่นๆ</span><span>{(data.addOnCost + data.shippingCost).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>ส่วนลด</span><span>-{data.discount.toLocaleString()}</span></div>
                {/* เพิ่มบรรทัด VAT */}
                <div className="flex justify-between text-slate-500"><span>VAT ({data.isVatIncluded ? 'Included' : 'Excluded'} 7%)</span><span>{data.vatAmount.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>ยอดสุทธิ</span><span>{data.grandTotal.toLocaleString()}</span></div>
            </div>
        </div>
      </div>
    </div>
  );
};

// 2.2 ORDER CREATION PAGE (With Edit Support & Auto Pricing & Global Config)
const OrderCreationPage = ({ onNavigate, editingOrder }) => {
  const [role, setRole] = useState("owner"); 
  const [brand, setBrand] = useState(BRANDS[0]);
  const [deadline, setDeadline] = useState("");
  const [urgencyStatus, setUrgencyStatus] = useState("normal");
  const [customerName, setCustomerName] = useState("");
  const [contactChannel, setContactChannel] = useState("LINE OA");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [quantities, setQuantities] = useState(SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {}));
  const [basePrice, setBasePrice] = useState(150);
  const [addOnCost, setAddOnCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [isVatIncluded, setIsVatIncluded] = useState(false);
  const [deposit, setDeposit] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(80);
   
  // Master Data State
  const [fabrics, setFabrics] = useState([]);
  const [necks, setNecks] = useState([]);
  const [sleeves, setSleeves] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
  const [selectedNeck, setSelectedNeck] = useState("");
  const [selectedSleeve, setSelectedSleeve] = useState("");
  const [pricingRules, setPricingRules] = useState([]);
  
  // Global Config
  const [config, setConfig] = useState({ vat_rate: 0.07, default_shipping_cost: 0 });

  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-fill Data when editingOrder is present
  useEffect(() => {
    if (editingOrder) {
        setCustomerName(editingOrder.customer_name || "");
        setDeadline(editingOrder.deadline ? new Date(editingOrder.deadline).toISOString().split('T')[0] : "");
        setDeposit(editingOrder.deposit || 0);
    } else {
        setCustomerName("");
        setDeadline("");
        setDeposit(0);
        setQuantities(SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {}));
    }
  }, [editingOrder]);

  // Fetch Master Data, Pricing Rules & Global Config
  useEffect(() => {
      const fetchMasters = async () => {
          try {
              const [fData, nData, sData, pData, cData] = await Promise.all([
                  fetchWithAuth('/products/fabrics'),
                  fetchWithAuth('/products/necks'),
                  fetchWithAuth('/products/sleeves'),
                  fetchWithAuth('/pricing-rules/'),
                  fetchWithAuth('/company/config')
              ]);
              setFabrics(fData || []);
              setNecks(nData || []);
              setSleeves(sData || []);
              setPricingRules(pData || []);
              
              if (cData) {
                  setConfig({ 
                      vat_rate: cData.vat_rate || 0.07, 
                      default_shipping_cost: cData.default_shipping_cost || 0 
                  });
                  // Set initial shipping cost only for new orders
                  if (!editingOrder) setShippingCost(cData.default_shipping_cost || 0);
              }

              if (!editingOrder) { 
                  if (fData?.length) setSelectedFabric(fData[0].name);
                  if (nData?.length) setSelectedNeck(nData[0].name);
                  if (sData?.length) setSelectedSleeve(sData[0].name);
              }
          } catch (e) { console.error(e); }
      };
      fetchMasters();
  }, [editingOrder]);

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);

  // --- AUTOMATIC PRICING ENGINE LOGIC ---
  useEffect(() => {
      if (totalQty > 0 && selectedFabric && pricingRules.length > 0) {
          const matchedRule = pricingRules.find(rule => 
              rule.fabric_type === selectedFabric &&
              totalQty >= rule.min_qty &&
              totalQty <= rule.max_qty
          );
          if (matchedRule) setBasePrice(matchedRule.unit_price);
      }
  }, [totalQty, selectedFabric, pricingRules]);
  // -------------------------------------

  const productSubtotal = totalQty * basePrice;
  const totalBeforeCalc = productSubtotal + addOnCost + shippingCost - discount;
   
  let vatAmount = 0, grandTotal = 0;
  if (isVatIncluded) {
    grandTotal = totalBeforeCalc;
    // Formula: Total * (7 / 107) for Included VAT
    vatAmount = (totalBeforeCalc * (config.vat_rate * 100)) / (100 + (config.vat_rate * 100));
  } else {
    // Formula: Total * 0.07 for Excluded VAT
    vatAmount = totalBeforeCalc * config.vat_rate;
    grandTotal = totalBeforeCalc + vatAmount;
  }
  const balance = grandTotal - deposit;

  const generateOrderId = useCallback(() => {
    return editingOrder ? editingOrder.order_no : `PO-${Date.now().toString().slice(-6)}`;
  }, [editingOrder]);

  const handleSaveOrder = async () => {
    try {
        const orderData = {
            order_no: generateOrderId(),
            customer_name: customerName,
            contact_channel: contactChannel,
            total_amount: grandTotal,
            deposit: deposit,
            status: editingOrder ? editingOrder.status : "draft",
            deadline: deadline ? new Date(deadline).toISOString() : null,
            items: []
        };
        
        const url = editingOrder ? `/orders/${editingOrder.id}` : '/orders/';
        const method = editingOrder ? 'PUT' : 'POST';
        
        await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(orderData)
        });
        setShowSuccess(true);
    } catch (e) {
        alert("Failed to save order: " + e.message);
    }
  };

  const handleCopySummary = () => {
    const text = `📋 Order Summary\nCustomer: ${customerName}\nTotal: ${totalQty} pcs\nGrand Total: ${grandTotal.toLocaleString()} THB`;
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  useEffect(() => {
    if (!deadline) { setUrgencyStatus("normal"); return; }
    const diffDays = Math.ceil(Math.abs(new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)); 
    setUrgencyStatus(diffDays <= 5 ? "critical" : diffDays <= 10 ? "warning" : "normal");
  }, [deadline]);

  const theme = {
    critical: { border: "border-l-8 border-rose-500", header: "bg-rose-100 text-rose-800" },
    warning: { border: "border-l-8 border-amber-500", header: "bg-amber-100 text-amber-800" },
    normal: { border: "border-l-8 border-emerald-500", header: "bg-emerald-100 text-emerald-800" }
  };

  return (
    <div className="p-6 md:p-10 fade-in overflow-y-auto bg-[#f0f2f5] h-full">
        {showPreview && <InvoiceModal data={{customerName, phoneNumber, contactChannel, address, deadline, brand, quantities, totalQty, basePrice, addOnCost, shippingCost, discount, isVatIncluded, vatAmount, grandTotal, deposit, balance, fabric: selectedFabric, neck: selectedNeck, sleeve: selectedSleeve, order_no: generateOrderId()}} onClose={() => setShowPreview(false)} />}
        {showSuccess && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in px-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle size={48} className="text-emerald-500"/></div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">บันทึกสำเร็จ!</h3>
                    <button onClick={() => { setShowSuccess(false); onNavigate('order_list'); }} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl mt-4">กลับหน้ารายการ</button>
                </div>
            </div>
        )}

        <header className={`mb-8 flex items-center gap-4`}>
             <button onClick={() => onNavigate('order_list')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center border hover:bg-gray-50 shadow-sm"><ArrowLeft size={20}/></button>
             <h1 className="text-2xl font-black text-[#1a1c23]">{editingOrder ? "Edit Order" : "New Order"}</h1>
             <div className={`px-4 py-2 rounded-lg ml-auto ${theme[urgencyStatus].header}`}><AlertCircle size={20} className="inline mr-2"/>{urgencyStatus.toUpperCase()}</div>
        </header>

        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6 flex items-center text-gray-800"><User className="mr-2" size={18}/> Customer Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input type="text" className="border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" placeholder="ชื่อลูกค้า" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        <input type="text" className="border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" placeholder="เบอร์โทร" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                        <select className="border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" value={contactChannel} onChange={e => setContactChannel(e.target.value)}><option>LINE OA</option><option>Facebook</option><option>โทรศัพท์</option></select>
                        <input type="date" className="border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                        <textarea className="col-span-2 border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" placeholder="ที่อยู่" value={address} onChange={e => setAddress(e.target.value)}></textarea>
                    </div>
                </section>

                <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6 flex items-center text-gray-800"><Box className="mr-2" size={18}/> รายละเอียดสินค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                         <div>
                            <label className="block text-sm mb-1 text-gray-500">ชนิดผ้า</label>
                            <select className="w-full border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" value={selectedFabric} onChange={e => setSelectedFabric(e.target.value)}>
                                {fabrics.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-500">คอเสื้อ</label>
                            <select className="w-full border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" value={selectedNeck} onChange={e => setSelectedNeck(e.target.value)}>
                                {necks.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-500">แขนเสื้อ</label>
                            <select className="w-full border-gray-200 border p-3 rounded-xl bg-gray-50 focus:bg-white transition" value={selectedSleeve} onChange={e => setSelectedSleeve(e.target.value)}>
                                {sleeves.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-4">ระบุจำนวน (Size Matrix)</label>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                            {SIZES.map((size) => (
                                <div key={size} className="text-center">
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">{size}</label>
                                    <input type="number" min="0" className="w-full text-center border-gray-200 border rounded-lg p-2 focus:ring-2 focus:ring-[#1a1c23]" placeholder="0"
                                        onChange={(e) => setQuantities({...quantities, [size]: parseInt(e.target.value) || 0})} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 sticky top-6">
                    <h3 className="text-xl font-black text-[#1a1c23] mb-6 pb-4 border-b border-gray-100">สรุปยอด</h3>
                    <div className="space-y-4 mb-8 text-sm text-gray-600">
                        <div className="flex justify-between"><span>จำนวนรวม</span><span className="font-bold text-gray-800">{totalQty} ตัว</span></div>
                        <div className="flex justify-between items-center"><span>ราคาขาย/ตัว</span><input type="number" className="w-20 text-right border-gray-200 border rounded p-1 bg-gray-50" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))}/></div>
                        <div className="flex justify-between items-center"><span>ค่าบล็อก/Addon</span><input type="number" className="w-20 text-right border-gray-200 border rounded p-1 bg-gray-50" value={addOnCost} onChange={e => setAddOnCost(Number(e.target.value))}/></div>
                        <div className="flex justify-between items-center"><span>ค่าขนส่ง</span><input type="number" className="w-20 text-right border-gray-200 border rounded p-1 bg-gray-50" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))}/></div>
                        <div className="flex justify-between items-center text-red-500"><span>ส่วนลด</span><input type="number" className="w-20 text-right border-rose-200 border rounded p-1 bg-rose-50 text-rose-600" value={discount} onChange={e => setDiscount(Number(e.target.value))}/></div>
                        
                        {/* VAT CONFIGURATION SECTION */}
                        <div className="flex justify-between items-center py-2 border-t border-dashed">
                            <label className="flex items-center text-xs cursor-pointer">
                                <input type="checkbox" className="mr-2 rounded text-[#1a1c23]" checked={isVatIncluded} onChange={e => setIsVatIncluded(e.target.checked)}/>
                                ราคารวม VAT ({config.vat_rate*100}%) แล้ว
                            </label>
                            <span className="text-xs text-gray-400">VAT: {vatAmount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>

                        <div className="flex justify-between font-black text-2xl text-[#1a1c23] mt-4 pt-4 border-t border-gray-100"><span>ยอดสุทธิ</span><span>{grandTotal.toLocaleString()} ฿</span></div>
                    </div>
                    <button className="w-full bg-[#1a1c23] hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center transition" onClick={handleSaveOrder}>
                        <Save className="mr-2" size={18}/> {editingOrder ? "บันทึกการแก้ไข" : "บันทึกออเดอร์"}
                    </button>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button className="py-2 text-xs font-bold text-gray-500 border rounded-lg hover:bg-gray-50" onClick={() => setShowPreview(true)}>PREVIEW</button>
                        <button className="py-2 text-xs font-bold text-gray-500 border rounded-lg hover:bg-gray-50" onClick={handleCopySummary}>COPY</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

// 2.3 PRODUCT PAGE
const ProductPage = () => {
  const [activeTab, setActiveTab] = useState("fabric"); 
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" or "edit"
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", quantity: 0, cost_price: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchItems = useCallback(async () => {
      setLoading(true);
      try {
          const endpoint = activeTab === 'fabric' ? '/products/fabrics' : activeTab === 'neck' ? '/products/necks' : '/products/sleeves';
          const data = await fetchWithAuth(endpoint);
          setItems(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAddModal = () => {
      setModalMode("add");
      setNewItem({ name: "", quantity: 0, cost_price: 0 });
      setIsModalOpen(true);
  };

  const openEditModal = (item) => {
      setModalMode("edit");
      setEditingItem(item);
      setNewItem({ 
          name: item.name, 
          quantity: item.quantity || 0,
          cost_price: item.cost_price || 0 
      });
      setIsModalOpen(true);
  };

  const handleAdd = async () => {
      try {
          const endpoint = activeTab === 'fabric' ? '/products/fabrics' : activeTab === 'neck' ? '/products/necks' : '/products/sleeves';
          await fetchWithAuth(endpoint, {
              method: 'POST',
              body: JSON.stringify(newItem)
          });
          setIsModalOpen(false);
          setNewItem({ name: "", quantity: 0, cost_price: 0 });
          fetchItems();
      } catch (e) { alert("Failed to add: " + e.message); }
  };

  const handleEdit = async () => {
      try {
          const endpoint = activeTab === 'fabric' ? '/products/fabrics' : activeTab === 'neck' ? '/products/necks' : '/products/sleeves';
          await fetchWithAuth(`${endpoint}/${editingItem.id}`, {
              method: 'PUT',
              body: JSON.stringify(newItem)
          });
          setIsModalOpen(false);
          setEditingItem(null);
          setNewItem({ name: "", quantity: 0, cost_price: 0 });
          fetchItems();
      } catch (e) { alert("Failed to update: " + e.message); }
  };

  const handleDelete = async (itemId) => {
      try {
          const endpoint = activeTab === 'fabric' ? '/products/fabrics' : activeTab === 'neck' ? '/products/necks' : '/products/sleeves';
          await fetchWithAuth(`${endpoint}/${itemId}`, {
              method: 'DELETE'
          });
          setDeleteConfirm(null);
          fetchItems();
      } catch (e) { alert("Failed to delete: " + e.message); }
  };

  const handleSave = () => {
      if (modalMode === "add") {
          handleAdd();
      } else {
          handleEdit();
      }
  };

  const TabButton = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} className={`px-6 py-3 font-medium text-sm border-b-2 transition ${activeTab === id ? "border-[#1a1c23] text-[#1a1c23]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>{label}</button>
  );

  return (
    <div className="p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <h3 className="text-lg font-bold mb-4">
                      {modalMode === "add" ? "เพิ่มข้อมูล" : "แก้ไขข้อมูล"} ({activeTab})
                  </h3>
                  <div className="space-y-3">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อรายการ</label>
                          <input 
                              className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="เช่น ผ้าจูติ, คอวี, แขนสั้น" 
                              value={newItem.name} 
                              onChange={e=>setNewItem({...newItem, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">จำนวน (คงเหลือ)</label>
                          <input 
                              type="number" 
                              min="0"
                              className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="0" 
                              value={newItem.quantity} 
                              onChange={e=>setNewItem({...newItem, quantity: parseInt(e.target.value) || 0})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">ราคาต้นทุน (บาท)</label>
                          <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="0.00" 
                              value={newItem.cost_price} 
                              onChange={e=>setNewItem({...newItem, cost_price: parseFloat(e.target.value) || 0})}
                          />
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button 
                          onClick={() => {
                              setIsModalOpen(false);
                              setEditingItem(null);
                              setNewItem({ name: "", quantity: 0, cost_price: 0 });
                          }} 
                          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition"
                      >
                          ยกเลิก
                      </button>
                      <button 
                          onClick={handleSave} 
                          className="px-4 py-2 bg-[#1a1c23] text-white rounded hover:bg-slate-800 transition"
                      >
                          {modalMode === "add" ? "บันทึก" : "อัปเดต"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <div className="flex items-center mb-4">
                      <AlertCircle className="text-rose-500 mr-3" size={24} />
                      <h3 className="text-lg font-bold">ยืนยันการลบ</h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                      คุณต้องการลบ <span className="font-bold">"{deleteConfirm.name}"</span> ใช่หรือไม่?
                  </p>
                  <div className="flex justify-end gap-2">
                      <button 
                          onClick={() => setDeleteConfirm(null)} 
                          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                      >
                          ยกเลิก
                      </button>
                      <button 
                          onClick={() => handleDelete(deleteConfirm.id)} 
                          className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700"
                      >
                          ลบ
                      </button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-8 flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-black text-[#1a1c23]">Product Catalog</h1>
            <p className="text-gray-500 font-medium">Manage your fabrics and materials.</p>
        </div>
        <button onClick={openAddModal} className="bg-[#1a1c23] text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg">
            <Plus size={18} className="mr-2"/> New Item
        </button>
      </header>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-gray-100 overflow-x-auto">
            <TabButton id="fabric" label="ชนิดผ้า" />
            <TabButton id="neck" label="รูปแบบคอ" />
            <TabButton id="sleeve" label="รูปแบบแขน" />
        </div>
        <div className="p-2 md:p-6">
            {loading ? <p className="p-10 text-center text-gray-400">Loading...</p> : (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <th className="py-4 px-6">ชื่อรายการ</th>
                            <th className="py-4 px-6 text-center">จำนวน (คงเหลือ)</th>
                            <th className="py-4 px-6 text-right">ราคาต้นทุน</th>
                            <th className="py-4 px-6 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition group">
                                <td className="py-4 px-6 font-bold text-gray-700">{item.name}</td>
                                <td className="py-4 px-6 text-center">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                        (item.quantity || 0) > 50 ? 'bg-emerald-100 text-emerald-700' :
                                        (item.quantity || 0) > 20 ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {item.quantity || 0}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right text-gray-600 font-medium">
                                    {item.cost_price ? `฿${parseFloat(item.cost_price).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button 
                                            onClick={() => openEditModal(item)}
                                            className="text-gray-400 hover:text-[#1a1c23] transition"
                                            title="แก้ไข"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(item)}
                                            className="text-gray-400 hover:text-rose-500 transition"
                                            title="ลบ"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan="4" className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Box size={48} className="mb-3 opacity-50" />
                                        <p className="text-lg font-medium">ไม่พบข้อมูล</p>
                                        <p className="text-sm mt-1">เริ่มต้นด้วยการเพิ่มข้อมูลใหม่</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};

// 2.4 CUSTOMER PAGE (CRUD Logic Intact)
const CustomerPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [currentCustomer, setCurrentCustomer] = useState({ id: null, name: "", phone: "", contact_channel: "LINE OA", address: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchCustomers = async () => {
      setLoading(true);
      try {
          const data = await fetchWithAuth('/customers/');
          setCustomers(data || []);
      } catch (e) { console.warn("Fetch failed"); }
      finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openAddModal = () => {
      setModalMode("add");
      setCurrentCustomer({ id: null, name: "", phone: "", contact_channel: "LINE OA", address: "" });
      setIsModalOpen(true);
  };

  const openEditModal = (cust) => {
      setModalMode("edit");
      setCurrentCustomer({ 
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          contact_channel: cust.contact_channel || cust.channel || "LINE OA",
          address: cust.address
      });
      setIsModalOpen(true);
  };

  const handleSave = async () => {
      try {
          let url = '/customers/';
          let method = 'POST';
          if (modalMode === 'edit') {
              url += `${currentCustomer.id}`;
              method = 'PUT';
          }
          await fetchWithAuth(url, {
              method: method,
              body: JSON.stringify(currentCustomer)
          });
          setIsModalOpen(false);
          fetchCustomers();
      } catch (e) { alert("Error: " + e.message); }
  };

  const handleDelete = async (id) => {
      try {
          await fetchWithAuth(`/customers/${id}`, { method: 'DELETE' });
          setDeleteConfirm(null);
          fetchCustomers();
      } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div className="p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <h3 className="text-lg font-bold mb-4">{modalMode === 'add' ? 'เพิ่มลูกค้าใหม่' : 'แก้ไขข้อมูลลูกค้า'}</h3>
                  <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อลูกค้า</label>
                        <input className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="ชื่อลูกค้า" value={currentCustomer.name} onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                        <input className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เบอร์โทรศัพท์" value={currentCustomer.phone} onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ช่องทางติดต่อ</label>
                        <select className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={currentCustomer.contact_channel} onChange={e => setCurrentCustomer({...currentCustomer, contact_channel: e.target.value})}>
                            <option>LINE OA</option>
                            <option>Facebook</option>
                            <option>Phone</option>
                            <option>Walk-in</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่จัดส่ง</label>
                        <textarea className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="ที่อยู่จัดส่ง" rows="3" value={currentCustomer.address} onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})}></textarea>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition">ยกเลิก</button>
                      <button onClick={handleSave} className="px-4 py-2 bg-[#1a1c23] text-white rounded hover:bg-slate-800 transition">บันทึก</button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <div className="flex items-center mb-4">
                      <AlertCircle className="text-rose-500 mr-3" size={24} />
                      <h3 className="text-lg font-bold">ยืนยันการลบ</h3>
                  </div>
                  <p className="text-slate-600 mb-6">คุณต้องการลบลูกค้า <span className="font-bold">"{deleteConfirm.name}"</span> ใช่หรือไม่?</p>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition">ยกเลิก</button>
                      <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition">ลบ</button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-8 flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-black text-[#1a1c23]">Customers</h1>
            <p className="text-gray-500 font-medium">Manage customer profiles and details.</p>
        </div>
        <button onClick={openAddModal} className="bg-[#1a1c23] text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg"><Plus size={18} className="mr-2"/> New Customer</button>
      </header>
       
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="p-2 md:p-6">
            {loading ? <p className="text-center text-slate-500 py-10">Loading...</p> : (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <th className="py-4 px-6">ชื่อลูกค้า</th>
                            <th className="py-4 px-6">ช่องทาง</th>
                            <th className="py-4 px-6">เบอร์โทร</th>
                            <th className="py-4 px-6 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {customers.map((cust) => (
                            <tr key={cust.id} className="hover:bg-gray-50 transition group">
                                <td className="py-4 px-6 font-bold text-gray-700">{cust.name}</td>
                                <td className="py-4 px-6 text-sm text-gray-600">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs border border-gray-200">
                                        {cust.contact_channel || cust.channel}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-600 font-mono">{cust.phone}</td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => openEditModal(cust)} className="text-gray-400 hover:text-[#1a1c23] transition" title="แก้ไข"><Edit size={16}/></button>
                                        <button onClick={() => setDeleteConfirm(cust)} className="text-gray-400 hover:text-rose-500 transition" title="ลบ"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {customers.length === 0 && (
                            <tr>
                                <td colSpan="4" className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <User size={48} className="mb-3 opacity-50" />
                                        <p className="text-lg font-medium">ไม่พบข้อมูลลูกค้า</p>
                                        <p className="text-sm mt-1">เริ่มต้นด้วยการเพิ่มลูกค้าใหม่</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};

// 2.5 ORDER LIST PAGE (UPDATED UI, Logic Intact)
const OrderListPage = ({ onNavigate, onEdit, filterType = 'all' }) => {
  const [orders, setOrders] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); 
   
  const fetchOrders = useCallback(async () => {
      setLoading(true);
      try {
          const data = await fetchWithAuth('/orders/');
          setOrders(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  }, []);

  useEffect(() => {
      fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id) => {
      try {
          await fetchWithAuth(`/orders/${id}`, { method: 'DELETE' });
          setDeleteConfirm(null);
          fetchOrders();
      } catch (e) { alert("Error: " + e.message); }
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || 'draft';
    if(s === 'production') return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase">ผลิต</span>;
    if(s === 'urgent') return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[10px] font-bold uppercase">ด่วน</span>;
    if(s === 'delivered') return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase">ส่งแล้ว</span>;
    return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase">Draft</span>;
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let data = orders;
    switch (filterType) {
        case 'pending':
            data = data.filter(o => o.status !== 'delivered');
            break;
        case 'revenue':
            data = data.filter(o => o.status === 'delivered');
            break;
        case 'urgent':
            data = data.filter(o => {
                if (!o.deadline) return false;
                const diff = new Date(o.deadline) - new Date();
                return diff > 0 && diff < 5 * 24 * 60 * 60 * 1000;
            });
            break;
        default: break;
    }

    if (searchTerm.trim() !== "") {
        const lowerTerm = searchTerm.toLowerCase();
        data = data.filter(o => 
            (o.order_no || "").toLowerCase().includes(lowerTerm) ||
            (o.customer_name || "").toLowerCase().includes(lowerTerm) ||
            (o.contact_channel || "").toLowerCase().includes(lowerTerm) ||
            (o.phone || "").includes(lowerTerm)
        );
    }
    return data;
  }, [orders, filterType, searchTerm]);

  const handleExportCSV = () => {
      if (filteredOrders.length === 0) { alert("ไม่มีข้อมูลสำหรับ Export"); return; }
      const headers = ["Order No", "Customer", "Contact", "Phone", "Deadline", "Total Amount", "Deposit", "Status"];
      const rows = filteredOrders.map(order => [
          `"${order.order_no}"`,
          `"${order.customer_name || ''}"`,
          `"${order.contact_channel || ''}"`,
          `"${order.phone || ''}"`,
          `"${order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH') : ''}"`,
          `"${order.grand_total || 0}"`,
          `"${order.deposit || 0}"`,
          `"${order.status || 'draft'}"`
      ]);
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <div className="flex items-center mb-4">
                      <AlertCircle className="text-rose-500 mr-3" size={24} />
                      <h3 className="text-lg font-bold">ยืนยันการลบออเดอร์</h3>
                  </div>
                  <p className="text-slate-600 mb-6">คุณต้องการลบออเดอร์ <span className="font-bold">"{deleteConfirm.order_no}"</span> ใช่หรือไม่?</p>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition">ยกเลิก</button>
                      <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition">ลบ</button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className="text-3xl font-black text-[#1a1c23]">Orders</h1>
            <p className="text-gray-500 font-medium">Manage and track your production.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c23]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex gap-2">
                <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center hover:bg-emerald-700 transition shadow-lg whitespace-nowrap">
                    <Download size={18} className="mr-2"/> Export
                </button>
                <button onClick={() => onNavigate('create_order')} className="bg-[#1a1c23] text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg whitespace-nowrap">
                    <Plus size={18} className="mr-2"/> New Order
                </button>
            </div>
        </div>
      </header>
       
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="p-0 md:p-2 overflow-x-auto">
            {loading ? <p className="text-center text-slate-500 py-10">Loading...</p> : (
                <table className="w-full text-left min-w-[800px]">
                    <thead>
                        <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <th className="py-4 px-6 w-1/6">เลขที่</th>
                            <th className="py-4 px-6 w-1/6">ลูกค้า</th>
                            <th className="py-4 px-6 w-1/6">กำหนดส่ง</th>
                            <th className="py-4 px-6 w-1/6 text-right">ยอดรวม</th>
                            <th className="py-4 px-6 w-1/6 text-center">สถานะ</th>
                            <th className="py-4 px-6 w-1/6 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50 transition group">
                                <td className="py-4 px-6 font-mono font-bold text-gray-700">{order.order_no}</td>
                                <td className="py-4 px-6 text-gray-700">
                                    <div className="font-medium">{order.customer_name}</div>
                                    <div className="text-xs text-gray-400">{order.contact_channel}</div>
                                </td>
                                <td className="py-4 px-6 text-gray-500 text-sm">
                                    {order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH') : '-'}
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-gray-700">{order.grand_total?.toLocaleString()}</td>
                                <td className="py-4 px-6 text-center">{getStatusBadge(order.status)}</td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button className="text-gray-400 hover:text-[#1a1c23] transition" title="แก้ไข" onClick={() => onEdit(order)}>
                                            <Edit size={16}/>
                                        </button>
                                        <button className="text-gray-400 hover:text-rose-500 transition" title="ลบ" onClick={() => setDeleteConfirm(order)}>
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredOrders.length === 0 && (
                            <tr>
                                <td colSpan="6" className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <FileText size={48} className="mb-3 opacity-50" />
                                        <p className="text-lg font-medium">ไม่พบรายการ</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};


// 2.6 SETTINGS PAGE
const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("pricing");
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Pricing Rule State
  const [newRule, setNewRule] = useState({ min_qty: 0, max_qty: 0, fabric_type: "", unit_price: 0 });
  const [fabrics, setFabrics] = useState([]); 

  // Global Config State
  const [globalConfig, setGlobalConfig] = useState({ vat_rate: 7, default_shipping_cost: 0 });

  const fetchRulesAndMasters = async () => {
    setLoading(true);
    try {
        const [pData, fData] = await Promise.all([
            fetchWithAuth('/pricing-rules/'),
            fetchWithAuth('/products/fabrics')
        ]);
        setPricingRules(pData || []);
        setFabrics(fData || []);
        
        if (fData && fData.length > 0) {
            setNewRule(prev => ({ ...prev, fabric_type: fData[0].name }));
        }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchGlobalConfig = async () => {
      try {
          const data = await fetchWithAuth('/company/config');
          if(data) {
              setGlobalConfig({
                  vat_rate: (data.vat_rate || 0) * 100, 
                  default_shipping_cost: data.default_shipping_cost || 0
              });
          }
      } catch(e) { console.error(e); }
  }

  useEffect(() => {
    if (activeTab === 'pricing') fetchRulesAndMasters();
    if (activeTab === 'general') fetchGlobalConfig();
  }, [activeTab]);

  const handleAddRule = async () => {
    try {
        await fetchWithAuth('/pricing-rules/', {
            method: 'POST',
            body: JSON.stringify(newRule)
        });
        setNewRule(prev => ({ ...prev, min_qty: 0, max_qty: 0, unit_price: 0 })); 
        // Re-fetch
        const rules = await fetchWithAuth('/pricing-rules/');
        setPricingRules(rules || []);
    } catch (e) { alert("Failed to add rule: " + e.message); }
  };

  const handleDeleteRule = async (id) => {
    if(!confirm("ยืนยันการลบ?")) return;
    try {
        await fetchWithAuth(`/pricing-rules/${id}`, { method: 'DELETE' });
        const rules = await fetchWithAuth('/pricing-rules/');
        setPricingRules(rules || []);
    } catch (e) { alert("Failed"); }
  };

  const handleSaveConfig = async () => {
      try {
          await fetchWithAuth('/company/config', {
              method: 'PUT',
              body: JSON.stringify({
                  vat_rate: globalConfig.vat_rate / 100,
                  default_shipping_cost: globalConfig.default_shipping_cost
              })
          });
          alert("บันทึกการตั้งค่าเรียบร้อยแล้ว");
      } catch(e) { alert("Error saving config: " + e.message); }
  }

  return (
    <div className="p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-[#1a1c23]">System Setup</h1>
        <p className="text-gray-500 font-medium">Configure pricing and global variables.</p>
      </header>

      <div className="flex gap-6 mb-6 border-b border-gray-200">
          <button onClick={() => setActiveTab("pricing")} className={`pb-3 font-bold text-sm border-b-2 transition ${activeTab==="pricing" ? "border-[#1a1c23] text-[#1a1c23]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
             Pricing Tiers
          </button>
          <button onClick={() => setActiveTab("general")} className={`pb-3 font-bold text-sm border-b-2 transition ${activeTab==="general" ? "border-[#1a1c23] text-[#1a1c23]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
             VAT & Shipping
          </button>
      </div>

      {activeTab === "pricing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form เพิ่มกฎ */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
                  <h3 className="font-bold text-lg mb-4 text-[#1a1c23]">Add Price Rule</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">ชนิดผ้า</label>
                          <select 
                            className="w-full border p-2 rounded-lg"
                            value={newRule.fabric_type}
                            onChange={e => setNewRule({...newRule, fabric_type: e.target.value})}
                          >
                              {fabrics.length > 0 ? (
                                  fabrics.map(f => <option key={f.id} value={f.name}>{f.name}</option>)
                              ) : (
                                  <option value="">กำลังโหลด...</option>
                              )}
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="block text-sm font-medium mb-1">ขั้นต่ำ (ตัว)</label>
                              <input type="number" className="w-full border p-2 rounded-lg" value={newRule.min_qty} onChange={e => setNewRule({...newRule, min_qty: parseInt(e.target.value)||0})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium mb-1">ถึง (ตัว)</label>
                              <input type="number" className="w-full border p-2 rounded-lg" value={newRule.max_qty} onChange={e => setNewRule({...newRule, max_qty: parseInt(e.target.value)||0})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">ราคาต่อหน่วย (บาท)</label>
                          <input type="number" className="w-full border p-2 rounded-lg bg-gray-50 text-[#1a1c23] font-bold" value={newRule.unit_price} onChange={e => setNewRule({...newRule, unit_price: parseFloat(e.target.value)||0})} />
                      </div>
                      <button onClick={handleAddRule} className="w-full bg-[#1a1c23] text-white py-3 rounded-xl hover:bg-slate-800 font-bold shadow-lg">Save Rule</button>
                  </div>
              </div>

              {/* Table รายการกฎ */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 font-bold text-[#1a1c23]">Current Pricing Tiers</div>
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100 uppercase font-bold text-xs">
                          <tr>
                              <th className="p-4 pl-6">Fabric</th>
                              <th className="p-4">Qty Range</th>
                              <th className="p-4 text-right">Unit Price</th>
                              <th className="p-4 text-right pr-6">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {pricingRules.length === 0 ? (
                              <tr><td colSpan="4" className="p-8 text-center text-slate-400">ยังไม่มีการตั้งราคา</td></tr>
                          ) : pricingRules.map((rule) => (
                              <tr key={rule.id} className="hover:bg-gray-50">
                                  <td className="p-4 pl-6 font-bold text-gray-700">{rule.fabric_type}</td>
                                  <td className="p-4">
                                      <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono font-bold text-gray-600">
                                          {rule.min_qty} - {rule.max_qty > 9999 ? 'MAX' : rule.max_qty}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right font-bold text-[#1a1c23]">{rule.unit_price} ฿</td>
                                  <td className="p-4 text-right pr-6">
                                      <button onClick={() => handleDeleteRule(rule.id)} className="text-gray-400 hover:text-rose-500 transition"><Trash2 size={16}/></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === "general" && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-lg mx-auto mt-10">
              <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calculator size={32} className="text-gray-400"/>
                  </div>
                  <h3 className="text-xl font-bold text-[#1a1c23]">Global Configuration</h3>
                  <p className="text-gray-500 text-sm">Set system-wide defaults.</p>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">VAT Rate (%)</label>
                      <div className="relative">
                          <input 
                              type="number" 
                              className="w-full border border-gray-200 p-3 rounded-xl pl-10" 
                              placeholder="7" 
                              value={globalConfig.vat_rate}
                              onChange={e => setGlobalConfig({...globalConfig, vat_rate: parseFloat(e.target.value)})}
                          />
                          <span className="absolute left-3 top-3 text-slate-400">%</span>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Default Shipping Cost</label>
                      <div className="relative">
                          <input 
                              type="number" 
                              className="w-full border border-gray-200 p-3 rounded-xl pl-10" 
                              placeholder="0" 
                              value={globalConfig.default_shipping_cost}
                              onChange={e => setGlobalConfig({...globalConfig, default_shipping_cost: parseFloat(e.target.value)})}
                          />
                          <DollarSign className="absolute left-3 top-3 text-slate-400" size={18} />
                      </div>
                  </div>

                  <button 
                      onClick={handleSaveConfig}
                      className="w-full bg-[#1a1c23] text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition mt-4 shadow-lg"
                  >
                      Save Configuration
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

// --- 3. MAIN APP (Revised Sidebar to Match Image) ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

  const handleEditOrder = (order) => {
      setEditingOrder(order);
      setCurrentPage('create_order');
  };

  const handleNavigate = (page) => {
      setCurrentPage(page);
      if (page !== 'create_order') {
          setEditingOrder(null);
      }
      setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch(currentPage) {
        case 'dashboard': return <DashboardPage onEdit={handleEditOrder} />;
        case 'order_list': return <OrderListPage onNavigate={handleNavigate} onEdit={handleEditOrder} />;
        case 'settings': return <SettingsPage />;
        case 'create_order': return <OrderCreationPage onNavigate={handleNavigate} editingOrder={editingOrder} />;
        case 'product': return <ProductPage />;
        case 'customer': return <CustomerPage />;
        default: return <OrderListPage onNavigate={handleNavigate} onEdit={handleEditOrder} />;
    }
  };

  const NavItem = ({ id, icon: Icon, label, active }) => (
      <button 
        onClick={() => handleNavigate(id)} 
        className={`w-full flex items-center space-x-4 p-3 rounded-xl transition duration-200 group relative ${active ? 'text-white' : 'text-gray-500 hover:text-white'}`}
      >
          {active && <div className="absolute left-0 w-1 h-8 bg-[#d4e157] rounded-r-full shadow-[0_0_10px_rgba(212,225,87,0.5)]"></div>}
          <Icon size={20} className={`transition ${active ? 'text-[#d4e157]' : 'text-gray-500 group-hover:text-white'}`}/>
          <span className="font-medium text-sm tracking-wide">{label}</span>
      </button>
  );

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-slate-800 flex flex-col md:flex-row relative">
       {/* Mobile Header */}
       <div className="md:hidden bg-[#1a1c23] text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-lg">
           <span className="font-bold text-lg tracking-tight">INVENTORY360</span>
           <button onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
       </div>
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

       {/* Sidebar (Dark Theme) */}
       <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#1a1c23] text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl border-r border-gray-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-black text-xl tracking-tight text-white">INVENTORY360</span>
                </div>
                <button className="md:hidden text-gray-500 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
                <MoreHorizontal className="hidden md:block text-gray-500 cursor-pointer hover:text-white transition" size={20}/>
            </div>
            
            <nav className="flex-1 px-4 space-y-2 mt-4">
                <NavItem id="dashboard" icon={LayoutDashboard} label="Home" active={currentPage === 'dashboard'} />
                <NavItem id="create_order" icon={DollarSign} label="Sell" active={currentPage === 'create_order'} />
                <NavItem id="order_list" icon={FileText} label="Reporting" active={currentPage === 'order_list'} />
                <NavItem id="product" icon={ShoppingCart} label="Catalog" active={currentPage === 'product'} />
                <NavItem id="product_inventory" icon={Box} label="Inventory" active={false} />
                <NavItem id="customer" icon={User} label="Customers" active={currentPage === 'customer'} />
                <NavItem id="settings" icon={Settings} label="Setup" active={currentPage === 'settings'} />
            </nav>

            {/* Profile Section */}
            <div className="p-6 border-t border-gray-800">
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => { localStorage.removeItem('access_token'); setIsLoggedIn(false); }}>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#d4e157] rounded-full flex items-center justify-center text-[#1a1c23] font-bold text-sm shadow-md group-hover:scale-105 transition">
                            S
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white group-hover:text-[#d4e157] transition">Sasha Merkel</div>
                            <div className="text-[10px] text-gray-500">Sign Out</div>
                        </div>
                    </div>
                    <ChevronDown size={16} className="text-gray-500"/>
                </div>
            </div>
      </aside>

      <main className="flex-1 overflow-auto h-[calc(100vh-60px)] md:h-screen w-full relative">{renderContent()}</main>
    </div>
  );
};

export default App;