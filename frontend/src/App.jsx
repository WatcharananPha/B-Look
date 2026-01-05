import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Save, Calculator, AlertCircle, User, Box, FileText, 
  Truck, CreditCard, Tag, LogOut, Search, Plus, Edit, Trash2, 
  CheckCircle, Filter, Phone, MessageCircle, MapPin, XCircle,
  LayoutDashboard, Printer, Copy, Lock, Key, ChevronLeft, ChevronRight, Menu, X, ArrowLeft,
  Download, Settings, DollarSign
} from 'lucide-react';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${API_URL}/auth/token`, {
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 font-sans text-slate-800 p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-slate-900 text-white w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">B-LOOK</h1>
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
              <input type="text" className="w-full pl-10 border border-slate-300 rounded-lg p-3 outline-none"
                placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 text-slate-400" size={20} />
              <input type="password" className="w-full pl-10 border border-slate-300 rounded-lg p-3 outline-none"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg shadow-lg mt-2 flex justify-center items-center ${isLoading ? 'opacity-70' : ''}`}>
            {isLoading ? "Signing In..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
};

// 2.1 DASHBOARD
const DashboardPage = ({ onEdit }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const userRole = useMemo(() => localStorage.getItem('user_role') || 'owner', []);
    
    // Data States
    const [allOrders, setAllOrders] = useState([]);
    const [stats, setStats] = useState({ newOrders: 0, pendingDelivery: 0, revenue: 0, urgent: 0 });
    const [events, setEvents] = useState([]);
    const [alerts, setAlerts] = useState([]);

    // View State: 'calendar' or 'list'
    const [viewMode, setViewMode] = useState('calendar');
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orders = await fetchWithAuth('/orders/');
                setAllOrders(orders || []); // เก็บข้อมูลทั้งหมดไว้สำหรับ List View
                
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
                        title: `ส่ง: ${o.customer_name || 'ลูกค้า'}`,
                        type: 'delivery',
                        status: o.status || 'pending',
                        order_no: o.order_no
                    };
                }).filter(e => e !== null);

                // Filter for current view
                const currentMonthEvents = mappedEvents.filter(e => 
                    e.month === currentDate.getMonth() && 
                    e.year === currentDate.getFullYear()
                );

                setEvents(currentMonthEvents);

                // Generate Alerts
                const urgencyAlerts = (orders || []).filter(o => o.status === 'urgent').map(o => ({
                    type: 'CRITICAL', title: `งานด่วน: ${o.order_no}`, desc: 'กำหนดส่งใกล้ถึงแล้ว'
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
    const getTypeStyle = (type, status) => {
        if (status === 'urgent') return "bg-rose-600 text-white border-rose-700 shadow-sm animate-pulse";
        switch (type) {
            case 'production': return "bg-blue-50 text-blue-700 border-blue-200 border";
            case 'delivery': return "bg-emerald-50 text-emerald-700 border-emerald-200 border";
            default: return "bg-slate-50 text-slate-600 border-slate-200";
        }
    };

    // Filter Logic for List Mode
    const getFilteredOrders = () => {
        if (!allOrders) return [];
        switch(filterType) {
            case 'pending': return allOrders.filter(o => o.status !== 'delivered');
            case 'revenue': return allOrders.filter(o => o.status === 'delivered');
            case 'urgent': return allOrders.filter(o => {
                if (!o.deadline) return false;
                const diff = new Date(o.deadline) - new Date();
                return diff > 0 && diff < 5 * 24 * 60 * 60 * 1000;
            });
            case 'all': default: return allOrders;
        }
    };
    const filteredOrders = getFilteredOrders();

    const handleCardClick = (type) => {
        setFilterType(type);
        setViewMode('list');
    };

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || 'draft';
        if(s === 'production') return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">ผลิต</span>;
        if(s === 'urgent') return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs">ด่วน</span>;
        if(s === 'delivered') return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">ส่งแล้ว</span>;
        return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">Draft</span>;
    };

    return (
        <div className="p-4 md:p-8 fade-in h-full flex flex-col bg-slate-50/50 overflow-y-auto pb-20 md:pb-8">
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                        <LayoutDashboard className="mr-2 text-blue-600" /> Production Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">ข้อมูล Realtime จากระบบ</p>
                </div>
                <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border shadow-sm">
                    <span className="text-xs text-slate-400 pl-2">Role:</span>
                    <span className="px-3 py-1 text-xs rounded bg-slate-100 text-slate-700 font-bold uppercase">{userRole}</span>
                </div>
            </header>

            {/* STATS CARDS (Clickable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div 
                    onClick={() => handleCardClick('all')}
                    className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition hover:scale-[1.02] ${filterType==='all' && viewMode==='list' ? 'ring-2 ring-blue-500' : ''}`}
                >
                    <div className="text-slate-500 text-xs font-bold uppercase">All Orders</div>
                    <div className="text-3xl font-black text-slate-800 mt-2">{stats.newOrders}</div>
                </div>
                <div 
                    onClick={() => handleCardClick('pending')}
                    className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition hover:scale-[1.02] ${filterType==='pending' && viewMode==='list' ? 'ring-2 ring-blue-500' : ''}`}
                >
                    <div className="text-slate-500 text-xs font-bold uppercase">Pending</div>
                    <div className="text-3xl font-black text-blue-600 mt-2">{stats.pendingDelivery}</div>
                </div>
                {userRole === 'owner' && (
                    <div 
                        onClick={() => handleCardClick('revenue')}
                        className={`bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl shadow-md text-white relative overflow-hidden cursor-pointer hover:shadow-lg transition hover:scale-[1.02] ${filterType==='revenue' && viewMode==='list' ? 'ring-4 ring-emerald-200' : ''}`}
                    >
                        <div className="text-emerald-100 text-xs font-bold uppercase">Revenue</div>
                        <div className="text-3xl font-black mt-2">฿{stats.revenue.toLocaleString()}</div>
                    </div>
                )}
                <div 
                    onClick={() => handleCardClick('urgent')}
                    className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition hover:scale-[1.02] ${filterType==='urgent' && viewMode==='list' ? 'ring-2 ring-rose-500' : ''}`}
                >
                    <div className="text-rose-500 text-xs font-bold uppercase">Urgent</div>
                    <div className="text-3xl font-black text-rose-600 mt-2">{stats.urgent}</div>
                </div>
            </div>

            {/* CONDITIONAL CONTENT: CALENDAR or LIST */}
            {viewMode === 'list' ? (
                // --- LIST VIEW ---
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden fade-in min-h-[500px]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-slate-700 flex items-center">
                                <FileText size={18} className="mr-2 text-blue-600"/> 
                                รายการออเดอร์: <span className="ml-1 uppercase text-blue-600">{filterType}</span>
                             </h3>
                             <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{filteredOrders.length}</span>
                        </div>
                        <button 
                            onClick={() => setViewMode('calendar')} 
                            className="bg-white border hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center shadow-sm transition"
                        >
                            <XCircle size={16} className="mr-1.5"/> ปิด
                        </button>
                    </div>
                    <div className="overflow-auto p-0 flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr className="text-sm text-slate-500">
                                    <th className="py-3 px-4 w-1/6 font-semibold">เลขที่</th>
                                    <th className="py-3 px-4 w-1/6 font-semibold">ลูกค้า</th>
                                    <th className="py-3 px-4 w-1/6 font-semibold">กำหนดส่ง</th>
                                    <th className="py-3 px-4 w-1/6 text-right font-semibold">ยอดรวม</th>
                                    <th className="py-3 px-4 w-1/6 text-center font-semibold">สถานะ</th>
                                    <th className="py-3 px-4 w-1/6 text-right font-semibold">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-blue-50/50 transition">
                                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-sm">{order.order_no}</td>
                                        <td className="py-3 px-4 text-slate-700 text-sm">{order.customer_name}</td>
                                        <td className="py-3 px-4 text-slate-500 text-sm">
                                            {order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH') : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-sm">{order.grand_total?.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-center">{getStatusBadge(order.status)}</td>
                                        <td className="py-3 px-4 text-right">
                                            <button 
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-1.5 rounded transition" 
                                                title="ดู/แก้ไข"
                                                onClick={() => onEdit && onEdit(order)}
                                            >
                                                <Edit size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-slate-400">
                                            ไม่พบข้อมูลในหมวดหมู่นี้
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // --- CALENDAR VIEW ---
                <div className="flex flex-col lg:flex-row gap-6 flex-1 h-full min-h-[500px] fade-in">
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-700">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                            <div className="flex space-x-1">
                                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button>
                                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-100 gap-px border-b rounded-b-xl overflow-hidden min-h-[300px]">
                            {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} className="bg-white border-r border-slate-50"></div>)}
                            {[...Array(daysInMonth)].map((_, i) => {
                                const day = i + 1;
                                const evts = eventsByDay[day] || [];
                                const today = new Date();
                                const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

                                return (
                                    <div key={day} className={`bg-white p-1 min-h-[80px] hover:bg-blue-50/30 transition relative group border-t border-r border-slate-100 ${isToday ? 'bg-blue-50/10' : ''}`}>
                                        <div className="flex justify-between items-start">
                                            <span className={`text-xs font-semibold p-1 ${
                                                isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md' : evts.length > 0 ? 'text-blue-600 bg-blue-50 rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-400'
                                            }`}>{day}</span>
                                        </div>
                                        <div className="mt-1 space-y-1 px-1">
                                            {evts.map((evt, idx) => (
                                                <div key={idx} className={`text-[9px] px-1.5 py-1 rounded truncate font-medium cursor-pointer hover:opacity-80 ${getTypeStyle(evt.type, evt.status)}`} title={evt.title}>
                                                    {evt.title}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="w-full lg:w-80 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center">
                                <AlertCircle size={18} className="mr-2 text-rose-500" /> Alerts
                            </h3>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            {alerts.length === 0 ? <p className="text-sm text-slate-400 text-center mt-10">No active alerts</p> : alerts.map((alert, idx) => (
                                <div key={idx} className="bg-rose-50 border border-rose-100 p-3 rounded-lg shadow-sm">
                                    <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">{alert.type}</span>
                                    <p className="text-sm font-bold text-slate-800 mt-1">{alert.title}</p>
                                    <p className="text-xs text-slate-600">{alert.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
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
    <div className="p-4 md:p-8 fade-in overflow-y-auto pb-20 md:pb-8">
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

        <header className={`mb-8 p-6 rounded-lg shadow-sm bg-white ${theme[urgencyStatus].border} flex flex-col md:flex-row justify-between items-start gap-4`}>
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => onNavigate('order_list')} className="p-1 hover:bg-slate-100 rounded-full"><ArrowLeft size={24}/></button>
                    <h1 className="text-2xl font-bold text-slate-800">{editingOrder ? `แก้ไขออเดอร์: ${editingOrder.order_no}` : "สร้างใบออเดอร์ใหม่"}</h1>
                </div>
            </div>
            <div className={`px-4 py-2 rounded-lg ${theme[urgencyStatus].header}`}><AlertCircle size={20} className="inline mr-2"/>{urgencyStatus.toUpperCase()}</div>
        </header>

        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-700"><User className="mr-2" size={18}/> ข้อมูลลูกค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" className="border p-2.5 rounded-lg" placeholder="ชื่อลูกค้า" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        <input type="text" className="border p-2.5 rounded-lg" placeholder="เบอร์โทร" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                        <select className="border p-2.5 rounded-lg" value={contactChannel} onChange={e => setContactChannel(e.target.value)}><option>LINE OA</option><option>Facebook</option><option>โทรศัพท์</option></select>
                        <input type="date" className="border p-2.5 rounded-lg" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                        <textarea className="col-span-2 border p-2.5 rounded-lg" placeholder="ที่อยู่" value={address} onChange={e => setAddress(e.target.value)}></textarea>
                    </div>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-700"><Box className="mr-2" size={18}/> รายละเอียดสินค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                         <div>
                            <label className="block text-sm mb-1">ชนิดผ้า</label>
                            <select className="w-full border p-2.5 rounded-lg" value={selectedFabric} onChange={e => setSelectedFabric(e.target.value)}>
                                {fabrics.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm mb-1">คอเสื้อ</label>
                            <select className="w-full border p-2.5 rounded-lg" value={selectedNeck} onChange={e => setSelectedNeck(e.target.value)}>
                                {necks.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm mb-1">แขนเสื้อ</label>
                            <select className="w-full border p-2.5 rounded-lg" value={selectedSleeve} onChange={e => setSelectedSleeve(e.target.value)}>
                                {sleeves.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3">ระบุจำนวน (Size Matrix)</label>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                            {SIZES.map((size) => (
                                <div key={size} className="text-center">
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">{size}</label>
                                    <input type="number" min="0" className="w-full text-center border rounded-md p-1" placeholder="0"
                                        onChange={(e) => setQuantities({...quantities, [size]: parseInt(e.target.value) || 0})} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 sticky top-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 pb-4 border-b">สรุปยอด</h3>
                    <div className="space-y-3 mb-6 text-sm">
                        <div className="flex justify-between"><span>จำนวนรวม</span><span className="font-bold">{totalQty} ตัว</span></div>
                        <div className="flex justify-between items-center"><span>ราคาขาย/ตัว</span><input type="number" className="w-20 text-right border rounded p-1" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))}/></div>
                        <div className="flex justify-between items-center"><span>ค่าบล็อก/Addon</span><input type="number" className="w-20 text-right border rounded p-1" value={addOnCost} onChange={e => setAddOnCost(Number(e.target.value))}/></div>
                        <div className="flex justify-between items-center"><span>ค่าขนส่ง</span><input type="number" className="w-20 text-right border rounded p-1" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))}/></div>
                        <div className="flex justify-between items-center text-red-500"><span>ส่วนลด</span><input type="number" className="w-20 text-right border border-red-200 rounded p-1" value={discount} onChange={e => setDiscount(Number(e.target.value))}/></div>
                        
                        {/* VAT CONFIGURATION SECTION */}
                        <div className="flex justify-between items-center py-2 border-t border-dashed">
                            <label className="flex items-center text-xs cursor-pointer">
                                <input type="checkbox" className="mr-2" checked={isVatIncluded} onChange={e => setIsVatIncluded(e.target.checked)}/>
                                ราคารวม VAT ({config.vat_rate*100}%) แล้ว
                            </label>
                            <span className="text-xs text-slate-500">VAT: {vatAmount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>

                        <div className="flex justify-between font-bold text-xl text-blue-700 mt-2 p-2 bg-blue-50 rounded"><span>ยอดสุทธิ</span><span>{grandTotal.toLocaleString()} ฿</span></div>
                    </div>
                    <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg shadow-lg flex justify-center items-center" onClick={handleSaveOrder}>
                        <Save className="mr-2" size={18}/> {editingOrder ? "บันทึกการแก้ไข" : "บันทึกออเดอร์"}
                    </button>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button className="border py-2 rounded text-sm hover:bg-slate-50" onClick={() => setShowPreview(true)}>Preview</button>
                        <button className="border py-2 rounded text-sm hover:bg-slate-50" onClick={handleCopySummary}>Copy</button>
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
    <button onClick={() => setActiveTab(id)} className={`px-6 py-3 font-medium text-sm border-b-2 ${activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>{label}</button>
  );

  return (
    <div className="p-4 md:p-8 fade-in h-full bg-slate-50">
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
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
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

      <header className="mb-8 flex justify-between">
        <h1 className="text-2xl font-bold text-slate-800">จัดการข้อมูลสินค้า (Master Data)</h1>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
            <Plus size={18} className="mr-2"/> เพิ่มข้อมูล
        </button>
      </header>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[500px]">
        <div className="flex border-b overflow-x-auto">
            <TabButton id="fabric" label="ชนิดผ้า" />
            <TabButton id="neck" label="รูปแบบคอ" />
            <TabButton id="sleeve" label="รูปแบบแขน" />
        </div>
        <div className="p-6">
            {loading ? <p>Loading...</p> : (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b text-sm text-slate-500">
                            <th className="py-3 px-4">ชื่อรายการ</th>
                            <th className="py-3 px-4 text-center">จำนวน (คงเหลือ)</th>
                            <th className="py-3 px-4 text-right">ราคาต้นทุน</th>
                            <th className="py-3 px-4 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-slate-50 transition">
                                <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                        (item.quantity || 0) > 50 ? 'bg-emerald-100 text-emerald-700' :
                                        (item.quantity || 0) > 20 ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {item.quantity || 0}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-right text-slate-600 font-medium">
                                    {item.cost_price ? `฿${parseFloat(item.cost_price).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button 
                                            onClick={() => openEditModal(item)}
                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition"
                                            title="แก้ไข"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(item)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
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

// 2.4 CUSTOMER PAGE (NEW: UPDATED with CRUD and Correct UI)
const CustomerPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" or "edit"
  // แก้ไข: ใช้ contact_channel แทน channel เพื่อให้ตรงกับ Backend
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
      // Map data from table to modal state (Handle both channel and contact_channel keys)
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
    <div className="p-4 md:p-8 fade-in h-full bg-slate-50">
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
                      <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">บันทึก</button>
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

      <header className="mb-8 flex justify-between">
        <h1 className="text-2xl font-bold text-slate-800">จัดการลูกค้า</h1>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"><Plus size={18} className="mr-2"/> เพิ่มลูกค้า</button>
      </header>
       
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[500px]">
        <div className="p-6">
            {loading ? <p className="text-center text-slate-500">Loading...</p> : (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b text-sm text-slate-500">
                            <th className="py-3 px-4">ชื่อลูกค้า</th>
                            <th className="py-3 px-4">ช่องทาง</th>
                            <th className="py-3 px-4">เบอร์โทร</th>
                            <th className="py-3 px-4 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((cust) => (
                            <tr key={cust.id} className="border-b hover:bg-slate-50 transition">
                                <td className="py-3 px-4 font-medium text-slate-800">{cust.name}</td>
                                <td className="py-3 px-4 text-sm text-slate-600">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs border">
                                        {cust.contact_channel || cust.channel}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-slate-600 font-mono">{cust.phone}</td>
                                <td className="py-3 px-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => openEditModal(cust)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition" title="แก้ไข"><Edit size={16}/></button>
                                        <button onClick={() => setDeleteConfirm(cust)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition" title="ลบ"><Trash2 size={16}/></button>
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

// 2.5 ORDER LIST PAGE (UPDATED: With Search & Export CSV)
const OrderListPage = ({ onNavigate, onEdit, filterType = 'all' }) => {
  const [orders, setOrders] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // State สำหรับคำค้นหา
   
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
    if(s === 'production') return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">ผลิต</span>;
    if(s === 'urgent') return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs">ด่วน</span>;
    if(s === 'delivered') return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">ส่งแล้ว</span>;
    return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">Draft</span>;
  };

  // --- FILTER & SEARCH LOGIC ---
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    // 1. Filter by Type (All, Pending, Revenue, Urgent)
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
        default:
            break;
    }

    // 2. Filter by Search Term
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

  const getTitle = () => {
      switch(filterType) {
          case 'pending': return 'รายการออเดอร์ (ค้างส่ง)';
          case 'revenue': return 'รายการออเดอร์ (ส่งแล้ว/รับรู้รายได้)';
          case 'urgent': return 'รายการออเดอร์ (ด่วน)';
          default: return 'รายการออเดอร์ทั้งหมด';
      }
  };

  // --- EXPORT CSV FUNCTION ---
  const handleExportCSV = () => {
      if (filteredOrders.length === 0) {
          alert("ไม่มีข้อมูลสำหรับ Export");
          return;
      }

      // 1. Define Headers
      const headers = ["Order No", "Customer", "Contact", "Phone", "Deadline", "Total Amount", "Deposit", "Status"];
      
      // 2. Map Data to Rows
      const rows = filteredOrders.map(order => [
          `"${order.order_no}"`, // Wrap in quotes to handle commas in content
          `"${order.customer_name || ''}"`,
          `"${order.contact_channel || ''}"`,
          `"${order.phone || ''}"`,
          `"${order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH') : ''}"`,
          `"${order.grand_total || 0}"`,
          `"${order.deposit || 0}"`,
          `"${order.status || 'draft'}"`
      ]);

      // 3. Combine with BOM for Thai support in Excel
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

      // 4. Create Download Link
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
    <div className="p-4 md:p-8 fade-in h-full bg-slate-50">
      {/* Delete Confirmation Modal */}
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

      {/* HEADER: Title + Search + Actions */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{getTitle()}</h1>
            <p className="text-slate-500 text-sm mt-1">แสดงผล: {filteredOrders.length} รายการ</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="ค้นหาเลขที่, ชื่อลูกค้า..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                        <XCircle size={16} />
                    </button>
                )}
            </div>

            <div className="flex gap-2">
                {/* Export Button */}
                <button 
                    onClick={handleExportCSV}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-emerald-700 transition shadow-sm whitespace-nowrap"
                    title="Download CSV"
                >
                    <Download size={18} className="mr-2"/> Export
                </button>

                {/* Create Button */}
                <button 
                    onClick={() => onNavigate('create_order')} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
                >
                    <Plus size={18} className="mr-2"/> สร้างใหม่
                </button>
            </div>
        </div>
      </header>
       
      {/* TABLE CONTENT */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[500px]">
        <div className="p-0 md:p-6 overflow-x-auto">
            {loading ? <p className="text-center text-slate-500 py-10">Loading...</p> : (
                <table className="w-full text-left min-w-[800px]">
                    <thead>
                        <tr className="border-b text-sm text-slate-500 bg-slate-50 md:bg-white">
                            <th className="py-3 px-4 w-1/6">เลขที่</th>
                            <th className="py-3 px-4 w-1/6">ลูกค้า</th>
                            <th className="py-3 px-4 w-1/6">กำหนดส่ง</th>
                            <th className="py-3 px-4 w-1/6 text-right">ยอดรวม</th>
                            <th className="py-3 px-4 w-1/6 text-center">สถานะ</th>
                            <th className="py-3 px-4 w-1/6 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map((order) => (
                            <tr key={order.id} className="border-b hover:bg-slate-50 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-800">{order.order_no}</td>
                                <td className="py-3 px-4 text-slate-700">
                                    <div className="font-medium">{order.customer_name}</div>
                                    <div className="text-xs text-slate-400">{order.contact_channel}</div>
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-sm">
                                    {order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH') : '-'}
                                </td>
                                <td className="py-3 px-4 text-right font-medium">{order.grand_total?.toLocaleString()}</td>
                                <td className="py-3 px-4 text-center">{getStatusBadge(order.status)}</td>
                                <td className="py-3 px-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button 
                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition" 
                                            title="แก้ไข"
                                            onClick={() => onEdit(order)}
                                        >
                                            <Edit size={16}/>
                                        </button>
                                        <button 
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition" 
                                            title="ลบ"
                                            onClick={() => setDeleteConfirm(order)}
                                        >
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
                                        {searchTerm ? <Search size={48} className="mb-3 opacity-50"/> : <FileText size={48} className="mb-3 opacity-50" />}
                                        <p className="text-lg font-medium">
                                            {searchTerm ? `ไม่พบผลลัพธ์สำหรับ "${searchTerm}"` : "ไม่พบรายการออเดอร์ในกลุ่มนี้"}
                                        </p>
                                        {!searchTerm && <p className="text-sm mt-1">ลองเปลี่ยนตัวกรองหรือสร้างออเดอร์ใหม่</p>}
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


// 2.6 SETTINGS PAGE (NEW: Pricing Rules & Global Config)
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
                  vat_rate: (data.vat_rate || 0) * 100, // Convert 0.07 -> 7
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
                  vat_rate: globalConfig.vat_rate / 100, // Convert 7 -> 0.07
                  default_shipping_cost: globalConfig.default_shipping_cost
              })
          });
          alert("บันทึกการตั้งค่าเรียบร้อยแล้ว");
      } catch(e) { alert("Error saving config: " + e.message); }
  }

  return (
    <div className="p-4 md:p-8 fade-in h-full bg-slate-50">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <Filter className="mr-3" /> การตั้งค่าระบบ (Settings)
        </h1>
      </header>

      <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button onClick={() => setActiveTab("pricing")} className={`pb-3 px-4 font-medium text-sm border-b-2 transition ${activeTab==="pricing" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
             ตั้งราคาขาย (Tier Pricing)
          </button>
          <button onClick={() => setActiveTab("general")} className={`pb-3 px-4 font-medium text-sm border-b-2 transition ${activeTab==="general" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
             ค่าทั่วไป (VAT/Shipping)
          </button>
      </div>

      {activeTab === "pricing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form เพิ่มกฎ */}
              <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
                  <h3 className="font-bold text-lg mb-4 text-slate-700">เพิ่มกฎราคาใหม่</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">ชนิดผ้า</label>
                          <select 
                            className="w-full border p-2 rounded"
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
                              <input type="number" className="w-full border p-2 rounded" value={newRule.min_qty} onChange={e => setNewRule({...newRule, min_qty: parseInt(e.target.value)||0})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium mb-1">ถึง (ตัว)</label>
                              <input type="number" className="w-full border p-2 rounded" value={newRule.max_qty} onChange={e => setNewRule({...newRule, max_qty: parseInt(e.target.value)||0})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">ราคาต่อหน่วย (บาท)</label>
                          <input type="number" className="w-full border p-2 rounded bg-blue-50 text-blue-800 font-bold" value={newRule.unit_price} onChange={e => setNewRule({...newRule, unit_price: parseFloat(e.target.value)||0})} />
                      </div>
                      <button onClick={handleAddRule} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-medium">บันทึกกฎราคา</button>
                  </div>
              </div>

              {/* Table รายการกฎ */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">รายการ Pricing Tiers ปัจจุบัน</div>
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white text-slate-500 border-b">
                          <tr>
                              <th className="p-4">ชนิดผ้า</th>
                              <th className="p-4">ช่วงจำนวน (Qty Range)</th>
                              <th className="p-4 text-right">ราคา/ตัว</th>
                              <th className="p-4 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {pricingRules.length === 0 ? (
                              <tr><td colSpan="4" className="p-8 text-center text-slate-400">ยังไม่มีการตั้งราคา</td></tr>
                          ) : pricingRules.map((rule) => (
                              <tr key={rule.id} className="hover:bg-slate-50">
                                  <td className="p-4 font-bold text-slate-700">{rule.fabric_type}</td>
                                  <td className="p-4">
                                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                          {rule.min_qty} - {rule.max_qty > 9999 ? 'ขึ้นไป' : rule.max_qty}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right font-bold text-blue-600">{rule.unit_price} ฿</td>
                                  <td className="p-4 text-right">
                                      <button onClick={() => handleDeleteRule(rule.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === "general" && (
          <div className="bg-white p-8 rounded-xl shadow-sm border max-w-lg mx-auto">
              <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calculator size={32} className="text-slate-400"/>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Global Configuration</h3>
                  <p className="text-slate-500">ตั้งค่าตัวแปรกลางของระบบ</p>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">อัตราภาษีมูลค่าเพิ่ม (VAT %)</label>
                      <div className="relative">
                          <input 
                              type="number" 
                              className="w-full border p-3 rounded-lg pl-10" 
                              placeholder="7" 
                              value={globalConfig.vat_rate}
                              onChange={e => setGlobalConfig({...globalConfig, vat_rate: parseFloat(e.target.value)})}
                          />
                          <span className="absolute left-3 top-3 text-slate-400">%</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">ค่ามาตรฐานประเทศไทยคือ 7%</p>
                  </div>

                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">ค่าขนส่งเริ่มต้น (บาท)</label>
                      <div className="relative">
                          <input 
                              type="number" 
                              className="w-full border p-3 rounded-lg pl-10" 
                              placeholder="0" 
                              value={globalConfig.default_shipping_cost}
                              onChange={e => setGlobalConfig({...globalConfig, default_shipping_cost: parseFloat(e.target.value)})}
                          />
                          <DollarSign className="absolute left-3 top-3 text-slate-400" size={18} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">ค่านี้จะถูกใส่ให้ในช่อง "ค่าขนส่ง" โดยอัตโนมัติเมื่อสร้างออเดอร์ใหม่</p>
                  </div>

                  <button 
                      onClick={handleSaveConfig}
                      className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition mt-4"
                  >
                      บันทึกการตั้งค่า
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

// --- 3. MAIN APP ---
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800 flex flex-col md:flex-row relative">
       <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30">
           <span className="font-bold text-lg">B-LOOK ADMIN</span>
           <button onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
       </div>
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

       <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 text-xl font-bold tracking-wider border-b border-slate-800 flex justify-between items-center">
            <span>B-LOOK ADMIN</span>
            <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-6">
        
          <button onClick={() => handleNavigate('dashboard')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}><LayoutDashboard size={20} /> <span>Dashboard</span></button>
          <button onClick={() => handleNavigate('order_list')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${['order_list', 'create_order'].includes(currentPage) ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}><FileText size={20} /> <span>Orders</span></button>
          <button onClick={() => handleNavigate('product')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'product' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}><Box size={20} /> <span>จัดการข้อมูลสินค้า</span></button>
          <button onClick={() => handleNavigate('customer')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'customer' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}><User size={20} /> <span>ข้อมูลลูกค้า</span></button>
          <button onClick={() => handleNavigate('settings')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'settings' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}> <Settings size={20} /><span>ตั้งค่าระบบ</span></button>
        </nav>
        <div className="p-4 border-t border-slate-800">
            <button onClick={() => { localStorage.removeItem('access_token'); setIsLoggedIn(false); }} className="w-full flex items-center text-slate-400 hover:text-white transition text-sm p-2 hover:bg-slate-800 rounded"><LogOut size={16} className="mr-2"/> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto h-[calc(100vh-60px)] md:h-screen w-full">{renderContent()}</main>
    </div>
  );
};

export default App;