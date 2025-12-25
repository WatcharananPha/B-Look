import React, { useState, useEffect } from 'react';
import { 
  Calendar, Save, Calculator, AlertCircle, User, Box, FileText, 
  Truck, CreditCard, Tag, LogOut, Search, Plus, Edit, Trash2, 
  CheckCircle, Filter, Phone, MessageCircle, MapPin, XCircle,
  LayoutDashboard, Printer, Copy, Lock, Key, ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';

// --- 1. MOCK DATA (ข้อมูลสมมติ) ---
const BRANDS = ["BG (B.Look Garment)", "Jersey Express"];
const FABRIC_TYPES = ["Micro Smooth (ไมโครเรียบ)", "Micro Eyelet (ไมโครรู)", "Atom (อะตอม)", "Msed (เม็ดข้าวสาร)"];
const NECK_TYPES = ["V-Neck (คอวี)", "Round (คอกลม)", "Polo (คอปก)", "Chinese (คอจีน)"];
const SLEEVE_TYPES = ["Short (แขนสั้น)", "Long (แขนยาว)", "Sleeveless (กุด)"];
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

const MOCK_CUSTOMERS = [
  { id: 1, name: "คุณสมชาย (บริษัท SCG)", channel: "LINE OA", phone: "081-111-2222", orders: 15, lastOrder: "20/12/2025" },
  { id: 2, name: "เจ๊แต๋ว (ทีมฟุตบอล อบต.)", channel: "Facebook", phone: "089-999-8888", orders: 3, lastOrder: "15/11/2025" },
  { id: 3, name: "โรงเรียนอนุบาลหมีน้อย", channel: "โทรศัพท์", phone: "02-555-4444", orders: 8, lastOrder: "01/12/2025" },
];

const MOCK_PRODUCTS = {
  fabrics: [
    { id: 1, name: "Micro Smooth (ไมโครเรียบ)", price: 0, status: "active" },
    { id: 2, name: "Micro Eyelet (ไมโครรู)", price: 0, status: "active" },
    { id: 3, name: "Atom (อะตอม)", price: 20, status: "active" },
  ],
  necks: [
    { id: 1, name: "V-Neck (คอวี)", status: "active" },
    { id: 2, name: "Round (คอกลม)", status: "active" },
    { id: 3, name: "Polo (คอปก)", status: "active" },
  ]
};

// --- 2. COMPONENTS ---

// 2.0 LOGIN PAGE
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && password) {
      onLogin(); 
    } else {
      alert("กรุณากรอก Username และ Password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 font-sans text-slate-800 p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-slate-900 text-white w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">B-LOOK ADMIN</h1>
          <p className="text-slate-500 mt-2 text-sm">ระบบจัดการออเดอร์และคำนวณราคา</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="text" 
                className="w-full pl-10 border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="password" 
                className="w-full pl-10 border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-xl transition duration-200 mt-2"
          >
            เข้าสู่ระบบ (Sign In)
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>© 2025 B-Look Co., Ltd. All rights reserved.</p>
          <p className="mt-1">(Mock Login: กรอกอะไรก็ได้เพื่อเข้าใช้งาน)</p>
        </div>
      </div>
    </div>
  );
};

// 2.1 DASHBOARD (SMART CALENDAR & NOTIFICATION CENTER)
const DashboardPage = () => {
    // --- STATE & MOCK DATA ---
    const [currentDate, setCurrentDate] = useState(new Date(2025, 11, 1)); // Dec 2025
    const [filterType, setFilterType] = useState('all'); // all, design, production, delivery, urgent
    const [userRole, setUserRole] = useState('owner'); // toggle for demo: 'admin' vs 'owner'

    // Mock Events Data
    const rawEvents = [
        { id: 1, date: 3, title: "ตัดผ้า Lot A (PO-001)", type: "production", status: "wip" },
        { id: 2, date: 5, title: "ส่งงาน อบต.บางนา", type: "delivery", status: "pending" },
        { id: 3, date: 12, title: "ตามแบบ คุณสมชาย (ส่งไป 2 วันแล้ว)", type: "design_followup", status: "warning" }, // FR-14 Follow-up
        { id: 4, date: 12, title: "เย็บงาน Jersey", type: "production", status: "wip" },
        { id: 5, date: 18, title: "QC งานด่วน (PO-009)", type: "production", status: "urgent" },
        { id: 6, date: 20, title: "โรงเรียนใช้งานจริง (Pre-alert)", type: "usage_critical", status: "critical" }, // FR-14 Pre-alert
        { id: 7, date: 25, title: "ส่งงาน โรงเรียน", type: "delivery", status: "confirmed" },
        { id: 8, date: 28, title: "แพ็คสินค้า Lot B", type: "production", status: "wip" }
    ];

    // Filter Logic
    const filteredEvents = rawEvents.filter(evt => {
        if (filterType === 'all') return true;
        if (filterType === 'urgent') return evt.status === 'urgent' || evt.status === 'critical' || evt.status === 'warning';
        return evt.type.includes(filterType);
    });

    // Group events by date for calendar rendering
    const eventsByDate = filteredEvents.reduce((acc, evt) => {
        acc[evt.date] = [...(acc[evt.date] || []), evt];
        return acc;
    }, {});

    // Calendar Helpers
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun
    
    // Style Mapping
    const getTypeStyle = (type, status) => {
        if (status === 'critical') return "bg-rose-600 text-white border-rose-700 shadow-sm animate-pulse"; // Deadline Alert
        if (status === 'warning') return "bg-amber-100 text-amber-800 border-amber-300 border-l-4"; // Design Followup
        
        switch (type) {
            case 'production': return "bg-blue-50 text-blue-700 border-blue-200 border";
            case 'delivery': return "bg-emerald-50 text-emerald-700 border-emerald-200 border";
            default: return "bg-slate-50 text-slate-600 border-slate-200";
        }
    };

    return (
        <div className="p-4 md:p-8 fade-in h-full flex flex-col bg-slate-50/50 overflow-y-auto pb-20 md:pb-8">
            {/* --- HEADER & CONTROLS --- */}
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                        <LayoutDashboard className="mr-2 text-blue-600" /> Production Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">ติดตามสถานะงานผลิต, การจัดส่ง และแจ้งเตือนความสำคัญ</p>
                </div>
                
                {/* Role Toggle & Date Controls */}
                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                    <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border shadow-sm w-full md:w-auto justify-between md:justify-end">
                        <span className="text-xs text-slate-400 pl-2">View As:</span>
                        <div className="flex space-x-1">
                            <button 
                                onClick={() => setUserRole('admin')} 
                                className={`px-3 py-1 text-xs rounded transition ${userRole === 'admin' ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                            >
                                Admin (Op)
                            </button>
                            <button 
                                onClick={() => setUserRole('owner')} 
                                className={`px-3 py-1 text-xs rounded transition ${userRole === 'owner' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                            >
                                MD (Owner)
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 w-full md:w-auto justify-between md:justify-end">
                        <button className="p-2 bg-white border rounded hover:bg-slate-50 shadow-sm"><ChevronLeft size={16}/></button>
                        <span className="font-bold text-slate-700 w-32 text-center">December 2025</span>
                        <button className="p-2 bg-white border rounded hover:bg-slate-50 shadow-sm"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </header>

            {/* --- KPI CARDS (RBAC: FR-03) --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Operation Stats (Visible to All) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition"><FileText size={48} /></div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">New Orders</div>
                    <div className="text-3xl font-black text-slate-800 mt-2">12</div>
                    <div className="text-xs text-emerald-600 mt-1 flex items-center"><Plus size={10} className="mr-1"/> 2 from yesterday</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition"><Truck size={48} /></div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Delivery Pending</div>
                    <div className="text-3xl font-black text-blue-600 mt-2">8</div>
                    <div className="text-xs text-slate-400 mt-1">Within 7 days</div>
                </div>

                {/* Financial Stats (Visible to MD/Owner Only) */}
                {userRole === 'owner' ? (
                    <>
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl shadow-md text-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 p-3 opacity-20"><Calculator size={48} /></div>
                            <div className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Total Revenue (Month)</div>
                            <div className="text-3xl font-black mt-2">฿458k</div>
                            <div className="text-xs text-emerald-100 mt-1 opacity-80">+12% vs last month</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 p-3 opacity-10"><AlertCircle size={48} className="text-rose-500"/></div>
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Urgent / Critical</div>
                            <div className="text-3xl font-black text-rose-600 mt-2">3</div>
                            <div className="text-xs text-rose-600 mt-1 font-medium">Action Required!</div>
                        </div>
                    </>
                ) : (
                    // Placeholder for Admin (Hidden Financials)
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 col-span-1 sm:col-span-2">
                        <Lock size={24} className="mb-2"/>
                        <span className="text-xs font-medium">Financial Data Locked (MD Only)</span>
                    </div>
                )}
            </div>

            {/* --- MAIN CONTENT: CALENDAR & ALERTS --- */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 h-full min-h-[500px]">
                
                {/* 1. SMART CALENDAR (Left Side) */}
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    {/* Toolbar / Filters (FR-13) */}
                    <div className="p-3 border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
                        {['all', 'production', 'delivery', 'urgent'].map(type => (
                            <button 
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition border whitespace-nowrap
                                    ${filterType === type 
                                        ? 'bg-slate-800 text-white border-slate-800' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Grid Header */}
                    <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-100 gap-px border-b rounded-b-xl overflow-hidden min-h-[300px]">
                        {/* Empty slots for offset */}
                        {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} className="bg-white min-h-[80px] md:min-h-[100px]"></div>)}

                        {/* Days */}
                        {[...Array(daysInMonth)].map((_, i) => {
                            const date = i + 1;
                            const events = eventsByDate[date] || [];
                            return (
                                <div key={date} className="bg-white p-1 min-h-[80px] md:min-h-[100px] hover:bg-blue-50/30 transition relative group">
                                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${date === 12 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                                        {date}
                                    </span>
                                    
                                    {/* Events List */}
                                    <div className="mt-1 space-y-1">
                                        {events.map((evt, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`text-[9px] px-1.5 py-1 rounded cursor-pointer truncate font-medium ${getTypeStyle(evt.type, evt.status)}`}
                                                title={evt.title}
                                            >
                                                {evt.type === 'usage_critical' && '🔥 '}{evt.title}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Event Button (Owner Only FR-15) */}
                                    {userRole === 'owner' && (
                                        <button className="absolute bottom-1 right-1 md:opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-600">
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. NOTIFICATION CENTER / ALERTS (Right Side - FR-14) */}
                <div className="w-full lg:w-80 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-auto lg:h-full">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center">
                            <AlertCircle size={18} className="mr-2 text-rose-500" /> Action Required
                        </h3>
                        <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold">3 Alerts</span>
                    </div>
                    
                    <div className="p-4 space-y-4 overflow-y-auto flex-1 max-h-96 lg:max-h-full">
                        {/* Alert: Critical Deadline (FR-14 Pre-alert) */}
                        <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">CRITICAL</span>
                                <span className="text-[10px] text-rose-400">Due: 20 Dec</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-1">โรงเรียนใช้งานจริง (PO-009)</p>
                            <p className="text-xs text-slate-600">⚠️ ต้องส่งของภายใน 48 ชม. เพื่อให้ทันวันใช้งานจริง</p>
                            <button className="mt-2 w-full text-xs bg-white border border-rose-200 text-rose-600 py-1.5 rounded hover:bg-rose-100 font-semibold">
                                View Order
                            </button>
                        </div>

                        {/* Alert: Design Follow-up (FR-14 Design Loop) */}
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">FOLLOW-UP</span>
                                <span className="text-[10px] text-amber-500">Sent: 2 Days ago</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-1">คุณสมชาย (แก้แบบ)</p>
                            <p className="text-xs text-slate-600">⏳ ลูกค้ายังไม่คอนเฟิร์มแบบหลังแก้ เกินกำหนด 2 วันแล้ว</p>
                            <div className="mt-2 flex space-x-2">
                                <button className="flex-1 text-xs bg-white border border-amber-200 text-amber-700 py-1.5 rounded hover:bg-amber-100 font-semibold">
                                    Notify Line
                                </button>
                                <button className="flex-1 text-xs bg-amber-600 text-white py-1.5 rounded hover:bg-amber-700 font-semibold">
                                    Call
                                </button>
                            </div>
                        </div>

                        {/* Alert: Production Start */}
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg shadow-sm opacity-70">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">PRODUCTION</span>
                                <span className="text-[10px] text-blue-400">Today</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-1">ตัดผ้า Lot A (PO-001)</p>
                            <p className="text-xs text-slate-600">ถึงกำหนดเริ่มตัดผ้าวันนี้ กรุณาเบิกผ้าจาก Stock</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: INVOICE PREVIEW MODAL (UX Improved) ---
const InvoiceModal = ({ data, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  // 1. เพิ่ม Logic ดักจับปุ่ม ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    // เพิ่ม Event Listener
    document.addEventListener('keydown', handleKeyDown);
    
    // ลบ Event Listener เมื่อปิด Modal (Cleanup)
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // 2. เพิ่ม onClick={onClose} ที่พื้นหลังสีดำ (Backdrop)
    <div 
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm overflow-y-auto pt-10 pb-10 print:p-0 print:bg-white print:fixed print:inset-0"
        onClick={onClose} // กดพื้นหลังเพื่อปิด
    >
      
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #invoice-content, #invoice-content * { visibility: visible; }
            #invoice-content { 
                position: absolute; left: 0; top: 0; width: 100%; 
                margin: 0; padding: 20px; box-shadow: none; border: none; 
                border-radius: 0; background: white;
            }
            #no-print-btn { display: none !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}
      </style>

      {/* 3. ปุ่มเมนูลอย (Fixed) เพื่อให้เห็นตลอดเวลาแม้เลื่อนลง */}
      <div id="no-print-btn" className="fixed top-4 right-4 z-[60] flex space-x-2 print:hidden">
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center transition font-medium border border-blue-500">
              <Printer size={18} className="mr-2"/> Print / Save PDF
          </button>
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full shadow-lg transition border border-slate-600" title="Close (Esc)">
              <XCircle size={24} />
          </button>
      </div>

      {/* Main A4 Paper Container */}
      {/* ใส่ onClick={(e) => e.stopPropagation()} เพื่อป้องกันไม่ให้กดที่กระดาษแล้วปิด */}
      <div 
        id="invoice-content" 
        className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 md:p-12 shadow-2xl relative text-slate-800 font-sans mx-auto rounded-sm mt-4 mb-4"
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* --- HEADER SECTION --- */}
        <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-6 mb-8">
            <div className="flex flex-col">
                <h1 className="text-5xl font-black tracking-tighter text-slate-900 leading-none mb-2">B-LOOK</h1>
                <p className="text-slate-600 font-semibold text-lg">บริษัท บี-ลุค จำกัด (สำนักงานใหญ่)</p>
                <div className="text-sm text-slate-500 mt-2 space-y-0.5 leading-tight">
                    <p>123 ถนนตัวอย่าง แขวงบางนา เขตบางนา กทม. 10260</p>
                    <p>เลขประจำตัวผู้เสียภาษี: 010555xxxxxxx</p>
                    <p>โทร: 02-xxx-xxxx | LINE: @blook</p>
                </div>
            </div>
            <div className="text-right">
                <div className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded mb-3 uppercase tracking-wider">Original</div>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">ใบสั่งผลิต</h2>
                <h3 className="text-xl text-slate-500 font-light uppercase tracking-widest mb-4">Job Order</h3>
                
                <div className="text-right space-y-1">
                    <p className="text-sm">
                        <span className="font-semibold text-slate-600 mr-2">เลขที่เอกสาร:</span>
                        <span className="font-mono font-bold text-lg text-slate-900">PO-2512-001</span>
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold text-slate-600 mr-2">วันที่:</span>
                        <span>{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </p>
                </div>
            </div>
        </div>

        {/* --- INFO GRID --- */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
            {/* Customer Box */}
            <div className="flex-1 border border-slate-200 rounded-lg p-5 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                    <User size={14} className="mr-2"/> ข้อมูลลูกค้า (Customer)
                </h3>
                <div className="space-y-2 text-sm">
                    <p className="flex"><span className="w-24 text-slate-500 font-medium">ชื่อลูกค้า:</span> <span className="font-bold text-slate-800 text-base">{data.customerName || "-"}</span></p>
                    <p className="flex"><span className="w-24 text-slate-500 font-medium">เบอร์โทร:</span> <span>{data.phoneNumber || "-"}</span></p>
                    <p className="flex"><span className="w-24 text-slate-500 font-medium">ช่องทาง:</span> <span>{data.contactChannel}</span></p>
                    <p className="flex mt-2"><span className="w-24 text-slate-500 font-medium shrink-0">ที่อยู่จัดส่ง:</span> <span className="leading-relaxed">{data.address || "-"}</span></p>
                </div>
            </div>

            {/* Job Detail Box */}
            <div className="flex-1 border border-slate-200 rounded-lg p-5 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                    <Calendar size={14} className="mr-2"/> รายละเอียดงาน (Job Details)
                </h3>
                <div className="space-y-2 text-sm">
                    <p className="flex items-center">
                        <span className="w-24 text-slate-500 font-medium">วันสั่งงาน:</span> 
                        <span>{new Date().toLocaleDateString('th-TH')}</span>
                    </p>
                    <p className="flex items-center">
                        <span className="w-24 text-slate-500 font-medium">กำหนดส่ง:</span> 
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {data.deadline ? new Date(data.deadline).toLocaleDateString('th-TH') : "-"}
                        </span>
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-slate-500 font-medium">ระดับความด่วน:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            data.urgencyStatus === 'critical' ? 'bg-rose-100 text-rose-700 border-rose-200' : 
                            data.urgencyStatus === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                            'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                            {data.urgencyStatus === 'critical' ? '🔥 ด่วนมาก (3-5 วัน)' : 
                             data.urgencyStatus === 'warning' ? '⚡ ด่วน (7-10 วัน)' : '✅ ปกติ (>14 วัน)'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* --- PRODUCT TABLE --- */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-8">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-900 text-white">
                        <th className="py-3 px-4 text-left font-semibold w-12 text-center">#</th>
                        <th className="py-3 px-4 text-left font-semibold">รายการสินค้า (Description)</th>
                        <th className="py-3 px-4 text-right font-semibold w-24">จำนวน</th>
                        <th className="py-3 px-4 text-right font-semibold w-32">ราคา/หน่วย</th>
                        <th className="py-3 px-4 text-right font-semibold w-32">รวมเงิน</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    <tr className="group">
                        <td className="py-4 px-4 text-center text-slate-400 align-top">1</td>
                        <td className="py-4 px-4 align-top">
                            <p className="font-bold text-slate-800 text-base mb-1">เสื้อ {data.brand}</p>
                            <div className="text-slate-500 text-xs space-y-1 pl-2 border-l-2 border-slate-200">
                                <p>ผ้า: <span className="text-slate-700">{document.querySelector('select')?.value || "Micro Smooth"}</span></p>
                                <p>สเปค: คอ V-Neck / แขน Short</p>
                            </div>
                        </td>
                        <td className="py-4 px-4 text-right align-top font-medium">{data.totalQty}</td>
                        <td className="py-4 px-4 text-right align-top text-slate-600">{data.basePrice.toLocaleString()}</td>
                        <td className="py-4 px-4 text-right align-top font-bold text-slate-800">{(data.totalQty * data.basePrice).toLocaleString()}</td>
                    </tr>
                    
                    {data.addOnCost > 0 && (
                        <tr>
                            <td className="py-3 px-4 text-center text-slate-400">2</td>
                            <td className="py-3 px-4 text-slate-600">ค่าบล็อก / สกรีนเพิ่ม (Add-ons)</td>
                            <td className="py-3 px-4 text-right">-</td>
                            <td className="py-3 px-4 text-right">-</td>
                            <td className="py-3 px-4 text-right font-medium">{data.addOnCost.toLocaleString()}</td>
                        </tr>
                    )}
                    
                    {data.shippingCost > 0 && (
                        <tr>
                            <td className="py-3 px-4 text-center text-slate-400">3</td>
                            <td className="py-3 px-4 text-slate-600">ค่าจัดส่งสินค้า (Shipping)</td>
                            <td className="py-3 px-4 text-right">-</td>
                            <td className="py-3 px-4 text-right">-</td>
                            <td className="py-3 px-4 text-right font-medium">{data.shippingCost.toLocaleString()}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* --- SIZE MATRIX & SUMMARY --- */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
            
            {/* Left: Size Matrix */}
            <div className="flex-1">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">สรุปจำนวนตามไซซ์ (Size Matrix)</h4>
                    <div className="flex flex-wrap gap-2 content-start">
                        {Object.entries(data.quantities).some(([, q]) => q > 0) ? (
                            Object.entries(data.quantities).map(([size, qty]) => (
                                qty > 0 && (
                                    <div key={size} className="flex flex-col items-center bg-white border border-slate-200 rounded w-12 py-1 shadow-sm">
                                        <span className="text-[10px] text-slate-400 font-bold">{size}</span>
                                        <span className="text-sm font-bold text-blue-600">{qty}</span>
                                    </div>
                                )
                            ))
                        ) : (
                            <p className="text-sm text-slate-400 italic">- ยังไม่ได้ระบุจำนวน -</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Totals */}
            <div className="w-full md:w-[40%]">
                <div className="space-y-3">
                    <div className="flex justify-between text-sm text-slate-600">
                        <span>รวมเป็นเงิน (Subtotal)</span>
                        <span className="font-medium">{(data.totalQty * data.basePrice + data.addOnCost + data.shippingCost).toLocaleString()}</span>
                    </div>
                    
                    {data.discount > 0 && (
                        <div className="flex justify-between text-sm text-rose-600">
                            <span>ส่วนลด (Discount)</span>
                            <span>- {data.discount.toLocaleString()}</span>
                        </div>
                    )}
                    
                    <div className="flex justify-between text-sm text-slate-600">
                        <span>ภาษีมูลค่าเพิ่ม (VAT 7%) {data.isVatIncluded && <span className="text-xs text-slate-400">(Inc.)</span>}</span>
                        <span>{data.vatAmount.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                    </div>
                    
                    <div className="border-t-2 border-slate-800 pt-3 flex justify-between items-end">
                        <span className="text-base font-bold text-slate-800">ยอดสุทธิ (Grand Total)</span>
                        <span className="text-2xl font-black text-slate-900">{data.grandTotal.toLocaleString(undefined, {maximumFractionDigits:2})} <span className="text-sm font-normal text-slate-500">THB</span></span>
                    </div>

                    <div className="mt-4 bg-slate-100 rounded-lg p-3 border border-slate-200">
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                            <span>หักมัดจำ (Deposit)</span>
                            <span>{data.deposit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-blue-700 border-t border-slate-300 pt-1">
                            <span>ยอดคงเหลือ (Balance)</span>
                            <span>{data.balance.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- FOOTER / SIGNATURE --- */}
        <div className="mt-auto pt-8 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-20">
                <div className="text-center">
                    <div className="h-16 flex items-end justify-center mb-2">
                        <div className="border-b border-dashed border-slate-400 w-3/4"></div>
                    </div>
                    <p className="text-sm font-bold text-slate-700">ผู้สั่งผลิต (Customer)</p>
                    <p className="text-xs text-slate-400 mt-1">วันที่: ______ / ______ / ________</p>
                </div>
                <div className="text-center">
                    <div className="h-16 flex items-end justify-center mb-2">
                        <div className="border-b border-dashed border-slate-400 w-3/4"></div>
                    </div>
                    <p className="text-sm font-bold text-slate-700">ผู้อนุมัติ (Authorized Signature)</p>
                    <p className="text-xs text-slate-400 mt-1">วันที่: ______ / ______ / ________</p>
                </div>
            </div>
            <p className="text-center text-[10px] text-slate-300 mt-8">เอกสารนี้สร้างโดยระบบ B-LOOK Order Management System</p>
        </div>

      </div>
    </div>
  );
};

// 2.2 หน้าสร้างออเดอร์ (Update: เพิ่ม Popup บันทึกสำเร็จ)
const OrderCreationPage = () => {
  // State เดิม
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
  const [supplier, setSupplier] = useState("โรงงานลพบุรี A");
  
  // State สำหรับ Modal (Preview & Success)
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // <--- 1. เพิ่ม State นี้

  // Calculations
  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);
  const productSubtotal = totalQty * basePrice;
  const totalBeforeCalc = productSubtotal + addOnCost + shippingCost - discount;
  
  let vatAmount = 0;
  let grandTotal = 0;

  if (isVatIncluded) {
    grandTotal = totalBeforeCalc;
    vatAmount = (totalBeforeCalc * 7) / 107;
  } else {
    vatAmount = totalBeforeCalc * 0.07;
    grandTotal = totalBeforeCalc + vatAmount;
  }

  const balance = grandTotal - deposit;
  const totalCost = (totalQty * costPerUnit); 
  const estimatedProfit = (grandTotal - vatAmount) - totalCost;

  // Function: Save Order Logic
  const handleSaveOrder = () => {
    // ตรงนี้สามารถใส่ Logic ยิง API ไป Backend ได้
    // ... API Call ...
    
    // แสดง Popup สำเร็จ
    setShowSuccess(true);
  };

  // Function: Copy to Clipboard
  const handleCopySummary = () => {
    const text = `
📋 *สรุปรายการสั่งผลิต* (${brand})
ลูกค้า: ${customerName || '-'}
--------------------
จำนวนรวม: ${totalQty} ตัว
ยอดสุทธิ: ${grandTotal.toLocaleString()} บาท
(มัดจำแล้ว: ${deposit.toLocaleString()} บาท)
--------------------
💰 *ยอดคงเหลือชำระ: ${balance.toLocaleString()} บาท*
📅 กำหนดส่ง: ${deadline || '-'}
    `.trim();
    navigator.clipboard.writeText(text);
    alert("คัดลอกข้อความสรุปเรียบร้อยแล้ว! (พร้อมวางใน Chat)");
  };

  useEffect(() => {
    if (!deadline) { setUrgencyStatus("normal"); return; }
    const today = new Date();
    const target = new Date(deadline);
    const diffTime = Math.abs(target - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays <= 5) setUrgencyStatus("critical");
    else if (diffDays <= 10) setUrgencyStatus("warning");
    else setUrgencyStatus("normal");
  }, [deadline]);

  const theme = {
    critical: { border: "border-l-8 border-rose-500", header: "bg-rose-100 text-rose-800", badge: "bg-rose-500" },
    warning: { border: "border-l-8 border-amber-500", header: "bg-amber-100 text-amber-800", badge: "bg-amber-500" },
    normal: { border: "border-l-8 border-emerald-500", header: "bg-emerald-100 text-emerald-800", badge: "bg-emerald-500" }
  };

  const previewData = {
    orderId: "AUTO-GEN",
    customerName, phoneNumber, contactChannel, address,
    deadline, urgencyStatus, brand,
    quantities, totalQty, basePrice, addOnCost, shippingCost, discount,
    isVatIncluded, vatAmount, grandTotal, deposit, balance
  };

  return (
    <div className="p-4 md:p-8 fade-in overflow-y-auto pb-20 md:pb-8">
        {/* Modal: Preview Invoice */}
        {showPreview && (
            <InvoiceModal data={previewData} onClose={() => setShowPreview(false)} />
        )}

        {/* Modal: Save Success (Popup แจ้งเตือนบันทึกสำเร็จ) */}
        {showSuccess && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in px-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full transform transition-all scale-100">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <CheckCircle size={48} className="text-emerald-500" strokeWidth={3} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">บันทึกสำเร็จ!</h3>
                    <p className="text-slate-500 mb-8">ข้อมูลออเดอร์ถูกบันทึกเรียบร้อยแล้ว<br/>ระบบพร้อมสำหรับการดำเนินการต่อ</p>
                    <button 
                        onClick={() => setShowSuccess(false)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:scale-105"
                    >
                        ตกลง (OK)
                    </button>
                </div>
            </div>
        )}

        <header className={`mb-8 p-6 rounded-lg shadow-sm bg-white ${theme[urgencyStatus].border} flex flex-col md:flex-row justify-between items-start gap-4`}>
            <div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">สร้างใบออเดอร์ใหม่ (Create Order)</h1>
                <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-3 items-start md:items-center">
                    <span className="text-slate-500 text-sm bg-slate-100 px-2 py-1 rounded">Order ID: AUTO-GEN</span>
                    <select className="text-sm border-slate-300 rounded px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold"
                        value={brand} onChange={(e) => setBrand(e.target.value)}>
                        {BRANDS.map(b => <option key={b}>{b}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex flex-col items-start md:items-end space-y-2 w-full md:w-auto">
                <div className={`px-4 py-2 rounded-lg flex items-center space-x-2 w-full md:w-auto ${theme[urgencyStatus].header}`}>
                    <AlertCircle size={20} />
                    <span className="font-semibold">
                        {urgencyStatus === 'critical' ? 'ด่วนมาก (3-5 วัน)' : urgencyStatus === 'warning' ? 'เร่ง (7-10 วัน)' : 'งานปกติ (>14 วัน)'}
                    </span>
                </div>
                 <select className="text-xs bg-slate-800 text-white p-1 rounded mt-2 w-full md:w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="owner">View as: Owner</option>
                    <option value="admin">View as: Admin</option>
                </select>
            </div>
        </header>

        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-700"><User className="mr-2" size={18}/> ข้อมูลลูกค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อลูกค้า</label>
                            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" 
                                value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-600 mb-1">เบอร์โทร</label>
                            <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 bg-white" 
                                value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">ช่องทาง</label>
                            <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white" value={contactChannel} onChange={e => setContactChannel(e.target.value)}>
                                <option>LINE OA</option><option>Facebook</option><option>โทรศัพท์</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">กำหนดส่ง (Deadline)</label>
                            <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500"
                                onChange={(e) => setDeadline(e.target.value)} />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                             <label className="block text-sm font-medium text-slate-600 mb-1">ที่อยู่จัดส่ง</label>
                             <textarea className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-20"
                                value={address} onChange={e => setAddress(e.target.value)}></textarea>
                        </div>
                    </div>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-700"><Box className="mr-2" size={18}/> รายละเอียดสินค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">ชนิดผ้า</label>
                            <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">{FABRIC_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">คอเสื้อ</label>
                            <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">{NECK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">แขนเสื้อ</label>
                            <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">{SLEEVE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3">ระบุจำนวน (Size Matrix)</label>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                            {SIZES.map((size) => (
                                <div key={size} className="text-center">
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">{size}</label>
                                    <input type="number" min="0" className="w-full text-center border border-slate-300 rounded-md p-1 focus:ring-blue-500" placeholder="0"
                                        onChange={(e) => setQuantities({...quantities, [size]: parseInt(e.target.value) || 0})} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                
                {role === 'owner' && (
                    <section className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-400 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-bl">Owner View</div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center"><Calculator className="mr-2" size={18}/> ต้นทุน (Cost)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Supplier</label>
                                <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-white" value={supplier} onChange={e => setSupplier(e.target.value)}>
                                    <option>โรงงานลพบุรี A</option><option>โรงงานลพบุรี B</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">ต้นทุนต่อตัว</label>
                                <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                                    value={costPerUnit} onChange={(e) => setCostPerUnit(parseInt(e.target.value))} />
                            </div>
                        </div>
                    </section>
                )}
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 sticky top-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 pb-4 border-b border-slate-100 flex items-center">
                        <Tag className="mr-2" size={20}/> สรุปยอด (Summary)
                    </h3>
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">จำนวนรวม</span>
                            <span className="font-semibold text-slate-800">{totalQty} ตัว</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">ราคาขาย/ตัว</span>
                            <div className="flex items-center">
                                <input type="number" className="w-20 text-right border border-slate-200 rounded p-1 mr-1"
                                    value={basePrice} onChange={(e) => setBasePrice(parseInt(e.target.value) || 0)}/>
                                <span className="text-xs text-slate-400">฿</span>
                            </div>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">ค่าบล็อก/สกรีนเพิ่ม</span>
                            <input type="number" className="w-20 text-right border border-slate-200 rounded p-1"
                                    value={addOnCost} onChange={(e) => setAddOnCost(parseInt(e.target.value) || 0)}/>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 flex items-center"><Truck size={14} className="mr-1"/> ค่าขนส่ง</span>
                            <input type="number" className="w-20 text-right border border-slate-200 rounded p-1"
                                    value={shippingCost} onChange={(e) => setShippingCost(parseInt(e.target.value) || 0)}/>
                        </div>
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span>ส่วนลด</span>
                            <div className="flex items-center">
                                - <input type="number" className="w-20 text-right border border-red-200 text-red-600 rounded p-1 ml-1"
                                    value={discount} onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}/>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 my-2"></div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-sm text-slate-600 flex items-center cursor-pointer">
                                <input type="checkbox" className="mr-2" checked={isVatIncluded} onChange={e => setIsVatIncluded(e.target.checked)}/>
                                ราคารวม VAT 7% แล้ว
                             </label>
                             <span className="text-xs text-slate-400">{isVatIncluded ? "(Inc. VAT)" : "(Exc. VAT)"}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>VAT (7%)</span>
                            <span>{vatAmount.toLocaleString(undefined, {maximumFractionDigits:2})} ฿</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-blue-700 mt-2 p-3 bg-blue-50 rounded-lg">
                            <span>ยอดสุทธิ</span>
                            <span>{grandTotal.toLocaleString(undefined, {maximumFractionDigits:2})} ฿</span>
                        </div>
                        <div className="pt-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-semibold text-slate-700 flex items-center"><CreditCard size={14} className="mr-1"/> หักมัดจำ</span>
                                <input type="number" className="w-24 text-right border border-slate-300 rounded p-1 font-semibold text-slate-700"
                                    placeholder="ใส่ยอดมัดจำ" value={deposit} onChange={(e) => setDeposit(parseInt(e.target.value) || 0)}/>
                            </div>
                            <div className="flex justify-between text-base font-bold text-rose-600">
                                <span>ยอดคงเหลือ (Balance)</span>
                                <span>{balance.toLocaleString(undefined, {maximumFractionDigits:2})} ฿</span>
                            </div>
                        </div>
                    </div>

                    {role === 'owner' && (
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg mb-4 text-xs">
                             <div className="flex justify-between text-emerald-800 font-bold">
                                <span>กำไรโดยประมาณ (Est. Profit):</span>
                                <span>+ {estimatedProfit.toLocaleString(undefined, {maximumFractionDigits:2})} ฿</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <button 
                            className="flex items-center justify-center bg-white border border-slate-300 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-50 transition"
                            onClick={() => setShowPreview(true)}
                        >
                            <Printer className="mr-2" size={18}/> Preview ใบงาน
                        </button>
                        <button 
                            className="flex items-center justify-center bg-white border border-slate-300 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-50 transition"
                            onClick={handleCopySummary}
                        >
                            <Copy className="mr-2" size={18}/> Copy สรุปยอด
                        </button>
                    </div>

                    <button 
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-lg transition mb-2 flex justify-center items-center"
                        onClick={handleSaveOrder} // <--- เรียกฟังก์ชันแสดง Popup
                    >
                        <Save className="mr-2" size={18}/> บันทึกออเดอร์
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

// 2.3 หน้าจัดการสินค้า
const ProductPage = () => {
  const [activeTab, setActiveTab] = useState("fabric"); 
  const TabButton = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)}
      className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === id ? "border-blue-600 text-blue-600 bg-blue-50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
      {label}
    </button>
  );
  return (
    <div className="p-4 md:p-8 fade-in overflow-y-auto pb-20 md:pb-8">
      <header className="mb-8 flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-800">จัดการข้อมูลสินค้า (Master Data)</h1><p className="text-slate-500 text-sm">ตั้งค่าตัวเลือกสินค้า ผ้า, คอ, แขน ที่จะแสดงในหน้าออเดอร์</p></div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 shadow-sm whitespace-nowrap ml-2"><Plus size={18} className="mr-2"/> เพิ่มข้อมูลใหม่</button>
      </header>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
            <TabButton id="fabric" label="ชนิดผ้า (Fabrics)" /><TabButton id="neck" label="รูปแบบคอ (Necks)" /><TabButton id="sleeve" label="รูปแบบแขน (Sleeves)" />
        </div>
        <div className="p-6 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead><tr className="text-slate-500 text-sm border-b border-slate-100"><th className="py-3 px-4 font-medium">ชื่อรายการ</th><th className="py-3 px-4 font-medium">ราคาบวกเพิ่ม</th><th className="py-3 px-4 font-medium text-center">สถานะ</th><th className="py-3 px-4 font-medium text-right">จัดการ</th></tr></thead>
                <tbody className="text-sm">
                    {activeTab === 'fabric' ? MOCK_PRODUCTS.fabrics.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-50 group">
                            <td className="py-4 px-4 font-medium text-slate-700">{item.name}</td>
                            <td className="py-4 px-4 text-slate-600">{item.price > 0 ? `+${item.price} ฿` : '-'}</td>
                            <td className="py-4 px-4 text-center"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">Active</span></td>
                            <td className="py-4 px-4 text-right"><button className="text-slate-400 hover:text-blue-600 mx-2"><Edit size={16}/></button><button className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                        </tr>
                    )) : <tr><td colSpan="4" className="py-12 text-center text-slate-400"><Box className="mx-auto mb-2 opacity-50" size={48}/>แสดงข้อมูลของหมวด {activeTab}... (Mockup)</td></tr>}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

// 2.4 หน้าจัดการลูกค้า
const CustomerPage = () => {
  return (
    <div className="p-4 md:p-8 fade-in overflow-y-auto pb-20 md:pb-8">
      <header className="mb-8 flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-800">จัดการลูกค้า (Customers)</h1><p className="text-slate-500 text-sm">รายชื่อลูกค้าทั้งหมดและประวัติการสั่งซื้อ</p></div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 shadow-sm whitespace-nowrap ml-2"><Plus size={18} className="mr-2"/> เพิ่มลูกค้าใหม่</button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center"><div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4"><User size={24}/></div><div><p className="text-slate-500 text-xs">ลูกค้าทั้งหมด</p><p className="text-2xl font-bold text-slate-800">1,240</p></div></div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center"><div className="p-3 rounded-full bg-emerald-50 text-emerald-600 mr-4"><CheckCircle size={24}/></div><div><p className="text-slate-500 text-xs">Active (เดือนนี้)</p><p className="text-2xl font-bold text-slate-800">85</p></div></div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex space-x-4">
          <div className="flex-1 relative"><Search className="absolute left-3 top-3 text-slate-400" size={20}/><input type="text" placeholder="ค้นหาชื่อ, เบอร์โทร, LINE ID..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/></div>
          <button className="px-4 py-2 border border-slate-300 rounded-lg flex items-center text-slate-600 hover:bg-slate-50"><Filter size={18} className="mr-2"/> Filter</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50"><tr className="text-slate-500 text-sm"><th className="py-4 px-6 font-medium">ชื่อลูกค้า / บริษัท</th><th className="py-4 px-6 font-medium">ช่องทางติดต่อ</th><th className="py-4 px-6 font-medium">ยอดสั่งซื้อ</th><th className="py-4 px-6 font-medium">ล่าสุด</th><th className="py-4 px-6 font-medium text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {MOCK_CUSTOMERS.map((cust) => (
                        <tr key={cust.id} className="hover:bg-blue-50/50 transition cursor-pointer">
                            <td className="py-4 px-6"><p className="font-semibold text-slate-700">{cust.name}</p><p className="text-xs text-slate-400 flex items-center mt-1"><MapPin size={12} className="mr-1"/> กรุงเทพมหานคร</p></td>
                            <td className="py-4 px-6"><div className="flex flex-col text-sm"><span className="flex items-center text-slate-700 mb-1">{cust.channel === 'LINE OA' ? <MessageCircle size={14} className="mr-2 text-green-500"/> : <Phone size={14} className="mr-2 text-slate-500"/>}{cust.channel}</span><span className="text-slate-500 ml-6">{cust.phone}</span></div></td>
                            <td className="py-4 px-6"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{cust.orders} ออเดอร์</span></td>
                            <td className="py-4 px-6 text-sm text-slate-600">{cust.lastOrder}</td>
                            <td className="py-4 px-6 text-right"><button className="text-slate-400 hover:text-blue-600 p-2"><Edit size={18}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

// --- 3. MAIN APP (Sidebar & Routing & Auth) ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Auth State
  const [currentPage, setCurrentPage] = useState('dashboard'); // Default to Dashboard after login
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Sidebar State

  // 1. Check Login
  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  // 2. Render Page Content
  const renderContent = () => {
    switch(currentPage) {
        case 'dashboard': return <DashboardPage />;
        case 'product': return <ProductPage />;
        case 'customer': return <CustomerPage />;
        case 'order': default: return <OrderCreationPage />;
    }
  };

  const handleNavClick = (page) => {
      setCurrentPage(page);
      setIsSidebarOpen(false); // Close sidebar on mobile after click
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800 flex flex-col md:flex-row relative">
       {/* Mobile Header */}
       <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30">
           <span className="font-bold text-lg">B-LOOK ADMIN</span>
           <button onClick={() => setIsSidebarOpen(true)}>
               <Menu size={24} />
           </button>
       </div>

       {/* Sidebar Overlay (Mobile) */}
       {isSidebarOpen && (
           <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
       )}

       {/* Sidebar */}
       <aside className={`
            fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
       `}>
        <div className="p-6 text-xl font-bold tracking-wider border-b border-slate-800 flex justify-between items-center">
            <span>B-LOOK ADMIN</span>
            <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
                <X size={24}/>
            </button>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-6">
          <button onClick={() => handleNavClick('order')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'order' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
            <FileText size={20} /> <span>New Order</span>
          </button>
          
          <button onClick={() => handleNavClick('dashboard')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
            <LayoutDashboard size={20} /> <span>Dashboard</span>
          </button>
          
          <button onClick={() => handleNavClick('product')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'product' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
            <Box size={20} /> <span>Product Master</span>
          </button>
          <button onClick={() => handleNavClick('customer')} className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${currentPage === 'customer' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
            <User size={20} /> <span>Customers</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
            <button 
                onClick={() => setIsLoggedIn(false)} // Logout Logic
                className="w-full flex items-center text-slate-400 hover:text-white transition text-sm p-2 hover:bg-slate-800 rounded"
            >
                <LogOut size={16} className="mr-2"/> Sign Out
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto h-[calc(100vh-60px)] md:h-screen w-full">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;