import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Save, Calculator, AlertCircle, User, Box, FileText, 
  Truck, CreditCard, Tag, LogOut, Search, Plus, Edit, Trash2, 
  CheckCircle, Filter, Phone, MessageCircle, MapPin, XCircle,
  LayoutDashboard, Printer, Copy, Lock, ChevronLeft, ChevronRight, Menu, X, ArrowLeft,
  Download, Settings, DollarSign, ChevronDown, Bell, ShoppingCart, MoreHorizontal, Info, Users
} from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import LoginPage from './Login';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const LOGO_URL = "/logo.jpg"; 

// --- CONSTANTS ---
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

// (ลบส่วน LoginPage เดิมออกทั้งหมด)

// 2.1 DASHBOARD
const DashboardPage = ({ onEdit }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Data States
    const [allOrders, setAllOrders] = useState([]);
    const [stats, setStats] = useState({ 
        newOrdersToday: 0, 
        inProduction: 0, 
        deliveryIn3Days: 0, 
        deliveredThisMonth: 0 
    });
    const [events, setEvents] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [showQueueModal, setShowQueueModal] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orders = await fetchWithAuth('/orders/');
                const data = orders || [];
                setAllOrders(data);
                
                const today = new Date();
                
                const newOrdersToday = data.filter(o => {
                    const created = o.created_at ? new Date(o.created_at) : new Date(o.updated_at); 
                    return created.getDate() === today.getDate() && 
                           created.getMonth() === today.getMonth() && 
                           created.getFullYear() === today.getFullYear();
                }).length;

                const inProduction = data.filter(o => o.status === 'production').length;

                const deliveryIn3Days = data.filter(o => {
                    if (!o.deadline || o.status === 'delivered') return false;
                    const deadline = new Date(o.deadline);
                    const diffTime = deadline - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 3;
                }).length;

                const deliveredThisMonth = data.filter(o => {
                    if (o.status !== 'delivered') return false;
                    const date = o.deadline ? new Date(o.deadline) : new Date(); 
                    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                }).length;

                setStats({ newOrdersToday, inProduction, deliveryIn3Days, deliveredThisMonth });

                const mappedEvents = data.map(o => {
                    if (!o.deadline) return null;
                    const d = new Date(o.deadline);
                    return {
                        id: o.id,
                        day: d.getDate(),
                        month: d.getMonth(),
                        year: d.getFullYear(),
                        title: o.customer_name,
                        type: 'delivery',
                        status: o.status || 'pending',
                        order_no: o.order_no
                    };
                }).filter(e => e !== null);

                setEvents(mappedEvents.filter(e => e.month === currentDate.getMonth() && e.year === currentDate.getFullYear()));

                const urgencyAlerts = data.filter(o => o.status === 'urgent').map(o => ({
                    type: 'CRITICAL', title: `งานด่วน: ${o.order_no}`, desc: `ส่ง: ${o.customer_name}`
                }));
                setAlerts(urgencyAlerts);

            } catch (err) {
                console.error("Dashboard Fetch Error", err);
            }
        };
        fetchData();
    }, [currentDate]);

    const eventsByDay = events.reduce((acc, evt) => {
        acc[evt.day] = [...(acc[evt.day] || []), evt];
        return acc;
    }, {});
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const MetricCard = ({ title, value, color }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 hover:shadow-md transition">
            <h3 className="text-gray-500 font-bold text-sm">{title}</h3>
            <div className={`text-4xl font-black ${color}`}>{value}</div>
        </div>
    );

    // Filter production orders for modal
    const productionOrders = allOrders.filter(o => o.status === 'production');

    return (
        <div className="p-6 md:p-10 fade-in h-full flex flex-col bg-[#f0f2f5] overflow-y-auto">
            {/* Queue Modal */}
            {showQueueModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                <Box className="text-[#1a1c23]" />
                                <h3 className="text-xl font-bold text-[#1a1c23]">รายการรอจัดส่ง</h3>
                            </div>
                            <button onClick={() => setShowQueueModal(false)} className="bg-white p-2 rounded-full border shadow-sm hover:bg-gray-100 transition"><XCircle size={24} className="text-slate-500"/></button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-white text-xs font-bold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-4 w-1/4">เลขที่ออเดอร์</th>
                                        <th className="p-4 w-1/4">ลูกค้า</th>
                                        <th className="p-4 w-1/4">กำหนดส่ง</th>
                                        <th className="p-4 w-1/4 text-right">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {productionOrders.map(o => (
                                        <tr key={o.id} className="hover:bg-blue-50/50 transition">
                                            <td className="p-4 font-mono font-bold text-sm text-[#1a1c23]">{o.order_no}</td>
                                            <td className="p-4 text-sm text-gray-700">{o.customer_name}</td>
                                            <td className="p-4 text-sm text-gray-500">{o.deadline ? new Date(o.deadline).toLocaleDateString('th-TH') : '-'}</td>
                                            <td className="p-4 text-right">
                                                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-amber-200">
                                                    กำลังผลิต/รอส่ง
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {productionOrders.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                                <CheckCircle size={48} className="mb-2 opacity-20"/>
                                                ไม่มีรายการที่รอจัดส่ง
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                            <button onClick={() => setShowQueueModal(false)} className="bg-[#1a1c23] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg">ปิดหน้าต่าง</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-[#1a1c23] tracking-tight leading-tight mb-2">
                    สวัสดี, ภาพรวมร้านค้าของคุณ
                </h1>
                <p className="text-gray-500">ยินดีต้อนรับสู่ระบบจัดการ B-LOOK</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard title="ออเดอร์ใหม่ (วันนี้)" value={stats.newOrdersToday} color="text-blue-600" />
                <MetricCard title="กำลังผลิต" value={stats.inProduction} color="text-amber-500" />
                <MetricCard title="ต้องส่งภายใน 3 วัน" value={stats.deliveryIn3Days} color="text-rose-600" />
                <MetricCard title="ส่งมอบแล้ว (เดือนนี้)" value={stats.deliveredThisMonth} color="text-emerald-600" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-[#1a1c23]">ตารางการผลิต</h3>
                            <p className="text-xs text-gray-400">ติดตามกำหนดส่งสินค้า</p>
                        </div>
                        <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white rounded-md shadow-sm transition"><ChevronLeft size={16}/></button>
                            <span className="text-sm font-bold text-gray-700 min-w-[100px] text-center">
                                {currentDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white rounded-md shadow-sm transition"><ChevronRight size={16}/></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <div className="min-w-[600px]">
                            <div className="grid grid-cols-7 mb-2">
                                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                                    <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} className="h-24"></div>)}
                                {[...Array(daysInMonth)].map((_, i) => {
                                    const day = i + 1;
                                    const evts = eventsByDay[day] || [];
                                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                                    return (
                                        <div key={day} className={`h-24 border border-gray-100 rounded-xl p-2 relative hover:border-blue-200 transition group flex flex-col ${isToday ? 'bg-blue-50/50 border-blue-200' : 'bg-white'}`}>
                                            <span className={`text-sm font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>{day}</span>
                                            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                                {evts.map((e, idx) => (
                                                    <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                                                        e.status === 'urgent' ? 'bg-rose-100 text-rose-700' : 
                                                        e.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`} title={e.title}>
                                                        {e.title}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                        <div className="mb-4 flex items-center justify-between">
                             <h3 className="text-lg font-bold text-[#1a1c23]">แจ้งเตือน</h3>
                             <span className="bg-rose-100 text-rose-600 text-xs px-2 py-1 rounded-full font-bold">{alerts.length}</span>
                        </div>
                        <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                            {alerts.length > 0 ? alerts.map((alert, i) => (
                                <div key={i} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="bg-rose-100 p-2 rounded-full text-rose-500 shrink-0">
                                        <AlertCircle size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{alert.title}</p>
                                        <p className="text-xs text-gray-500">{alert.desc}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-gray-400 text-sm">ไม่มีการแจ้งเตือนด่วน</div>
                            )}
                        </div>
                        <button className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-900 border rounded-lg hover:bg-gray-50 transition">ดูทั้งหมด</button>
                    </div>

                    <div className="bg-[#1a1c23] rounded-3xl shadow-lg p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-1">จัดการคิวงาน</h3>
                            <p className="text-xs text-gray-400 mb-4">ตรวจสอบงานที่พร้อมส่งมอบ</p>
                            <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl backdrop-blur-sm mb-4">
                                <div className="flex items-center space-x-3">
                                    <Box size={20} className="text-blue-400"/>
                                    <span className="text-sm font-medium">รอจัดส่ง</span>
                                </div>
                                <span className="text-xl font-bold">{productionOrders.length}</span>
                            </div>
                            <button 
                                onClick={() => setShowQueueModal(true)}
                                className="w-full bg-white text-[#1a1c23] py-2.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition shadow-md"
                            >
                                ดูรายละเอียด
                            </button>
                        </div>
                        <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-[-10%] left-[-10%] w-24 h-24 bg-purple-500/20 rounded-full blur-2xl"></div>
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
              <Printer size={18} className="mr-2"/> พิมพ์ / บันทึก PDF
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

// 2.2 ORDER CREATION PAGE
const OrderCreationPage = ({ onNavigate, editingOrder, onNotify }) => {
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
    
  const [fabrics, setFabrics] = useState([]);
  const [necks, setNecks] = useState([]);
  const [sleeves, setSleeves] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
  const [selectedNeck, setSelectedNeck] = useState("");
  const [selectedSleeve, setSelectedSleeve] = useState("");
  const [pricingRules, setPricingRules] = useState([]);
   
  const [config, setConfig] = useState({ vat_rate: 0.07, default_shipping_cost: 0 });

  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

  const productSubtotal = totalQty * basePrice;
  const totalBeforeCalc = productSubtotal + addOnCost + shippingCost - discount;
    
  let vatAmount = 0, grandTotal = 0;
  if (isVatIncluded) {
    grandTotal = totalBeforeCalc;
    vatAmount = (totalBeforeCalc * (config.vat_rate * 100)) / (100 + (config.vat_rate * 100));
  } else {
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
        onNotify("บันทึกไม่สำเร็จ: " + e.message, "error");
    }
  };

  const handleCopySummary = () => {
    const text = `📋 Order Summary\nCustomer: ${customerName}\nTotal: ${totalQty} pcs\nGrand Total: ${grandTotal.toLocaleString()} THB`;
    navigator.clipboard.writeText(text);
    onNotify("คัดลอกข้อมูลเรียบร้อยแล้ว", "success");
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
             <h1 className="text-2xl font-black text-[#1a1c23]">{editingOrder ? "แก้ไขออเดอร์" : "สร้างออเดอร์ใหม่"}</h1>
             <div className={`px-4 py-2 rounded-lg ml-auto ${theme[urgencyStatus].header}`}><AlertCircle size={20} className="inline mr-2"/>{urgencyStatus.toUpperCase()}</div>
        </header>

        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6 flex items-center text-gray-800"><User className="mr-2" size={18}/> ข้อมูลลูกค้า</h3>
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
                        <button className="py-2 text-xs font-bold text-gray-500 border rounded-lg hover:bg-gray-50" onClick={() => setShowPreview(true)}>ดูตัวอย่าง</button>
                        <button className="py-2 text-xs font-bold text-gray-500 border rounded-lg hover:bg-gray-50" onClick={handleCopySummary}>คัดลอก</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

// 2.3 PRODUCT PAGE
const ProductPage = () => {
  const [activeTab, setActiveTab] = useState("ชนิดผ้า"); 
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", quantity: 0, cost_price: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchItems = useCallback(async () => {
      setLoading(true);
      try {
          const endpoint = activeTab === 'ชนิดผ้า' ? '/products/fabrics' : activeTab === 'รูปแบบคอ' ? '/products/necks' : '/products/sleeves';
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
          const endpoint = activeTab === 'ชนิดผ้า' ? '/products/fabrics' : activeTab === 'รูปแบบคอ' ? '/products/necks' : '/products/sleeves';
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
          const endpoint = activeTab === 'ชนิดผ้า' ? '/products/fabrics' : activeTab === 'รูปแบบคอ' ? '/products/necks' : '/products/sleeves';
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
          const endpoint = activeTab === 'ชนิดผ้า' ? '/products/fabrics' : activeTab === 'รูปแบบคอ' ? '/products/necks' : '/products/sleeves';
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
            <h1 className="text-3xl font-black text-[#1a1c23]">สินค้า</h1>
            <p className="text-gray-500 font-medium">จัดการผ้าและวัตถุดิบ</p>
        </div>
        <button onClick={openAddModal} className="bg-[#1a1c23] text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg">
            <Plus size={18} className="mr-2"/> เพิ่มสินค้า
        </button>
      </header>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-gray-100 overflow-x-auto">
            <TabButton id="ชนิดผ้า" label="ชนิดผ้า" />
            <TabButton id="รูปแบบคอ" label="รูปแบบคอ" />
            <TabButton id="รูปแบบแขน" label="รูปแบบแขน" />
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

// 2.4 CUSTOMER PAGE
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
            <h1 className="text-3xl font-black text-[#1a1c23]">ลูกค้า</h1>
            <p className="text-gray-500 font-medium">จัดการข้อมูลลูกค้า</p>
        </div>
        <button onClick={openAddModal} className="bg-[#1a1c23] text-white px-6 py-2.5 rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg"><Plus size={18} className="mr-2"/> เพิ่มลูกค้า</button>
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

// 2.5 ORDER LIST PAGE (UPDATED: Toast & Table Layout)
const OrderListPage = ({ onNavigate, onEdit, filterType = 'all', onNotify }) => {
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
    return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase">ร่าง</span>;
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
      if (filteredOrders.length === 0) { 
          onNotify("ไม่มีข้อมูลสำหรับ Export", "error"); 
          return; 
      }
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
            <h1 className="text-3xl font-black text-[#1a1c23]">รายการออเดอร์</h1>
            <p className="text-gray-500 font-medium">จัดการและติดตามสถานะการผลิต</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="ค้นหา..." 
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
                    <Plus size={18} className="mr-2"/> สร้างใหม่
                </button>
            </div>
        </div>
      </header>
        
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="p-0 md:p-2 overflow-x-auto">
            {loading ? <p className="text-center text-slate-500 py-10">Loading...</p> : (
                <table className="w-full text-left min-w-[800px] table-fixed">
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
                                <td className="py-4 px-6 font-mono font-bold text-gray-700 truncate">{order.order_no}</td>
                                <td className="py-4 px-6 text-gray-700 truncate">
                                    <div className="font-medium truncate">{order.customer_name}</div>
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


// 2.6 SETTINGS PAGE (UPDATED: Delete Modal & Save Notify)
const SettingsPage = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState("pricing");
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
   
  // Pricing Rule State
  const [newRule, setNewRule] = useState({ min_qty: 0, max_qty: 0, fabric_type: "", unit_price: 0 });
  const [fabrics, setFabrics] = useState([]); 
  const [deleteConfirm, setDeleteConfirm] = useState(null); // State for delete modal

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
        onNotify("เพิ่มเงื่อนไขราคาสำเร็จ", "success");
    } catch (e) { onNotify("เพิ่มเงื่อนไขราคาไม่สำเร็จ: " + e.message, "error"); }
  };

  const confirmDeleteRule = async () => {
    if (!deleteConfirm) return;
    try {
        await fetchWithAuth(`/pricing-rules/${deleteConfirm.id}`, { method: 'DELETE' });
        const rules = await fetchWithAuth('/pricing-rules/');
        setPricingRules(rules || []);
        onNotify("ลบข้อมูลเรียบร้อยแล้ว", "success");
    } catch (e) { onNotify("ลบข้อมูลไม่สำเร็จ", "error"); }
    finally { setDeleteConfirm(null); }
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
          onNotify("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
      } catch(e) { onNotify("บันทึกการตั้งค่าไม่สำเร็จ: " + e.message, "error"); }
  }

  return (
    <div className="p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
      {/* Delete Modal */}
      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <div className="flex items-center mb-4">
                      <AlertCircle className="text-rose-500 mr-3" size={24} />
                      <h3 className="text-lg font-bold">ยืนยันการลบ?</h3>
                  </div>
                  <p className="text-slate-600 mb-6">คุณต้องการลบเงื่อนไขราคานี้ใช่หรือไม่?</p>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition">ยกเลิก</button>
                      <button onClick={confirmDeleteRule} className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition">ลบ</button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-black text-[#1a1c23]">ตั้งค่าระบบ</h1>
        <p className="text-gray-500 font-medium">กำหนดราคาและค่าเริ่มต้นของระบบ</p>
      </header>

      <div className="flex gap-6 mb-6 border-b border-gray-200">
          <button onClick={() => setActiveTab("pricing")} className={`pb-3 font-bold text-sm border-b-2 transition ${activeTab==="pricing" ? "border-[#1a1c23] text-[#1a1c23]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
             ตั้งราคาขาย
          </button>
          <button onClick={() => setActiveTab("general")} className={`pb-3 font-bold text-sm border-b-2 transition ${activeTab==="general" ? "border-[#1a1c23] text-[#1a1c23]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
             VAT & ค่าส่ง
          </button>
      </div>

      {activeTab === "pricing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form เพิ่มกฎ */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
                  <h3 className="font-bold text-lg mb-4 text-[#1a1c23]">เพิ่มเงื่อนไขราคา</h3>
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
                      <button onClick={handleAddRule} className="w-full bg-[#1a1c23] text-white py-3 rounded-xl hover:bg-slate-800 font-bold shadow-lg">บันทึก</button>
                  </div>
              </div>

              {/* Table รายการกฎ */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 font-bold text-[#1a1c23]">ตารางราคาปัจจุบัน</div>
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100 uppercase font-bold text-xs">
                          <tr>
                              <th className="p-4 pl-6">ชนิดผ้า</th>
                              <th className="p-4">จำนวน (ตัว)</th>
                              <th className="p-4 text-right">ราคา/ตัว</th>
                              <th className="p-4 text-right pr-6">จัดการ</th>
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
                                          {rule.min_qty} - {rule.max_qty > 9999 ? 'ขึ้นไป' : rule.max_qty}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right font-bold text-[#1a1c23]">{rule.unit_price} ฿</td>
                                  <td className="p-4 text-right pr-6">
                                      <button onClick={() => setDeleteConfirm(rule)} className="text-gray-400 hover:text-rose-500 transition"><Trash2 size={16}/></button>
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
                  <h3 className="text-xl font-bold text-[#1a1c23]">ตั้งค่าทั่วไป</h3>
                  <p className="text-gray-500 text-sm">กำหนดค่าเริ่มต้นสำหรับทั้งระบบ</p>
              </div>
               
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">อัตรา VAT (%)</label>
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
                      <label className="block text-sm font-bold text-slate-700 mb-2">ค่าส่งเริ่มต้น (บาท)</label>
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
                      บันทึกการตั้งค่า
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

// 2.7 USER MANAGEMENT PAGE
const UserManagementPage = ({ onNotify }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await fetchWithAuth('/admin/users');
            if (data) setUsers(data);
        } catch (error) {
            onNotify("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleUpdateRole = async (userId, newRole) => {
        try {
            await fetchWithAuth(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole, is_active: true })
            });
            onNotify("อัปเดตสิทธิ์เรียบร้อยแล้ว", "success");
            fetchUsers();
        } catch (error) {
            onNotify("อัปเดตไม่สำเร็จ: " + error.message, "error");
        }
    };

    const getRoleBadge = (role) => {
        switch(role) {
            case 'owner': return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold border border-purple-200">Owner</span>;
            case 'admin': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold border border-blue-200">Admin</span>;
            case 'user': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold border border-emerald-200">General User</span>;
            case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center w-fit mx-auto"><Lock size={10} className="mr-1"/> รออนุมัติ</span>;
            default: return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs">Unknown</span>;
        }
    };

    return (
        <div className="p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-[#1a1c23]">จัดการผู้ใช้งาน</h1>
                <p className="text-gray-500 font-medium">อนุมัติและกำหนดสิทธิ์การเข้าถึง</p>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                <div className="p-2 md:p-6 overflow-x-auto">
                    {loading ? <p className="text-center py-10 text-gray-400">Loading...</p> : (
                        <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="py-4 px-6">ชื่อผู้ใช้ / Email</th>
                                    <th className="py-4 px-6">ชื่อ-นามสกุล</th>
                                    <th className="py-4 px-6 text-center">สถานะปัจจุบัน</th>
                                    <th className="py-4 px-6 text-right">เปลี่ยนสิทธิ์</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition">
                                        <td className="py-4 px-6 font-bold text-gray-700">{u.username}</td>
                                        <td className="py-4 px-6 text-sm text-gray-600">{u.full_name || "-"}</td>
                                        <td className="py-4 px-6 text-center">{getRoleBadge(u.role)}</td>
                                        <td className="py-4 px-6 text-right">
                                            <select 
                                                className={`border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1a1c23] outline-none cursor-pointer hover:border-gray-300 transition ${u.role === 'pending' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}
                                                value={u.role}
                                                onChange={(e) => {
                                                    if (window.confirm(`ยืนยันการเปลี่ยนสิทธิ์เป็น ${e.target.value}?`)) {
                                                        handleUpdateRole(u.id, e.target.value);
                                                    }
                                                }}
                                                disabled={u.role === 'owner'} 
                                            >
                                                <option value="pending">Pending (รออนุมัติ)</option>
                                                <option value="user">General User</option>
                                                <option value="admin">Admin</option>
                                                <option value="owner" disabled>Owner</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 3. MAIN APP (Revised Sidebar & Routing) ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || 'user'); // Add State for Role
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
   
  const [notification, setNotification] = useState(null);

  useEffect(() => {
        const link = document.querySelector("link[rel~='icon']");
        if (!link) {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = LOGO_URL;
            document.head.appendChild(newLink);
        } else {
            link.href = LOGO_URL;
        }
        document.title = "B-LOOK Admin";
        
        // Check Role on Load
        setUserRole(localStorage.getItem('user_role') || 'user');
  }, [isLoggedIn]);

  if (!isLoggedIn) return <LoginPage onLogin={(role) => {
      setIsLoggedIn(true);
      setUserRole(role);
  }} />;

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

  const handleNotify = (message, type = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const renderContent = () => {
    switch(currentPage) {
        case 'dashboard': return <DashboardPage onEdit={handleEditOrder} />;
        case 'order_list': return <OrderListPage onNavigate={handleNavigate} onEdit={handleEditOrder} onNotify={handleNotify} />;
        case 'settings': return <SettingsPage onNotify={handleNotify} />;
        case 'create_order': return <OrderCreationPage onNavigate={handleNavigate} editingOrder={editingOrder} onNotify={handleNotify} />;
        case 'product': return <ProductPage />;
        case 'customer': return <CustomerPage />;
        case 'users': return <UserManagementPage onNotify={handleNotify} />; // <--- เพิ่ม Route นี้
        default: return <OrderListPage onNavigate={handleNavigate} onEdit={handleEditOrder} onNotify={handleNotify} />;
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
       {/* Toast Notification */}
       {notification && (
           <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-5 ${notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'}`}>
               {notification.type === 'success' ? <CheckCircle size={24} className="text-emerald-400" /> : <AlertCircle size={24} className="text-white" />}
               <span className="font-medium text-lg">{notification.message}</span>
           </div>
       )}

       {/* Mobile Header */}
       <div className="md:hidden bg-[#1a1c23] text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-lg">
           <div className="flex items-center gap-2">
                <img src={LOGO_URL} alt="Logo" className="w-8 h-8 rounded-full"/>
                <span className="font-bold text-lg tracking-tight">B-LOOK</span>
           </div>
           <button onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
       </div>
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

       {/* Sidebar (Dark Theme) */}
       <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#1a1c23] text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl border-r border-gray-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-full border-2 border-white/20"/>
                    <span className="font-black text-xl tracking-tight text-white">B-LOOK</span>
                </div>
                <button className="md:hidden text-gray-500 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
            </div>
            
            <nav className="flex-1 px-4 space-y-2 mt-4">
                <NavItem id="dashboard" icon={LayoutDashboard} label="หน้าหลัก" active={currentPage === 'dashboard'} />
                <NavItem id="create_order" icon={DollarSign} label="สร้างออเดอร์ใหม่" active={currentPage === 'create_order'} />
                <NavItem id="order_list" icon={FileText} label="รายการออเดอร์" active={currentPage === 'order_list'} />
                <NavItem id="product" icon={ShoppingCart} label="สินค้า" active={currentPage === 'product'} />
                <NavItem id="customer" icon={User} label="ลูกค้า" active={currentPage === 'customer'} />
                
                {/* --- แสดงเฉพาะ Admin หรือ Owner --- */}
                {(userRole === 'admin' || userRole === 'owner') && (
                    <NavItem id="users" icon={Users} label="จัดการผู้ใช้" active={currentPage === 'users'} />
                )}
                
                <NavItem id="settings" icon={Settings} label="ตั้งค่าระบบ" active={currentPage === 'settings'} />
            </nav>

            {/* Profile Section */}
            <div className="p-6 border-t border-gray-800">
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('user_role'); setIsLoggedIn(false); }}>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#d4e157] rounded-full flex items-center justify-center text-[#1a1c23] font-bold text-sm shadow-md group-hover:scale-105 transition">
                            {userRole.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white group-hover:text-[#d4e157] transition capitalize">{userRole}</div>
                            <div className="text-[10px] text-gray-500">ออกจากระบบ</div>
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