import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, Save, Calculator, AlertCircle, User, Box, FileText, 
  Truck, CreditCard, Tag, LogOut, Search, Plus, Edit, Trash2, 
  CheckCircle, Filter, Phone, MessageCircle, MapPin, XCircle,
  LayoutDashboard, Printer, Copy, Lock, ChevronLeft, ChevronRight, Menu, X, ArrowLeft,
  Download, Settings, DollarSign, ChevronDown, Bell, ShoppingCart, MoreHorizontal, Info, Users, Clock, FileClock, Flag
} from 'lucide-react';
import LoginPage from './login';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const LOGO_URL = "/logo.jpg"; 

// 🆕 Application version for cache busting
const APP_VERSION = "2026.02.06.1649";

// 🆕 Check and clear localStorage if version mismatch (run once on load)
(() => {
    const storedVersion = localStorage.getItem('appVersion');
    if (storedVersion !== APP_VERSION) {
        console.log('🔄 Version update detected. Clearing potentially corrupted cache...');
        console.log(`   Old: ${storedVersion} → New: ${APP_VERSION}`);
        
        // Remove potentially corrupted data
        const itemsToRemove = ['neckTypes', 'fabricTypes', 'sleeveTypes'];
        itemsToRemove.forEach(item => {
            if (localStorage.getItem(item)) {
                console.log(`   ✓ Removed: ${item}`);
                localStorage.removeItem(item);
            }
        });
        
        // Update version
        localStorage.setItem('appVersion', APP_VERSION);
        console.log('✅ Cache cleaned. Please refresh if you see old data.');
    }
})();

// --- CONSTANTS ---
const BRANDS = ["BG (B.Look Garment)", "Jersey Express"];
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

const PRODUCT_TYPES = [
    { id: 'shirt', label: 'เสื้อพิมพ์ลาย' },
    { id: 'sportsPants', label: 'กางเกงกีฬา' },
    { id: 'fashionPants', label: 'กางเกงแฟชั่น' }
];

// Step Pricing by Quantity and Collar Type
const STEP_PRICING = {
  // คอกลม/วี - Round/V-neck
  roundVNeck: [
    { minQty: 10, maxQty: 30, price: 240 },
    { minQty: 31, maxQty: 50, price: 220 },
    { minQty: 51, maxQty: 100, price: 190 },
    { minQty: 101, maxQty: 300, price: 180 },
    { minQty: 301, maxQty: 99999, price: 170 } // > 300 ตัว
  ],
  // คอปก/อื่นๆ - Collar/Others
  collarOthers: [
    { minQty: 10, maxQty: 30, price: 300 },
    { minQty: 31, maxQty: 50, price: 260 },
    { minQty: 51, maxQty: 100, price: 240 },
    { minQty: 101, maxQty: 300, price: 220 },
    { minQty: 301, maxQty: 99999, price: 200 } // > 300 ตัว
  ],
  // กางเกงกีฬา - Sports Pants
  sportsPants: 210,
  // กางเกงแฟชั่น - Fashion Pants
  fashionPants: 280
};

// Add-on Options default (fallback) - will be replaced by backend data on load
const ADDON_OPTIONS = [
    { id: 'longSleeve', name: 'แขนยาว', price: 40 },
    { id: 'pocket', name: 'กระเป๋า', price: 20 },
    { id: 'numberName', name: 'รันเบอร์/ชื่อ', price: 20 },
    { id: 'slopeShoulder', name: 'ไหล่สโลป', price: 40 },
    { id: 'collarTongue', name: 'คอมีลิ้น', price: 10 },
    { id: 'shortSleeveAlt', name: 'แขนจิ้ม', price: 20 },
    { id: 'oversizeSlopeShoulder', name: 'ทรงโอเวอร์ไซส์ไหล่สโลป', price: 60 }
];

// State: addon definitions loaded from backend (authoritative)
// NOTE: moved into `App` component to satisfy React Hooks rules.

const buildAddOnOptionsState = (defs) => (defs || []).reduce((acc, opt) => ({ ...acc, [opt.id]: false }), {});

// Default Shipping Cost Table by Quantity (บาทรวม)
const DEFAULT_SHIPPING_COST_TABLE = [
  { minQty: 10, maxQty: 15, cost: 60 },
  { minQty: 16, maxQty: 20, cost: 80 },
  { minQty: 21, maxQty: 30, cost: 100 },
  { minQty: 31, maxQty: 40, cost: 120 },
  { minQty: 41, maxQty: 50, cost: 180 },
  { minQty: 51, maxQty: 70, cost: 200 },
  { minQty: 80, maxQty: 100, cost: 230 }
];

// Helper: Load Shipping Table from localStorage or default
const getShippingCostTable = () => {
  try {
    const stored = localStorage.getItem('shippingCostTable');
    if (stored) return JSON.parse(stored);
  } catch (e) { console.error(e); }
  return DEFAULT_SHIPPING_COST_TABLE;
};

// Helper: Get extra cost per unit for qty > 100
const getExtraShippingCost = () => {
  try {
    const stored = localStorage.getItem('extraShippingCostPerUnit');
    if (stored) return JSON.parse(stored);
  } catch (e) { console.error(e); }
  return 50; // default
};

// Helper function: Calculate Shipping Cost
const _calculateShippingCost = (qty) => {
  if (qty < 10) return 0; // ไม่มีค่าขนส่ง ต่ำกว่า 10 ตัว
  
  const table = getShippingCostTable();
  const extraPerUnit = getExtraShippingCost();
  
  // ค้นหาตามตารางปกติ
  const shippingTier = table.find(tier => qty >= tier.minQty && qty <= tier.maxQty);
  if (shippingTier) return shippingTier.cost;
  
  // ช่วง 71-79 ใช้ราคา 51-70 (200)
  if (qty >= 71 && qty <= 79) return 200;
  
  // ถ้า > 100 ตัว: ราคา 100 ตัว + (qty - 100) * extraPerUnit
  if (qty > 100) {
    const baseCost = 230; // ค่าขนส่ง 100 ตัว
    const extraQty = qty - 100;
    return baseCost + (extraQty * extraPerUnit);
  }
  
    return 0;
};

// Default Neck Types with prices (from image)
const DEFAULT_NECK_TYPES = [
    { id: 1, name: 'คอกลม', extraPrice: 0, priceGroup: 'roundVNeck', supportSlope: true, forceSlope: false },
    { id: 2, name: 'คอวีชน', extraPrice: 0, priceGroup: 'roundVNeck', supportSlope: false, forceSlope: false },
    { id: 3, name: 'คอวีไขว้', extraPrice: 0, priceGroup: 'roundVNeck', supportSlope: false, forceSlope: false },
    { id: 4, name: 'คอวีตัด', extraPrice: 0, priceGroup: 'roundVNeck', supportSlope: true, forceSlope: false },
    { id: 5, name: 'คอวีปก', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: true, forceSlope: false },
    { id: 6, name: 'คอห้าเหลี่ยม', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: false },
    { id: 7, name: 'คอปกคางหมู (มีลิ้น)', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: true },
    { id: 8, name: 'คอหยดนํ้า', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: true },
    { id: 9, name: 'คอห้าเหลี่ยมคางหมู (มีลิ้น)', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: true },
    { id: 10, name: 'คอห้าเหลี่ยมคางหมู (ไม่มีลื่น)', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: true },
    { id: 11, name: 'คอจีน', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: false },
    { id: 12, name: 'คอวีปก (มีลิ้น)', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: false },
    { id: 13, name: 'คอโปโล', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: false },
    { id: 14, name: 'คอวาย', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: false },
    { id: 15, name: 'คอเชิ้ตฐานตั้ง', extraPrice: 0, priceGroup: 'collarOthers', supportSlope: false, forceSlope: false },
];

// Helper: Normalize neck name for matching
// - normalize common misspelling, remove parenthetical annotations (e.g. "(มีลิ้น)")
// - collapse whitespace
const normalizeNeckName = (name) => {
    if (!name) return "";
    let n = String(name || "");
    // normalize misspelling
    n = n.replace(/นํ้า/g, 'น้ำ');
    // remove any parenthesis and their contents which cause duplicate display labels
    // Removed by Admin Request: Show full name with parenthesis
    // collapse multiple spaces and trim
    n = n.replace(/\s+/g, ' ').trim();
    return n;
};

// Helper: detect necks that must force slope shoulder (legacy flag)
const isForceSlopeNeck = (name) => {
        if (!name) return false;
        const n = normalizeNeckName(name);
        // base keywords that indicate forced slope
        const forceKeys = ['คอปกคางหมู', 'คอหยด', 'คอห้าเหลี่ยมคางหมู'];
        return forceKeys.some(k => n.includes(k));
};

// Special necks that should show price as 300 + slope add-on (40)
const SPECIAL_NECKS_FORCE_340_UI = [
    'คอปกคางหมู',
    'คอหยดน้ำ',
    'คอห้าเหลี่ยมคางหมู'
];

// Helper: Load Neck Types from localStorage or default (merge to keep new items/prices)
const getNeckTypes = () => {
    try {
        const stored = localStorage.getItem('neckTypes');
        if (stored) {
            let storedList = JSON.parse(stored);
            // Clean stored names to remove any appended UI annotations or parentheticals
            storedList = storedList.map(it => ({ ...it, name: normalizeNeckName(it?.name) }));
            
            // ⚠️ VALIDATION: Check if any neck has corrupted extraPrice (> 100)
            const hasCorruptData = storedList.some(item => 
                item?.extraPrice && item.extraPrice > 100
            );
            
            if (hasCorruptData) {
                console.error("🧹 Detected corrupt neckTypes data in localStorage. Cleaning...");
                localStorage.removeItem('neckTypes');
                return DEFAULT_NECK_TYPES;
            }
            
            const merged = [...DEFAULT_NECK_TYPES].map(it => ({ ...it, name: normalizeNeckName(it.name) }));

            storedList.forEach((item) => {
                const storedName = normalizeNeckName(item?.name);
                const existingIndex = merged.findIndex(
                    (n) => normalizeNeckName(n.name) === storedName
                );

                if (existingIndex >= 0) {
                    const normalizedName = merged[existingIndex].name || item?.name || "";
                    const isTongueNeck = normalizedName.includes('มีลิ้น');
                    merged[existingIndex] = {
                        ...merged[existingIndex],
                        ...item,
                        name: normalizeNeckName(merged[existingIndex].name),
                        // ⚠️ Clamp extraPrice to safe range (0-100)
                        extraPrice: isTongueNeck ? 0 : Math.min(Math.max(item.extraPrice || 0, 0), 100)
                    };
                } else if (item?.name) {
                    const isTongueNeck = item.name.includes('มีลิ้น');
                    merged.push({
                        ...item,
                        name: normalizeNeckName(item.name),
                        extraPrice: isTongueNeck ? 0 : Math.min(Math.max(item.extraPrice || 0, 0), 100)
                    });
                }
            });

            // Deduplicate by normalized name to avoid duplicates from backend+storage
            const seen = new Set();
            const deduped = [];
            for (const m of merged) {
                const key = normalizeNeckName(m.name);
                if (!key) continue; // skip empty names
                if (seen.has(key)) continue;
                seen.add(key);
                // Ensure name is cleaned and typed correctly
                deduped.push({
                    ...m,
                    id: m.id || `custom-${key}`,
                    name: key,
                    extraPrice: Number(m.extraPrice) || 0,
                    forceSlope: Boolean(m.forceSlope)
                });
            }

            return deduped;
        }
    } catch (e) { 
        console.error("Error loading neckTypes:", e);
        localStorage.removeItem('neckTypes');
    }
    return DEFAULT_NECK_TYPES;
};

// Helper: Get neck extra price
const getNeckExtraPrice = (neckName) => {
    const neckTypes = getNeckTypes();
    const needle = normalizeNeckName(neckName);
    const neck = neckTypes.find((n) => {
        const hay = normalizeNeckName(n.name);
        return needle.includes(hay) || hay.includes(needle);
    });
    
    // Tongue necks use add-on (+10) instead of extraPrice
    const isTongueNeck = (neck?.name || "").includes('มีลิ้น');
    const extraPrice = isTongueNeck ? 0 : (neck?.extraPrice || 0);

    // ⚠️ SANITY CHECK: extraPrice should never exceed 100 THB
    if (extraPrice > 100) {
        console.error("🚨 CORRUPT DATA: extraPrice =", extraPrice, "for neck:", neckName);
        console.error("This indicates localStorage corruption. Cleaning up...");
        localStorage.removeItem('neckTypes');
        return 0; // Return safe default
    }
    
    return extraPrice;
};


// Necks that support คอกลม/วี pricing (now dynamic)
const ROUND_V_NECK_TYPES = ['คอกลม', 'คอวี', 'คอวีตัด', 'คอวีชน', 'คอวีไขว้'];

// Necks that support ไหล่สโลป option (now dynamic based on supportSlope field)
const SLOPE_SHOULDER_SUPPORTED_NECKS = ['คอกลม', 'คอวี', 'คอวีตัด', 'คอวีปก'];

// Custom Status Options (editable)
const DEFAULT_STATUS_OPTIONS = [
  { value: 'แบบร่าง', label: 'แบบร่าง' },
  { value: 'กำลังออกแบบ', label: 'กำลังออกแบบ' },
  { value: 'รอแบบอนุมัติ', label: 'รอแบบอนุมัติ' },
  { value: 'กำลังผลิต', label: 'กำลังผลิต' },
  { value: 'เตรียมจัดส่ง', label: 'เตรียมจัดส่ง' },
  { value: 'ส่งมอบแล้ว', label: 'ส่งมอบแล้ว' }
];

const getStatusOptions = () => {
    try {
        const stored = localStorage.getItem('statusOptions');
        if (stored) return JSON.parse(stored);
    } catch (e) { console.error(e); }
    return DEFAULT_STATUS_OPTIONS;
};

const saveStatusOptions = (options) => {
    localStorage.setItem('statusOptions', JSON.stringify(options));
    window.dispatchEvent(new Event('statusOptionsUpdated'));
};

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
    // Handle authentication errors (401 and 403 with credential issues)
    // When authentication fails, clear credentials and emit a logout event.
    if (response.status === 401) {
        const hadToken = Boolean(token);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        if (hadToken) {
            // Notify app to perform a graceful logout (no full-page reload)
            window.dispatchEvent(new Event('blook:logout'));
        }
        return null;
    }
    if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        // If it's a credential validation error, treat it like 401
        if (errorData.detail && errorData.detail.includes('Could not validate credentials')) {
            const hadToken = Boolean(token);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            if (hadToken) {
                window.dispatchEvent(new Event('blook:logout'));
            }
            return null;
        }
        throw new Error(errorData.detail || 'Access forbidden');
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
// 0. Pagination Component with page numbers
const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    const getPageNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        
        let pages = [1];
        if (currentPage > 3) {
            if (currentPage > 4) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                if (!pages.includes(i)) pages.push(i);
            }
        } else {
            for (let i = 2; i <= 4; i++) {
                pages.push(i);
            }
        }
        
        if (currentPage < totalPages - 2) {
            if (currentPage < totalPages - 3) pages.push('...');
            pages.push(totalPages);
        } else if (!pages.includes(totalPages)) {
            pages.push(totalPages);
        }
        
        return pages;
    };

    const pages = getPageNumbers();

    return (
        <div className="p-2 sm:p-4 border-t border-gray-100 flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
            <button
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                <ChevronLeft size={14} className="sm:w-4 sm:h-4" />
            </button>

            {pages.map((page, idx) => (
                page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 sm:px-2 py-1 sm:py-2 text-gray-400 text-xs sm:text-base">...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition text-xs sm:text-base ${
                            currentPage === page
                                ? 'bg-[#1a1c23] text-white font-bold shadow-lg'
                                : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {page}
                    </button>
                )
            ))}

            <button
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                <ChevronRight size={14} className="sm:w-4 sm:h-4" />
            </button>
        </div>
    );
};

// 1. History Log Modal (NEW)
const HistoryLogModal = ({ orderId, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await fetchWithAuth(`/orders/${orderId}/logs`);
                setLogs(data || []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        if(orderId) fetchLogs();
    }, [orderId]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold flex items-center gap-2"><FileClock size={20}/> ประวัติการแก้ไข</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-black"/></button>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar">
                    {loading ? <p className="text-center text-gray-400">Loading...</p> : (
                        logs.length === 0 ? <p className="text-center text-gray-400">ไม่พบประวัติ</p> : (
                            <ul className="space-y-4">
                                {logs.map((log, idx) => (
                                    <li key={idx} className="flex gap-3 text-sm">
                                        <div className="flex-col items-center hidden sm:flex">
                                            <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5"></div>
                                            <div className="w-0.5 h-full bg-gray-100 my-1"></div>
                                        </div>
                                        <div className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-gray-800">{log.user}</span>
                                                <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString('th-TH')}</span>
                                            </div>
                                            <div className="text-gray-600 font-medium">{log.action}</div>
                                            {log.details && (
                                                <pre className="text-xs text-gray-500 mt-1 whitespace-pre-wrap font-sans bg-white p-2 rounded border border-gray-200">
                                                    {log.details}
                                                </pre>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

// 2. Invoice Modal
const InvoiceModal = ({ data, onClose }) => {
  const [image3DFront, setImage3DFront] = useState("");
  const [image3DBack, setImage3DBack] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
    const canViewCost = ['owner', 'md'].includes(localStorage.getItem('user_role'));
  
  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-xl text-center">
          <p className="text-red-600 font-bold">ไม่มีข้อมูลสำหรับแสดง</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded">ปิด</button>
        </div>
      </div>
    );
  }
  
  const handleDownloadPDF = async () => {
    const invoiceElement = document.getElementById('invoice-content');
    if (!invoiceElement) return;
    
    try {
      // Dynamically import html2pdf
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => {
                const html2pdfLib = window.html2pdf;
                if (!html2pdfLib) {
                    alert('ไม่สามารถดาวน์โหลด PDF ได้');
                    return;
                }
        const element = invoiceElement.cloneNode(true);
        element.style.margin = '0';
        element.style.padding = '0';
        
        const opt = {
          margin: 0,
          filename: `order-${data.order_no || 'draft'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { format: 'a4', orientation: 'portrait', compress: true }
        };
        
                html2pdfLib().set(opt).from(element).save();
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('ไม่สามารถดาวน์โหลด PDF ได้');
    }
  };
    const isFactoryView = data.isFactoryView || false;
    const urgencyStatus = data.urgencyStatus || data.urgency_level || 'normal';
    const invoiceTheme = {
            critical: { header: "bg-rose-600 text-white" },
            warning: { header: "bg-amber-500 text-white" },
            normal: { header: "bg-emerald-600 text-white" }
    };
  
  // Get sizes with quantities > 0
  const activeSizes = SIZES.filter(size => (data.quantities?.[size] || 0) > 0);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-content, #invoice-content * { visibility: visible; }
        }
      `}</style>
      
      {/* Action Buttons */}
      <div id="no-print-btn" className="fixed top-4 right-4 z-[60] flex flex-wrap gap-2 print:hidden">
          {!isFactoryView && (
              <>
                  <button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center transition font-medium text-sm">
                      <Printer size={18} className="mr-2"/> บันทึก PDF
                  </button>
                  <button onClick={() => setShowImageInput(!showImageInput)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center transition font-medium text-sm">
                      <Plus size={18} className="mr-1"/> ภาพ 3D
                  </button>
              </>
          )}
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full shadow-lg transition">
              <XCircle size={24} />
          </button>
      </div>
      
      {/* Image Input Panel */}
      {showImageInput && !isFactoryView && (
          <div id="image-input-panel" className="fixed top-20 right-4 z-[61] bg-white rounded-xl shadow-2xl p-5 w-80 border-2 border-purple-200 print:hidden">
              <h4 className="text-sm font-bold text-purple-700 mb-3">🎨 เพิ่มภาพ 3D / Design</h4>
              <div className="space-y-3">
                  <div>
                      <label className="text-xs text-gray-600 font-semibold">ภาพด้านหน้า</label>
                      <input type="text" className="w-full border-2 border-gray-200 p-2 rounded-lg text-xs mt-1 focus:border-purple-400" placeholder="URL ภาพด้านหน้า" value={image3DFront} onChange={(e) => setImage3DFront(e.target.value)} />
                  </div>
                  <div>
                      <label className="text-xs text-gray-600 font-semibold">ภาพด้านหลัง</label>
                      <input type="text" className="w-full border-2 border-gray-200 p-2 rounded-lg text-xs mt-1 focus:border-purple-400" placeholder="URL ภาพด้านหลัง" value={image3DBack} onChange={(e) => setImage3DBack(e.target.value)} />
                  </div>
              </div>
              <button onClick={() => setShowImageInput(false)} className="w-full mt-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700">ยืนยัน</button>
          </div>
      )}
      
      {/* Main Invoice Content - A4 Paper Size */}
      <div id="invoice-content" className="bg-white w-[210mm] h-[297mm] shadow-2xl relative text-slate-800 font-sans overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header - Red Banner (30mm) */}
        <div className={`${invoiceTheme[urgencyStatus]?.header || invoiceTheme.normal.header} px-6 py-3 flex-shrink-0`}>
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black leading-none">ORDER</h1>
                    <p className="text-xs font-semibold mt-0.5">{data.brand || "Jersey Express"}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-red-100">รหัสงาน</p>
                    <p className="text-lg font-bold">{data.order_no || "SP-DRAFT"}</p>
                    {isFactoryView && <span className="inline-block px-2 py-0.5 bg-white/20 rounded text-xs font-bold mt-1">FACTORY</span>}
                </div>
            </div>
        </div>
        
        {/* Order Info Row */}
        <div className="grid grid-cols-2 border-b border-gray-300">
            <div className="p-3 border-r border-gray-300">
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <span className="text-gray-500 text-xs">รหัสงาน:</span>
                        <p className="font-bold text-base">{data.order_no || "SP-DRAFT"}</p>
                    </div>
                    <div>
                        <span className="text-gray-500 text-xs">ลูกค้า:</span>
                        <p className="font-bold">{data.customerName || data.customer_name || "-"}</p>
                    </div>
                    {data.graphicCode && (
                        <div>
                            <span className="text-gray-500 text-xs">Admin:</span>
                            <p className="font-bold">{data.graphicCode}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="p-3">
                <div className="grid grid-cols-1 gap-1 text-sm">
                    <div>
                        <span className="text-gray-500 text-xs">รายละเอียด:</span>
                        <p className="font-medium">คอ{data.neck || "-"} แขน{data.sleeve || "-"}</p>
                        <p className="font-medium">ผ้า{data.fabric || "-"}</p>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Phone & Graphic Code Row */}
        <div className="grid grid-cols-2 border-b border-gray-300 text-sm">
            <div className="p-2 border-r border-gray-300">
                <span className="text-gray-500 text-xs">โทรศัพท์:</span>
                <span className="font-medium ml-2">{data.phoneNumber || data.phone || "-"}</span>
            </div>
            <div className="p-2">
                <span className="text-gray-500 text-xs">วันจัดส่ง:</span>
                <span className="font-medium ml-2">{data.deliveryDate ? new Date(data.deliveryDate).toLocaleDateString('th-TH') : "-"}</span>
            </div>
        </div>
        
        {/* Main Content: 3D Images + Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-300">
            {/* Left: 3D Images */}
            <div className="p-4 border-r border-gray-300">
                <h3 className="text-xs font-bold text-gray-600 mb-3 uppercase">ตัวอย่างแบบเสื้อ</h3>
                <div className="grid grid-cols-2 gap-3">
                    {/* Front Image */}
                    <div className="aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                        {image3DFront ? (
                            <img src={image3DFront} alt="Front" className="w-full h-full object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                        ) : null}
                        <div className={`${image3DFront ? 'hidden' : 'flex'} flex-col items-center justify-center text-gray-400 text-xs text-center p-2`}>
                            <Box size={32} className="mb-2 opacity-50" />
                            <span>ด้านหน้า</span>
                        </div>
                    </div>
                    {/* Back Image */}
                    <div className="aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                        {image3DBack ? (
                            <img src={image3DBack} alt="Back" className="w-full h-full object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                        ) : null}
                        <div className={`${image3DBack ? 'hidden' : 'flex'} flex-col items-center justify-center text-gray-400 text-xs text-center p-2`}>
                            <Box size={32} className="mb-2 opacity-50" />
                            <span>ด้านหลัง</span>
                        </div>
                    </div>
                </div>
                {/* graphic code removed from UI */}
            </div>
            
            {/* Right: Size Breakdown & Totals */}
            <div className="p-4">
                <h3 className="text-xs font-bold text-gray-600 mb-3 uppercase">รายละเอียดไซส์</h3>
                
                {/* Size Table */}
                <div className="border border-gray-300 rounded overflow-hidden mb-4">
                    <div className="bg-gray-100 p-2 text-center border-b border-gray-300">
                        <span className="text-sm font-bold">จำนวนรวม: <span className="text-lg text-blue-600">{data.totalQty || 0} ตัว</span></span>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {activeSizes.map(size => (
                            <div key={size} className="flex justify-between items-center px-4 py-2 text-sm hover:bg-gray-50">
                                <span className="font-medium text-gray-700">{size}</span>
                                <span className="font-bold text-gray-900">= {data.quantities?.[size] || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Add-ons */}
                {data.selectedAddOns && data.selectedAddOns.length > 0 && (
                    <div className="mb-4 p-2 bg-purple-50 rounded border border-purple-200">
                        <span className="text-xs font-bold text-purple-700">ตัวเลือกเพิ่มเติม:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {data.selectedAddOns.map(opt => (
                                <span key={opt.id} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">{opt.name}</span>
                            ))}
                        </div>
                    </div>
                )}
                
                {data.isOversize && (
                    <div className="mb-4 p-2 bg-blue-50 rounded border border-blue-200">
                        <span className="text-xs font-bold text-blue-700">⬆️ ทรง OVERSIZE</span>
                    </div>
                )}
            </div>
        </div>
        
        {/* Pricing Section - Hidden in Factory View */}
        {!isFactoryView && (
            <div className="p-4 border-b border-gray-300">
                <div className="max-w-md ml-auto">
                    <table className="w-full text-sm">
                        <tbody>
                            <tr><td className="py-1 text-gray-600">ยอดสินค้า ({data.totalQty} x {data.basePrice})</td><td className="py-1 text-right font-medium">{(data.productSubtotal || data.totalQty * data.basePrice || 0).toLocaleString()}</td></tr>
                            {data.sizingSurcharge > 0 && <tr className="text-orange-600"><td className="py-1">ค่าไซส์พิเศษ</td><td className="py-1 text-right">+{data.sizingSurcharge.toLocaleString()}</td></tr>}
                            {data.addOnOptionsTotal > 0 && <tr className="text-purple-600"><td className="py-1">ค่า Add-on</td><td className="py-1 text-right">+{data.addOnOptionsTotal.toLocaleString()}</td></tr>}
                            <tr><td className="py-1 text-gray-600">ค่าบล็อก/อื่นๆ</td><td className="py-1 text-right font-medium">{(data.addOnCost || 0).toLocaleString()}</td></tr>
                            <tr><td className="py-1 text-gray-600">ค่าขนส่ง</td><td className="py-1 text-right font-medium">{(data.shippingCost || 0).toLocaleString()}</td></tr>
                            {(data.discount || 0) > 0 && <tr className="text-rose-600"><td className="py-1">ส่วนลด</td><td className="py-1 text-right">-{data.discount.toLocaleString()}</td></tr>}
                            <tr><td className="py-1 text-gray-600">VAT (7%)</td><td className="py-1 text-right font-medium">{(data.vatAmount || 0).toLocaleString()}</td></tr>
                            <tr className="border-t-2 border-gray-300"><td className="py-2 font-bold text-base">ยอดสุทธิ</td><td className="py-2 text-right font-black text-lg">{(data.grandTotal || 0).toLocaleString()} บาท</td></tr>
                        </tbody>
                    </table>

                    <div className="mt-2 text-[10px] text-gray-500">
                        หากต้องการใบกำกับภาษี กรุณาแจ้งแอดมินก่อนสรุปยอด
                    </div>

                    {canViewCost && (data.totalCost != null || data.estimatedProfit != null) && (
                        <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded">
                            <div className="flex justify-between text-xs text-slate-600">
                                <span>ต้นทุนรวม</span>
                                <span className="font-semibold">{(data.totalCost || 0).toLocaleString()} บาท</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 mt-1">
                                <span>กำไรประมาณการ</span>
                                <span className="font-semibold">{(data.estimatedProfit || 0).toLocaleString()} บาท</span>
                            </div>
                        </div>
                    )}
                    
                    {/* Payment Box */}
                    <div className="mt-4 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                        <h4 className="text-xs font-bold text-emerald-800 mb-2">การชำระเงิน</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span>มัดจำ 1</span><span className="font-bold">{(data.deposit1 || 0).toLocaleString()} บาท</span></div>
                            {(data.designFee || 0) > 0 && (
                              <>
                                <div className="flex justify-between text-gray-600 text-xs bg-white/50 px-2 py-1 rounded">
                                  <span>ยอดสุทธิ - มัดจำ 1</span>
                                  <span>{((data.grandTotal || 0) - (data.deposit1 || 0)).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-amber-600 text-xs bg-white/50 px-2 py-1 rounded">
                                  <span>ลบ: ค่าขึ้นแบบ</span>
                                  <span>-{(data.designFee || 0).toLocaleString()}</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between"><span>มัดจำ 2</span><span className="font-bold">{(data.deposit2 || 0).toLocaleString()} บาท</span></div>
                            <div className="flex justify-between pt-2 border-t border-emerald-300 text-emerald-800 font-bold"><span>ค้างชำระ</span><span className="text-base">{Math.abs(data.balance || 0).toLocaleString()} บาท</span></div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Note Section */}
        <div className="p-4">
            <div className="border-2 border-gray-300 rounded p-3">
                <span className="text-xs font-bold text-gray-600">*หมายเหตุพิเศษ:</span>
                <p className="mt-1 text-sm text-gray-700 min-h-[40px]">{data.note || "-"}</p>
            </div>
        </div>
        
        {/* Factory View Notice */}
        {isFactoryView && (
            <div className="mx-4 mb-4 p-3 bg-gray-100 rounded-lg text-center text-gray-500 border-2 border-dashed border-gray-300">
                <p className="font-bold text-sm">📦 ใบส่งโรงงาน - Factory Copy</p>
                <p className="text-xs">เอกสารนี้ไม่แสดงราคา</p>
            </div>
        )}
        
        {/* Footer */}
        <div className="bg-gray-50 p-3 text-center text-xs text-gray-400 border-t border-gray-200">
            พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

// Helper function to build invoice data from order
const buildInvoiceDataFromOrder = (order) => {
    if (!order) return null;

    return {
        order_no: order.order_no,
        customerCode: order.customer_code,
        customerName: order.customer_name,
        customer_name: order.customer_name,
        phoneNumber: order.phone,
        phone: order.phone,
        contactChannel: order.contact_channel,
        address: order.address,
        brand: order.brand,
        deadline: order.deadline,
        deliveryDate: order.usage_date,
        // Calculate total quantity from items
        totalQty: (() => {
            if (!order.items || order.items.length === 0) return 0;
            return order.items.reduce((sum, item) => {
                if (item.quantity_matrix) {
                    try {
                        const matrix = typeof item.quantity_matrix === 'string'
                            ? JSON.parse(item.quantity_matrix)
                            : item.quantity_matrix;
                        return sum + Object.values(matrix).reduce((a, b) => a + (parseInt(b) || 0), 0);
                    } catch {
                        return sum + (item.total_qty || 0);
                    }
                }
                return sum + (item.total_qty || 0);
            }, 0);
        })(),
        // Build quantities object from items
        quantities: (() => {
            if (!order.items || order.items.length === 0) return {};
            const result = {};
            order.items.forEach(item => {
                if (item.quantity_matrix) {
                    try {
                        const matrix = typeof item.quantity_matrix === 'string'
                            ? JSON.parse(item.quantity_matrix)
                            : item.quantity_matrix;
                        Object.keys(matrix).forEach(size => {
                            result[size] = (result[size] || 0) + (parseInt(matrix[size]) || 0);
                        });
                    } catch (error) {
                        console.error('Error parsing quantity_matrix:', error);
                    }
                }
            });
            return result;
        })(),
        neck: order.items?.[0]?.neck_type || '-',
        sleeve: order.items?.[0]?.sleeve_type || '-',
        fabric: order.items?.[0]?.fabric_type || '-',
        basePrice: order.items?.[0]?.price_per_unit || 0,
        productSubtotal: (() => {
            if (!order.items || order.items.length === 0) {
                // Fallback: use grand_total - other costs
                return (order.grand_total || 0) - (order.vat_amount || 0) - (order.shipping_cost || 0) - (order.add_on_cost || 0);
            }
            return order.items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
        })(),
        addOnCost: order.add_on_cost || 0,
        sizingSurcharge: order.sizing_surcharge || 0,
        addOnOptionsTotal: order.add_on_options_total || 0,
        shippingCost: order.shipping_cost || 0,
        discount: order.discount_amount || 0,
        vatAmount: order.vat_amount || 0,
        grandTotal: order.grand_total || 0,
        totalCost: order.total_cost ?? null,
        estimatedProfit: order.estimated_profit ?? null,
        deposit1: order.deposit_1 || 0,
        deposit2: order.deposit_2 || 0,
        designFee: order.design_fee || 0,
        balance: (order.grand_total || 0) - (order.deposit_1 || 0) - (order.deposit_2 || 0),
        note: order.note,
        status: order.status,
        graphicCode: order.graphic_code,
        urgencyStatus: order.urgency_level
    };
};

// 2.1 ORDER DETAIL MODAL (Reuses invoice structure)
const OrderDetailModal = ({ order, onClose }) => {
  if (!order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-xl text-center">
          <p className="text-red-600 font-bold">ไม่มีข้อมูลสำหรับแสดง</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded">ปิด</button>
        </div>
      </div>
    );
  }

    const data = buildInvoiceDataFromOrder(order);

    return <InvoiceModal data={data} onClose={onClose} />;
};

// 2.7 USER MANAGEMENT PAGE
const UserManagementPage = ({ onNotify }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const currentUserRole = localStorage.getItem('user_role'); // ดึงสิทธิ์ของคนปัจจุบัน
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchWithAuth('/admin/users'); 
            if (data) setUsers(data);
        } catch (error) {
            onNotify("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    }, [onNotify]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleUpdateRole = async (userId, newRole) => {
        try {
            await fetchWithAuth(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole, is_active: true })
            });
            onNotify(`เปลี่ยนสิทธิ์เป็น ${newRole} เรียบร้อยแล้ว`, "success");
            fetchUsers(); 
        } catch (error) {
            onNotify("อัปเดตไม่สำเร็จ: " + error.message, "error");
        }
    };

    const getRoleBadge = (role) => {
        switch(role) {
            case 'owner': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200 shadow-sm">Owner</span>;
            case 'md': return <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 shadow-sm">MD</span>;
            case 'admin': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 shadow-sm">Admin</span>;
            case 'user': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">User</span>;
            case 'pending': return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center w-fit mx-auto animate-pulse"><Lock size={12} className="mr-1"/> รออนุมัติ</span>;
            default: return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs">Unknown</span>;
        }
    };

    const totalPages = Math.ceil(users.length / itemsPerPage);
    const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-3 sm:p-6 md:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto flex flex-col">
            <header className="mb-4 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-[#1a1c23]">จัดการผู้ใช้งาน</h1>
                <p className="text-gray-500 font-medium text-sm sm:text-base">กำหนดสิทธิ์เข้าถึงการใช้งาน</p>
            </header>

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[400px] sm:min-h-[500px]">
                <div className="p-2 sm:p-4 md:p-6 overflow-x-auto flex-1">
                    {loading ? <p className="text-center py-10 text-gray-400">Loading...</p> : (
                        <table className="w-full text-left min-w-full sm:min-w-[800px] border-collapse">
                            <thead className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                                <tr>
                                    <th className="py-2 sm:py-4 px-2 sm:px-6 text-center w-[25%] border-r border-gray-200">ชื่อผู้ใช้ / Email</th>
                                    <th className="py-2 sm:py-4 px-2 sm:px-6 text-center w-[25%] border-r border-gray-200 hidden sm:table-cell">ชื่อ-นามสกุล</th>
                                    <th className="py-2 sm:py-4 px-2 sm:px-6 text-center w-[25%] border-r border-gray-200 hidden sm:table-cell">สถานะปัจจุบัน</th>
                                    <th className="py-2 sm:py-4 px-2 sm:px-6 text-center w-[25%]">เปลี่ยนสิทธิ์</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {paginatedUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition border-b border-gray-200">
                                        <td className="py-2 sm:py-4 px-2 sm:px-6 font-bold text-xs sm:text-base text-gray-700 text-center border-r border-gray-200">{u.username}</td>
                                        <td className="py-2 sm:py-4 px-2 sm:px-6 text-sm text-gray-600 text-center border-r border-gray-200 hidden sm:table-cell">{u.full_name || "-"}</td>
                                        <td className="py-2 sm:py-4 px-2 sm:px-6 text-center border-r border-gray-200 hidden sm:table-cell">{getRoleBadge(u.role)}</td>
                                        <td className="py-2 sm:py-4 px-2 sm:px-6 text-center">
                                            <select 
                                                className={`border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1a1c23] outline-none cursor-pointer hover:border-gray-300 transition ${u.role === 'pending' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200'}`}
                                                value={u.role}
                                                onChange={(e) => {
                                                    if (window.confirm(`ยืนยันการเปลี่ยนสิทธิ์ของ ${u.username} เป็น "${e.target.value}"?`)) {
                                                        handleUpdateRole(u.id, e.target.value);
                                                    }
                                                }}
                                                // ป้องกันการเปลี่ยนสิทธิ์ตัวเอง หรือ ถ้าไม่ใช่ Owner ห้ามเปลี่ยนคนอื่นเป็น Owner
                                                disabled={
                                                    (currentUserRole !== 'owner' && u.role === 'owner') || // Admin ทั่วไปห้ามแก้ Owner
                                                    (currentUserRole !== 'owner' && currentUserRole !== 'admin') // User ห้ามแก้ใครเลย
                                                }
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="user">General User</option>
                                                <option value="admin">Admin</option>

                                                {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                                                    <option value="md">MD</option>
                                                )}

                                                {/* แสดงตัวเลือก Owner เฉพาะถ้าคน Login เป็น Owner */}
                                                {currentUserRole === 'owner' && (
                                                    <option value="owner">Owner</option>
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <PaginationControls 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>
        </div>
    );
};

// HELPER COMPONENT: DETAIL LIST MODAL
const DetailListModal = ({ title, items, onClose, onEdit }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 fade-in">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-3 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg sm:text-xl font-bold text-[#1a1c23]">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24} className="text-slate-500"/></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
                {items && items.length > 0 ? (
                    <table className="w-full text-left table-fixed">
                        <thead className="bg-white text-xs font-bold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-4 w-[20%] bg-gray-50 text-center">Order No</th>
                                <th className="p-4 w-[20%] bg-gray-50 text-center">ลูกค้า</th>
                                <th className="p-4 w-[20%] bg-gray-50 text-center">กำหนดส่ง</th>
                                <th className="p-4 w-[20%] bg-gray-50 text-center">สถานะ</th>
                                <th className="p-4 w-[20%] bg-gray-50 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-blue-50/50 transition">
                                    <td className="p-4 font-mono font-bold text-sm text-[#1a1c23] truncate text-center">
                                        {item.order_no}
                                    </td>
                                    <td className="p-4 text-sm text-gray-700 truncate text-center" title={item.customer_name}>
                                        {item.customer_name}
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 text-center">
                                        {item.deadline ? new Date(item.deadline).toLocaleDateString('th-TH') : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                            item.status === 'production' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            item.status === 'urgent' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                            item.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                            {item.status || 'Draft'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => { onClose(); if(onEdit && item.id) onEdit(item); }}
                                            className="text-xs underline text-slate-500 hover:text-[#1a1c23] font-medium"
                                        >
                                            แก้ไข
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center h-64">
                        <FileText size={48} className="mb-2 opacity-20"/>
                        <p>ไม่มีรายการข้อมูล</p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

// Simple metric card component (defined outside render to keep stable identity)
const MetricCard = ({ title, value, color, onClick, isHoverable = true }) => (
    <div 
        onClick={onClick}
        className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 transition ${isHoverable ? 'hover:shadow-md cursor-pointer hover:scale-[1.02]' : ''}`}
    >
        <h3 className="text-gray-500 font-bold text-sm">{title}</h3>
        <div className={`text-4xl font-black ${color}`}>{value}</div>
    </div>
);

// -----------------------------------------------------------------------------
// 2.1 DASHBOARD (FULL UPDATED CODE)
// -----------------------------------------------------------------------------
const DashboardPage = ({ onEdit }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Global Filter States
    const [timeRange, setTimeRange] = useState('today'); // 'today', 'week', 'month'
    const [brandFilter, setBrandFilter] = useState('All Outlets'); // 'All Outlets', 'BG', 'Jersey'

    // Data States
    const [notifications, setNotifications] = useState([]); // Smart Alerts
    
    // Metric Lists (Filtered)
    const [metricLists, setMetricLists] = useState({
        newOrders: [],
        inProduction: [],
        deliveryIn3Days: [],
        delivered: []
    });

    const [events, setEvents] = useState([]);
    
    // Today's List Data & Filter
    const [todaysList, setTodaysList] = useState([]);
    const [todayFilter, setTodayFilter] = useState('all'); 

    // Modals
    const [showQueueModal, setShowQueueModal] = useState(false);
    const [detailModal, setDetailModal] = useState(null);
    const [detailOrder, setDetailOrder] = useState(null); 

    // --- Helper: Date Range Checker ---
    const isInTimeRange = (dateStr, range) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (range === 'today') {
            return date >= startOfDay && date < new Date(startOfDay.getTime() + 86400000);
        } else if (range === 'week') {
            const day = startOfDay.getDay() || 7; // Get current day (1-7)
            if (day !== 1) startOfDay.setHours(-24 * (day - 1)); // Go back to Monday
            const endOfWeek = new Date(startOfDay.getTime() + 6 * 24 * 60 * 60 * 1000);
            endOfWeek.setHours(23, 59, 59, 999);
            return date >= startOfDay && date <= endOfWeek;
        } else if (range === 'month') {
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }
        return true;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orders = await fetchWithAuth('/orders/');
                const data = orders || [];
                
                // --- 1. Apply Brand Filter First ---
                let filteredData = data;
                if (brandFilter !== 'All Outlets') {
                    // สมมติว่ามี field brand หรือเดาจากสินค้า (ในที่นี้ถ้าไม่มี field brand ชัดเจน อาจต้องข้ามไปก่อน หรือใช้ logic อื่น)
                    // *หมายเหตุ: ใน Requirement 5.2 มี "เลือกแบรนด์: BG หรือ Jersey" แต่ใน Model ปัจจุบันยังไม่มี column brand ชัดเจน
                    // ผมจะ assume ว่าถ้ามีการเก็บข้อมูล brand จะ filter ตรงนี้
                    // filteredData = data.filter(o => o.brand === brandFilter);
                }

                // --- 2. Calculate Metrics based on Time Range ---
                
                // 2.1 New Orders (Created Date matches Time Range)
                const newOrders = filteredData.filter(o => {
                    const created = o.created_at ? new Date(o.created_at) : new Date(o.updated_at);
                    return isInTimeRange(created, timeRange);
                });

                // 2.2 In Production (Snapshot - No Time Range, just Status)
                const inProduction = filteredData.filter(o => ['production', 'designing', 'waiting_approval'].includes(o.status));

                // 2.3 Delivery in 3 Days (Snapshot - Pending & Deadline approaching)
                const today = new Date();
                const deliveryIn3Days = filteredData.filter(o => {
                    if (!o.deadline || o.status === 'delivered') return false;
                    const deadline = new Date(o.deadline);
                    const diffTime = deadline - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 3;
                });

                // 2.4 Delivered (Delivered Date/Update Date matches Time Range)
                const delivered = filteredData.filter(o => {
                    if (o.status !== 'delivered') return false;
                    const completedDate = o.updated_at ? new Date(o.updated_at) : new Date(); // Use updated_at as completion date proxy
                    return isInTimeRange(completedDate, timeRange);
                });

                setMetricLists({
                    newOrders,
                    inProduction,
                    deliveryIn3Days,
                    delivered
                });

                // --- 3. Calendar Events (Show All for the selected month view) ---
                const mappedEvents = filteredData.map(o => {
                    const targetDate = o.usage_date ? new Date(o.usage_date) : (o.deadline ? new Date(o.deadline) : null);
                    if (!targetDate) return null;

                    return {
                        ...o, 
                        day: targetDate.getDate(),
                        month: targetDate.getMonth(),
                        year: targetDate.getFullYear(),
                        title: o.customer_name,
                        isUsageDate: !!o.usage_date
                    };
                }).filter(e => e !== null);

                setEvents(mappedEvents.filter(e => e.month === currentDate.getMonth() && e.year === currentDate.getFullYear()));

                // --- 3.5 Smart Notifications (Alerts for urgent items) ---
                const alerts = [];
                data.forEach(o => {
                    const now = new Date();
                    // Alert 1: Design/Waiting too long (updated > 2 days ago)
                    if (['designing', 'waiting_approval'].includes(o.status)) {
                        const lastUpdate = new Date(o.updated_at || o.created_at);
                        const diffDays = Math.floor((now - lastUpdate) / (1000 * 3600 * 24));
                        if (diffDays >= 2) alerts.push({ id: o.id, type: 'warning', msg: `ออเดอร์ ${o.order_no} ค้างในสถานะ "${o.status}" เกิน 2 วันแล้ว`, order: o });
                    }
                    // Alert 2: Usage Date approaching (in 2 days)
                    if (o.usage_date) {
                        const usage = new Date(o.usage_date);
                        const diffUsage = Math.ceil((usage - now) / (1000 * 3600 * 24));
                        if (diffUsage > 0 && diffUsage <= 2 && o.status !== 'delivered') {
                            alerts.push({ id: o.id, type: 'critical', msg: `🚩 ลูกค้าจะใช้งานออเดอร์ ${o.order_no} ในอีก ${diffUsage} วัน`, order: o });
                        }
                    }
                });
                setNotifications(alerts);

                // --- 4. Today's Activity List (Fix list generation) ---
                const todayItems = [];
                const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                
                // New Today
                filteredData.filter(o => {
                    const d = o.created_at ? new Date(o.created_at) : new Date();
                    return d.getDate() === startOfToday.getDate() && d.getMonth() === startOfToday.getMonth();
                }).forEach(o => todayItems.push({...o, type: 'new', desc: 'สร้างวันนี้'}));

                // Deadline Today
                filteredData.forEach(o => {
                    if(o.deadline) {
                        const d = new Date(o.deadline); d.setHours(0,0,0,0);
                        if(d.getTime() === startOfToday.getTime()) todayItems.push({...o, type: 'deadline', desc: 'กำหนดส่งวันนี้'});
                    }
                    if(o.usage_date) {
                        const u = new Date(o.usage_date); u.setHours(0,0,0,0);
                        if(u.getTime() === startOfToday.getTime()) todayItems.push({...o, type: 'usage', desc: 'ลูกค้าใช้งานวันนี้'});
                    }
                });
                setTodaysList(todayItems);

            } catch (err) {
                console.error("Dashboard Fetch Error", err);
            }
        };
        fetchData();
    }, [currentDate, timeRange, brandFilter]); // Re-run when filters change

    const eventsByDay = events.reduce((acc, evt) => {
        acc[evt.day] = [...(acc[evt.day] || []), evt];
        return acc;
    }, {});
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    // Filter Today List for UI
    const filteredTodayList = todayFilter === 'all' ? todaysList : todaysList.filter(i => i.type === todayFilter);

    // Labels for Time Range
    const timeRangeLabels = {
        'today': 'วันนี้',
        'week': 'สัปดาห์นี้',
        'month': 'เดือนนี้'
    };

    return (
        <div className="p-6 md:p-10 fade-in h-full flex flex-col bg-[#f0f2f5] overflow-y-auto">
            
            {/* Detail Order Modal */}
            {detailOrder && (
                <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
            )}

            {/* Modal for Details */}
            {detailModal && (
                <DetailListModal 
                    title={detailModal.title} 
                    items={detailModal.items} 
                    onClose={() => setDetailModal(null)} 
                    onEdit={onEdit}
                />
            )}

            {/* Notifications Panel */}
            {notifications.length > 0 && (
                <div className="mb-8 bg-white p-6 rounded-3xl shadow-sm border border-red-100">
                    <h3 className="text-lg font-bold text-[#1a1c23] mb-4 flex items-center gap-2"><Bell className="text-rose-500"/> รายการที่ต้องติดตามด่วน</h3>
                    <div className="space-y-3">
                        {notifications.map((n, i) => (
                            <div key={i} onClick={() => setDetailOrder(n.order)} className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer hover:bg-gray-50 ${n.type === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                                <div className="flex items-center gap-3">
                                    {n.type === 'critical' ? <Flag size={18}/> : <Clock size={18}/>}
                                    <span className="text-sm font-bold">{n.msg}</span>
                                </div>
                                <span className="text-xs underline">ดูรายละเอียด</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Queue Modal (Fixed Layout) */}
            {showQueueModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                <Box className="text-[#1a1c23]" />
                                <h3 className="text-xl font-bold text-[#1a1c23]">รายการรอจัดส่ง</h3>
                            </div>
                            <button onClick={() => setShowQueueModal(false)} className="bg-white p-2 rounded-full border shadow-sm hover:bg-gray-100 transition"><XCircle size={24} className="text-slate-500"/></button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-left table-fixed">
                                <thead className="bg-white text-xs font-bold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-4 w-[20%] bg-gray-50 text-center">Order No</th>
                                        <th className="p-4 w-[20%] bg-gray-50 text-center">ลูกค้า</th>
                                        <th className="p-4 w-[20%] bg-gray-50 text-center">กำหนดส่ง</th>
                                        <th className="p-4 w-[20%] bg-gray-50 text-center">สถานะ</th>
                                        <th className="p-4 w-[20%] bg-gray-50 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {metricLists.inProduction.map(o => (
                                        <tr key={o.id} className="hover:bg-blue-50/50 transition">
                                            <td className="p-4 font-mono font-bold text-sm text-[#1a1c23] truncate">{o.order_no}</td>
                                            <td className="p-4 text-sm text-gray-700 truncate" title={o.customer_name}>{o.customer_name}</td>
                                            <td className="p-4 text-sm text-gray-500">{o.deadline ? new Date(o.deadline).toLocaleDateString('th-TH') : '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                                                    o.status === 'production' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                    'bg-blue-100 text-blue-700 border-blue-200'
                                                }`}>
                                                    {o.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => { setShowQueueModal(false); onEdit(o); }} className="text-xs underline text-slate-500 hover:text-[#1a1c23]">แก้ไข</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {metricLists.inProduction.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-gray-400">ไม่มีรายการที่รอจัดส่ง</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-[#1a1c23] tracking-tight leading-tight mb-2">
                            Overview
                        </h1>
                        <p className="text-gray-500">ภาพรวมร้านค้าของคุณ</p>
                    </div>
                    
                    {/* --- GLOBAL FILTER BAR --- */}
                    <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 gap-1">
                        {['today', 'week', 'month'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                                    timeRange === range 
                                    ? 'bg-[#1a1c23] text-white shadow-md' 
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                            </button>
                        ))}
                        <div className="w-px bg-gray-200 mx-1"></div>
                        <select 
                            className="bg-transparent text-xs font-bold text-gray-700 outline-none px-2 cursor-pointer hover:bg-gray-50 rounded-lg"
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                        >
                            <option>All Outlets</option>
                            <option>BG</option>
                            <option>Jersey</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* Metrics Grid (Dynamic based on Filter) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
                <MetricCard 
                    title={`ออเดอร์ใหม่ (${timeRangeLabels[timeRange]})`}
                    value={metricLists.newOrders.length} 
                    color="text-blue-600" 
                    onClick={() => setDetailModal({ title: `ออเดอร์ใหม่ (${timeRangeLabels[timeRange]})`, items: metricLists.newOrders })}
                />
                <MetricCard 
                    title="กำลังดำเนินการ" 
                    value={metricLists.inProduction.length} 
                    color="text-amber-500" 
                    onClick={() => setDetailModal({ title: "รายการกำลังดำเนินการทั้งหมด", items: metricLists.inProduction })}
                />
                <MetricCard 
                    title="ต้องส่งใน 3 วัน" 
                    value={metricLists.deliveryIn3Days.length} 
                    color="text-rose-600" 
                    onClick={() => setDetailModal({ title: "รายการด่วน (ส่งภายใน 3 วัน)", items: metricLists.deliveryIn3Days })}
                />
                <MetricCard 
                    title={`ส่งมอบแล้ว (${timeRangeLabels[timeRange]})`}
                    value={metricLists.delivered.length} 
                    color="text-emerald-600" 
                    onClick={() => setDetailModal({ title: `รายการส่งมอบแล้ว (${timeRangeLabels[timeRange]})`, items: metricLists.delivered })}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                {/* Calendar Panel */}
                <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-6 flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4 md:mb-6">
                        <div>
                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#1a1c23]">ตารางงาน</h3>
                            <p className="text-[10px] sm:text-xs text-gray-400">คลิกที่วันเพื่อดูรายละเอียด</p>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 bg-gray-50 rounded-lg p-0.5 sm:p-1">
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1.5 sm:p-2 hover:bg-white rounded-md shadow-sm transition"><ChevronLeft size={14} className="sm:w-4 sm:h-4"/></button>
                            <span className="text-xs sm:text-sm font-bold text-gray-700 min-w-[80px] sm:min-w-[100px] text-center">
                                {currentDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1.5 sm:p-2 hover:bg-white rounded-md shadow-sm transition"><ChevronRight size={14} className="sm:w-4 sm:h-4"/></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <div className="min-w-[280px] sm:min-w-[400px] md:min-w-[600px]">
                            <div className="grid grid-cols-7 mb-1 sm:mb-2">
                                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                                    <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-gray-400 uppercase">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2">
                                {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} className="h-24"></div>)}
                                {[...Array(daysInMonth)].map((_, i) => {
                                    const day = i + 1;
                                    const evts = eventsByDay[day] || [];
                                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                                    
                                    return (
                                        <div 
                                            key={day} 
                                            onClick={() => {
                                                if (evts.length > 0) {
                                                    setDetailModal({ 
                                                        title: `รายละเอียดวันที่ ${day} ${currentDate.toLocaleString('th-TH', { month: 'long' })}`, 
                                                        items: evts 
                                                    });
                                                }
                                            }}
                                            className={`h-14 sm:h-20 md:h-24 border border-gray-100 rounded-lg sm:rounded-xl p-1 sm:p-2 relative transition group flex flex-col 
                                                ${isToday ? 'bg-blue-50/50 border-blue-200' : 'bg-white hover:border-blue-300 cursor-pointer'}
                                            `}
                                        >
                                            <span className={`text-[10px] sm:text-xs md:text-sm font-bold mb-0.5 sm:mb-1 ${isToday ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>{day}</span>
                                            <div className="flex-1 overflow-y-auto space-y-0.5 sm:space-y-1 custom-scrollbar">
                                                {evts.slice(0, window.innerWidth < 640 ? 1 : 3).map((e, idx) => {
                                                    let bgClass = "bg-gray-100 text-gray-600";
                                                    if (e.status === 'designing') bgClass = "bg-purple-100 text-purple-700 border-purple-200";
                                                    if (e.status === 'waiting_approval') bgClass = "bg-yellow-100 text-yellow-700 border-yellow-200";
                                                    if (e.status === 'production') bgClass = "bg-blue-100 text-blue-700 border-blue-200";
                                                    if (e.status === 'shipping') bgClass = "bg-orange-100 text-orange-700 border-orange-200";
                                                    if (e.status === 'delivered') bgClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
                                                    if (e.isUsageDate && e.status !== 'delivered') bgClass = "bg-rose-500 text-white font-bold shadow-md";

                                                    return (
                                                        <div key={idx} className={`text-[8px] sm:text-[10px] px-0.5 sm:px-1.5 py-0.5 sm:py-1 rounded truncate mb-0.5 sm:mb-1 border ${bgClass}`} title={e.title}>
                                                            {e.isUsageDate ? "🚩 " : ""}{e.title}
                                                        </div>
                                                    );
                                                })}
                                                {evts.length > (window.innerWidth < 640 ? 1 : 3) && (
                                                    <div className="text-[8px] sm:text-[10px] text-gray-400 text-center">+{evts.length - (window.innerWidth < 640 ? 1 : 3)}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 sm:space-y-4 md:space-y-6">
                    {/* Today's List Panel with Summary/Detail Filter */}
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-6 flex flex-col h-[280px] sm:h-[320px] md:h-[400px]">
                        <div className="mb-2 sm:mb-3 md:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                             <div>
                                 <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#1a1c23]">รายการวันนี้</h3>
                                 <p className="text-[10px] sm:text-xs text-gray-400">{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long'})}</p>
                             </div>
                             {/* Filter Summary / Detail (Simulated by Type Filter) */}
                             <select 
                                className="text-[10px] sm:text-xs border rounded-lg p-1 sm:p-1.5 bg-gray-50 focus:ring-1 focus:ring-[#1a1c23] outline-none w-full sm:w-auto"
                                value={todayFilter}
                                onChange={(e) => setTodayFilter(e.target.value)}
                             >
                                 <option value="all">ทั้งหมด (All)</option>
                                 <option value="new">ออเดอร์ใหม่</option>
                                 <option value="deadline">ครบกำหนด</option>
                                 <option value="usage">วันใช้งาน</option>
                             </select>
                        </div>
                        
                        <div className="space-y-2 sm:space-y-3 flex-1 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                            {filteredTodayList.length > 0 ? filteredTodayList.map((item, i) => (
                                <div key={i} onClick={() => onEdit(item)} className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 hover:bg-blue-50 cursor-pointer rounded-lg sm:rounded-xl border border-gray-100 transition group">
                                    <div className={`p-1.5 sm:p-2 rounded-full shrink-0 ${
                                        item.type === 'new' ? 'bg-blue-100 text-blue-500' : 
                                        item.type === 'usage' ? 'bg-rose-100 text-rose-500' : 'bg-amber-100 text-amber-500'
                                    }`}>
                                        {item.type === 'new' ? <Plus size={14} className="sm:w-4 sm:h-4"/> : <AlertCircle size={14} className="sm:w-4 sm:h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-1">
                                            <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{item.customer_name}</p>
                                            <span className="text-[8px] sm:text-[10px] bg-white px-1 sm:px-1.5 rounded border text-gray-500 whitespace-nowrap">{item.order_no}</span>
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-gray-500 truncate">{item.desc}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-6 sm:py-12 text-gray-300 text-xs sm:text-sm flex flex-col items-center">
                                    <CheckCircle size={24} className="sm:w-8 sm:h-8 mb-2 opacity-30"/>
                                    ไม่มีรายการในช่วงนี้
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#1a1c23] rounded-2xl sm:rounded-3xl shadow-lg p-3 sm:p-4 md:p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-sm sm:text-base md:text-lg font-bold mb-0.5 sm:mb-1">จัดการคิวงาน</h3>
                            <p className="text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3 md:mb-4">ตรวจสอบงานที่พร้อมส่งมอบ</p>
                            <div className="flex items-center justify-between bg-white/10 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm mb-2 sm:mb-3 md:mb-4">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <Box size={16} className="sm:w-5 sm:h-5 text-blue-400"/>
                                    <span className="text-xs sm:text-sm font-medium">รอจัดส่ง</span>
                                </div>
                                <span className="text-lg sm:text-xl font-bold">{metricLists.inProduction.length}</span>
                            </div>
                            <button 
                                onClick={() => setShowQueueModal(true)}
                                className="w-full bg-white text-[#1a1c23] py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold hover:bg-gray-100 transition shadow-md"
                            >
                                ดูรายละเอียด
                            </button>
                        </div>
                        <div className="absolute top-[-20%] right-[-10%] w-20 sm:w-32 h-20 sm:h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-[-10%] left-[-10%] w-16 sm:w-24 h-16 sm:h-24 bg-purple-500/20 rounded-full blur-2xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 2.2 ORDER CREATION PAGE - FIXED VERSION
const OrderCreationPage = ({ onNavigate, editingOrder, onNotify, addOnDefinitions, setAddOnDefinitions }) => {
  const [brand, setBrand] = useState(BRANDS[0]);
  const [deadline, setDeadline] = useState("");
  const [urgencyStatus, setUrgencyStatus] = useState("normal");
  const [customerName, setCustomerName] = useState("");
  const [contactChannel, setContactChannel] = useState("LINE OA");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState(SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {}));
  const [basePrice, setBasePrice] = useState(150);
    const [productType, setProductType] = useState("shirt");
  const [addOnCost, setAddOnCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [isVatIncluded, setIsVatIncluded] = useState(true);
  const [deposit1, setDeposit1] = useState(0);
  const [deposit2, setDeposit2] = useState(0);
  
  const [fabrics, setFabrics] = useState([]);
  const [sleeves, setSleeves] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState("");
  const [selectedNeck, setSelectedNeck] = useState("");
  const [selectedSleeve, setSelectedSleeve] = useState("");
  const [config, setConfig] = useState({ vat_rate: 0.07, default_shipping_cost: 0 });

  // NEW: State for deliveryDate (renamed from usageDate) and status
  const [deliveryDate, setDeliveryDate] = useState(""); 
  const [status, setStatus] = useState("draft");
  
    // NEW: Customer info fields
    const [customerId, setCustomerId] = useState("");
    const [graphicCode, setGraphicCode] = useState("");
  
  // NEW: Oversize/Shape state
  const [isOversize, setIsOversize] = useState(false);

    // NEW: Advance hold (e.g. 500 or 1000) that was paid earlier and should be
    // deducted from deposit_2. This implements the customer's request.
    const [advanceHold, setAdvanceHold] = useState(0);
  
    // NEW: Add-on options state (object with boolean values)
    const [addOnOptions, setAddOnOptions] = useState(() => buildAddOnOptionsState(ADDON_OPTIONS));
  
  // NEW: Neck Extra Price (ราคาเพิ่มเติมจากประเภทคอ)
    const neckExtraPrice = useMemo(() => getNeckExtraPrice(selectedNeck), [selectedNeck]);
  
    // NEW: Available neck types from localStorage (kept in state so fetch updates reflect in UI)
        const [availableNeckTypes, setAvailableNeckTypes] = useState(getNeckTypes());
  
  // NEW: Design Fee (ค่าขึ้นแบบ) - deducted from deposit2
  
  // NEW: Custom sizes state
  const [customSizes, setCustomSizes] = useState([]);
  const [allSizes] = useState(SIZES);
  const [showAddSizeModal, setShowAddSizeModal] = useState(false);
  const [newSizeInput, setNewSizeInput] = useState("");
  
  // Get available sizes to display (default sizes + custom sizes)
  const displaySizes = [...allSizes, ...customSizes].sort((a, b) => {
    const order = allSizes;
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });
  
  // Function to add a new custom size
  const handleAddCustomSize = () => {
    if (newSizeInput.trim() && !displaySizes.includes(newSizeInput.trim())) {
      setCustomSizes([...customSizes, newSizeInput.trim()]);
      setQuantities({...quantities, [newSizeInput.trim()]: 0});
      setNewSizeInput("");
      setShowAddSizeModal(false);
    }
  };
  
  const openAddSizeModal = () => {
    setNewSizeInput("");
    setShowAddSizeModal(true);
  };
  const [designFee, setDesignFee] = useState(0);
  
  // NEW: Factory View mode (hide prices)
  const [isFactoryView, setIsFactoryView] = useState(false);
  
  // NEW: Custom status options
    const [statusOptions, setStatusOptions] = useState(getStatusOptions());
    useEffect(() => {
        const handleStatusUpdate = () => setStatusOptions(getStatusOptions());
        window.addEventListener('statusOptionsUpdated', handleStatusUpdate);
        return () => window.removeEventListener('statusOptionsUpdated', handleStatusUpdate);
    }, []);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
    // NEW: Hold multiple items for this order
    const [orderItems, setOrderItems] = useState([]);

    const addCurrentItemToList = () => {
        const qty = Object.values(quantities).reduce((a,b)=>a+b,0);
        if (qty <= 0) {
            onNotify('กรุณากรอกจำนวนสินค้าอย่างน้อย 1 ชิ้น ก่อนเพิ่มสินค้า', 'error');
            return;
        }

        const productName = productType === 'sportsPants'
            ? 'กางเกงกีฬา'
            : productType === 'fashionPants'
                ? 'กางเกงแฟชั่น'
                : `${selectedNeck || 'เสื้อ'} ${selectedSleeve || ''}`.trim();

        const item = {
            product_name: productName,
            fabric_type: selectedFabric || null,
            neck_type: productType === 'shirt' ? (selectedNeck || null) : null,
            sleeve_type: productType === 'shirt' ? (selectedSleeve || null) : null,
            quantity_matrix: { ...quantities },
            total_qty: qty,
            base_price: Number(basePrice) || 0,
            price_per_unit: Number(basePrice) || 0,
            total_price: Number(productSubtotal) || 0,
            cost_per_unit: 0,
            total_cost: 0
        };
        // include per-item add-ons and oversize flag so backend can persist and re-calc
        const sel = ADDON_OPTIONS.filter(opt => addOnOptions[opt.id]).map(o => o.id).filter(id => {
            if (id === 'slopeShoulder' && isSlopeForcedByNeck) return false;
            return true;
        });
        item.selected_add_ons = sel;
        item.is_oversize = Boolean(isOversize);
        item.slope_included_in_base = Boolean(isSlopeForcedByNeck);

        setOrderItems(prev => [...prev, item]);

        // Reset current form item to allow adding another product
        setQuantities(SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {}));
        setSelectedFabric('');
        // keep neck/sleeve as user may want same type, do not clear
    };

    const removeItemAt = (index) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
    };

  // Initialize form when editing an order
  useEffect(() => {
    if (editingOrder) {
        // Basic Info
        setBrand(editingOrder.brand || BRANDS[0]);
        setCustomerName(editingOrder.customer_name || "");
        setCustomerId(editingOrder.order_no || "");
        setPhoneNumber(editingOrder.phone || "");
        setContactChannel(editingOrder.contact_channel || "LINE OA");
        setAddress(editingOrder.address || "");
        
        // Dates & Status
        setDeadline(editingOrder.deadline ? new Date(editingOrder.deadline).toISOString().split('T')[0] : "");
        setDeliveryDate(editingOrder.usage_date ? new Date(editingOrder.usage_date).toISOString().split('T')[0] : "");
        setStatus(editingOrder.status || "draft");
        setUrgencyStatus(editingOrder.urgency_level || "normal");
        
        // Financial Info
        setDeposit1(editingOrder.deposit_1 || 0);
        setDeposit2(editingOrder.deposit_2 || 0);
        setShippingCost(editingOrder.shipping_cost || 0);
        setAddOnCost(editingOrder.add_on_cost || 0);
        setDiscount(editingOrder.discount_amount || 0);
        setIsVatIncluded(editingOrder.is_vat_included || false);
        
        // Notes
        setNote(editingOrder.note || "");
        
        // Items - populate from first item if available
        if (editingOrder.items && editingOrder.items.length > 0) {
            const firstItem = editingOrder.items[0];
            
            // Set product details
            setSelectedFabric(firstItem.fabric_type || "");
            setSelectedNeck(firstItem.neck_type || "");
            setSelectedSleeve(firstItem.sleeve_type || "");
            // ✅ FIX: Don't load price from DB - let useEffect recalculate based on STEP_PRICING
            // This prevents perpetuating wrong prices from old orders
            // setBasePrice(firstItem.price_per_unit || 0);
            
            // Parse and set quantities
            if (firstItem.quantity_matrix) {
                try {
                    const matrix = typeof firstItem.quantity_matrix === 'string' 
                        ? JSON.parse(firstItem.quantity_matrix) 
                        : firstItem.quantity_matrix;
                    setQuantities(matrix);
                } catch (e) {
                    console.error('Error parsing quantity_matrix:', e);
                }
            }
            // If order has additional items, populate orderItems list
            if (editingOrder.items.length > 1) {
                const rest = editingOrder.items.slice(1).map(it => {
                    // Ensure quantity_matrix is an object
                    let qm = it.quantity_matrix;
                    try {
                        if (typeof qm === 'string') qm = JSON.parse(qm);
                    } catch (err) {
                        console.error('Error parsing quantity_matrix:', err);
                        qm = {};
                    }
                    return { ...it, quantity_matrix: qm };
                });
                setOrderItems(rest);
            }
        }
        
        // Legacy fields (if they exist in order)
        setGraphicCode(editingOrder.graphic_code || "");
        setIsOversize(editingOrder.is_oversize || false);
        setDesignFee(editingOrder.design_fee || 0);
        setProductType(editingOrder.product_type || "shirt");
    } else {
        // Reset form for new order
        setBrand(BRANDS[0]);
        setCustomerName("");
        setCustomerId("");
        setPhoneNumber("");
        setContactChannel("LINE OA");
        setAddress("");
        setGraphicCode("");
        setDeadline("");
        setDeliveryDate("");
        setStatus("draft");
        setUrgencyStatus("normal");
        setDeposit1(0);
        setDeposit2(0);
        setProductType("shirt");
        setShippingCost(0);
        setAddOnCost(0);
        setDiscount(0);
        setIsVatIncluded(true);
        setNote("");
        setQuantities(SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {}));
        setCustomSizes([]);
        setSelectedFabric("");
        setSelectedNeck("");
        setSelectedSleeve("");
        setBasePrice(150);
        // graphic code intentionally ignored in UI
        setIsOversize(false);
        setDesignFee(0);
                setAddOnOptions(buildAddOnOptionsState(addOnDefinitions));
    }
    }, [editingOrder, addOnDefinitions]);

  // Fetch master data
  useEffect(() => {
      const fetchMasters = async () => {
          try {
              setIsLoading(true);
              const [fData, nData, sData, cData] = await Promise.all([
                  fetchWithAuth('/products/fabrics').catch(() => null),
                  fetchWithAuth('/products/necks').catch(() => null),
                  fetchWithAuth('/products/sleeves').catch(() => null),
                  fetchWithAuth('/company/config').catch(() => null)
              ]);
              
              setFabrics(fData || []);
              setSleeves(sData || []);
              
              // Map backend neck types to frontend format
              // Backend has: cost_price, additional_cost, price_adjustment
              // Frontend needs: extraPrice
              if (nData && nData.length > 0) {
                  // Treat backend as authoritative: map backend necks directly
                  const mappedNeckTypes = nData.map((neck) => ({
                      id: neck.id,
                      name: neck.name,
                      // Use cost_price as extraPrice (cost_price is set for special necks with +40)
                      extraPrice: (neck.cost_price || neck.additional_cost || neck.price_adjustment || 0),
                      priceGroup: neck.name.includes('ปก') ? 'collarOthers' : 'roundVNeck',
                      supportSlope: ['คอกลม', 'คอวี', 'คอวีตัด', 'คอวีปก'].some(n => neck.name.includes(n)),
                      forceSlope: (neck.force_slope !== undefined ? Boolean(neck.force_slope) : isForceSlopeNeck(neck.name))
                  }));

                  // Deduplicate by normalized name (keep first occurrence)
                  const seen = new Set();
                  const finalNeckTypes = [];
                  for (const n of mappedNeckTypes) {
                      const key = normalizeNeckName(n.name);
                      if (!key) continue;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      finalNeckTypes.push({
                          ...n,
                          id: n.id || `nb-${key}`,
                          name: n.name,
                          extraPrice: Number(n.extraPrice) || 0,
                          forceSlope: Boolean(n.forceSlope)
                      });
                  }

                  // Overwrite local cache with backend-provided master list
                  try {
                      const currentNecks = JSON.stringify(availableNeckTypes || []);
                      const incomingNecks = JSON.stringify(finalNeckTypes || []);
                      localStorage.setItem('neckTypes', incomingNecks);
                      if (currentNecks !== incomingNecks) {
                          setAvailableNeckTypes(finalNeckTypes);
                      }
                  } catch {
                      // Fallback: always set
                      localStorage.setItem('neckTypes', JSON.stringify(finalNeckTypes));
                      setAvailableNeckTypes(finalNeckTypes);
                  }
              }
               
              if (cData) {
                  setConfig({ 
                      vat_rate: cData.vat_rate || 0.07, 
                      default_shipping_cost: cData.default_shipping_cost || 0 
                  });
                  if (!editingOrder) setShippingCost(cData.default_shipping_cost || 0);
              }

              // Fetch add-on definitions from backend (authoritative)
              try {
                  const addons = await fetchWithAuth('/company/addons').catch(() => null);
                  if (addons && Array.isArray(addons)) {
                      try {
                          // Avoid updating App-level state if data is identical (prevents unnecessary re-renders)
                          const current = JSON.stringify(addOnDefinitions || []);
                          const incoming = JSON.stringify(addons || []);
                          if (current !== incoming) {
                              setAddOnDefinitions(addons);
                              setAddOnOptions(buildAddOnOptionsState(addons));
                          }
                      } catch {
                          // Fallback: if serialization fails, just set state
                          setAddOnDefinitions(addons);
                          setAddOnOptions(buildAddOnOptionsState(addons));
                      }
                  }
              } catch (err) {
                  console.warn('Failed to load addons from backend, using defaults', err);
              }

              // Set default selections (with safety check)
              if (!editingOrder) { 
                  if (fData?.length > 0) setSelectedFabric(fData[0].name);
                  else setSelectedFabric("");
                  
                  // Use fetched neck types for default selection
                  const neckTypesFromStorage = getNeckTypes();
                  if (neckTypesFromStorage?.length > 0) setSelectedNeck(neckTypesFromStorage[0].name);
                  else setSelectedNeck("");
                  
                  if (sData?.length > 0) setSelectedSleeve(sData[0].name);
                  else setSelectedSleeve("");
              }
          } catch (e) { 
              console.error("Failed to fetch masters:", e);
              onNotify("ไม่สามารถโหลดข้อมูลสินค้า", "error");
          } finally {
              setIsLoading(false);
          }
            };
            fetchMasters();
        }, [editingOrder, onNotify, setAddOnDefinitions, setAddOnOptions, addOnDefinitions, availableNeckTypes]);

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);

    const isOversizeAllowed = useMemo(
        () => SLOPE_SHOULDER_SUPPORTED_NECKS.some(n => selectedNeck.includes(n)),
        [selectedNeck]
    );

    // If selected neck forces slope shoulder, detect it here
    const isSlopeForcedByNeck = useMemo(() => isForceSlopeNeck(selectedNeck), [selectedNeck]);

    useEffect(() => {
        if (productType !== 'shirt') {
            setSelectedNeck("");
            setSelectedSleeve("");
            setIsOversize(false);
                setAddOnOptions(buildAddOnOptionsState(addOnDefinitions));
        }
    }, [productType, addOnDefinitions]);

  // NEW: Calculate quantities for oversize surcharge
  const oversizeSurchargeQty = useMemo(() => {
        if (productType !== 'shirt') return 0;
    if (isOversize) {
      // Oversize: 2XL+ gets +100
      return (quantities['2XL'] || 0) + (quantities['3XL'] || 0) + (quantities['4XL'] || 0) + (quantities['5XL'] || 0);
    } else {
      // Normal: 4XL+ gets +100
      return (quantities['4XL'] || 0) + (quantities['5XL'] || 0);
    }
    }, [quantities, isOversize, productType]);

  // NEW: Auto-select ไหล่สโลป when Oversize is selected (for supported necks)
  useEffect(() => {
        if (productType !== 'shirt') return;
        if (isOversize && !isOversizeAllowed) {
            setIsOversize(false);
            onNotify("ทรงโอเวอร์ไซส์ทำได้เฉพาะ คอกลม, คอวี, คอวีตัด, คอวีปก", "error");
            return;
        }
        if (isOversize && isOversizeAllowed) {
            setAddOnOptions(prev => ({ ...prev, oversizeSlopeShoulder: true, slopeShoulder: false }));
        } else if (!isOversize) {
            setAddOnOptions(prev => ({ ...prev, oversizeSlopeShoulder: false }));
        }
    }, [isOversize, selectedNeck, isOversizeAllowed, productType, onNotify]);

    useEffect(() => {
        if (productType !== 'shirt') return;
        if (selectedNeck.includes('มีลิ้น') && !isSlopeForcedByNeck) {
            setAddOnOptions(prev => ({ ...prev, collarTongue: true }));
        } else if (isSlopeForcedByNeck) {
            // When neck forces slope, ensure collarTongue is not selected (price included)
            setAddOnOptions(prev => ({ ...prev, collarTongue: false }));
        }
    }, [selectedNeck, productType, isSlopeForcedByNeck]);

    // Auto-apply slopeShoulder when selected neck requires it
    useEffect(() => {
        if (productType !== 'shirt') return;
        if (isSlopeForcedByNeck) {
            // If this is one of the special collar shapes where we want to
            // show 300 + slope add-on (instead of embedding 40 into base), skip
            // disabling slopeShoulder here.
            const selNorm = normalizeNeckName(selectedNeck || '');
            const isSpecial340 = SPECIAL_NECKS_FORCE_340_UI.some(n => normalizeNeckName(n) === selNorm || selNorm.includes(normalizeNeckName(n)));
            if (isSpecial340) return;

            // When neck forces slope and it's NOT in the special UI list,
            // do NOT tick slopeShoulder or collarTongue in add-ons because
            // their cost is considered included in the neck price (+40).
            setAddOnOptions(prev => ({ ...prev, slopeShoulder: false, collarTongue: false }));
        }
    }, [isSlopeForcedByNeck, productType, selectedNeck]);

    // NEW: Calculate pricing server-side — call backend pricing API
    useEffect(() => {
        let mounted = true;
        const calc = async () => {
            try {
                if (totalQty <= 0) {
                    if (!mounted) return;
                    setBasePrice(0);
                    setAddOnCost(0);
                    setShippingCost(0);
                    return;
                }

                // build selected addon ids
                const selectedAddOns = (addOnDefinitions || []).filter(opt => addOnOptions[opt.id]).map(o => o.id);

                const payload = {
                    total_qty: totalQty,
                    product_type: productType,
                    quantity_matrix: quantities,
                    product_is_oversize: isOversize,
                    fabric_name: selectedFabric || null,
                    neck_name: selectedNeck || null,
                    sleeve_name: selectedSleeve || null,
                    addon_ids: selectedAddOns,
                    is_vat_included: isVatIncluded
                };

                const res = await fetchWithAuth('/pricing/calc', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).catch(() => null);

                if (!res) return;
                if (!mounted) return;

                setBasePrice(res.price_per_unit || 0);
                setAddOnCost(res.item_addon_total || 0);
                setShippingCost(res.shipping_cost || 0);
                // Note: sizing surcharge and VAT handled/displayed from derived values
            } catch (err) {
                console.error('Pricing API failed:', err);
            }
        };
        calc();
        return () => { mounted = false; };
    }, [
        totalQty,
        selectedNeck,
        productType,
        selectedFabric,
        selectedSleeve,
        isOversize,
        isVatIncluded,
        quantities,
        addOnOptions,
        addOnDefinitions
    ]);

    // Shipping cost is calculated on the backend now; frontend reads it from pricing API.

  // neckExtraPrice ตอนนี้รวมเข้า basePrice แล้ว ไม่ต้อง setNeckExtraPrice แยก
  // แต่ยังเก็บไว้สำหรับแสดง UI

    // NEW: Calculate Add-on Options total
    const addOnOptionsTotal = useMemo(() => {
                if (productType !== 'shirt') return 0;
        // If backend provided `addOnCost`, prefer that authoritative value
        if (addOnCost && Number(addOnCost) > 0) return Number(addOnCost);
        return (addOnDefinitions || []).reduce((total, opt) => {
                // If slope is forced by neck and its cost is already included in basePrice, skip counting it here
                // but for our special UI necks we want to show 300 + slope add-on, so count it there.
                const selNorm = normalizeNeckName(selectedNeck || '');
                const isSpecial340Local = SPECIAL_NECKS_FORCE_340_UI.some(n => normalizeNeckName(n) === selNorm || selNorm.includes(normalizeNeckName(n)));
                if (opt.id === 'slopeShoulder' && isSlopeForcedByNeck && !isSpecial340Local) return total;
            if (addOnOptions[opt.id]) {
                return total + (opt.price * totalQty);
            }
            return total;
        }, 0);
        }, [addOnOptions, totalQty, productType, isSlopeForcedByNeck, addOnDefinitions, selectedNeck, addOnCost]);

  // NEW: Calculate sizing surcharge
    const sizingSurcharge = productType === 'shirt' ? oversizeSurchargeQty * 100 : 0;

  const productSubtotal = totalQty * basePrice;
  // neckExtraPrice รวมเข้า basePrice แล้ว ไม่ต้องบวกแยก
  const totalBeforeCalc = productSubtotal + sizingSurcharge + addOnOptionsTotal + addOnCost + shippingCost - discount;
    
    let vatAmount = 0, grandTotal = 0;
    if (isVatIncluded) {
        // VAT already included in prices
        vatAmount = totalBeforeCalc * (config.vat_rate / (1 + config.vat_rate));
        grandTotal = totalBeforeCalc;
    } else {
        // VAT not included yet
        vatAmount = totalBeforeCalc * config.vat_rate;
        grandTotal = totalBeforeCalc + vatAmount;
    }
  
  // NEW: 50/50 deposit calculation
  const calculatedDeposit1 = Math.ceil(grandTotal / 2);
    // Include any previously paid advance hold (e.g. 500/1000) deducted from deposit 2
    const calculatedDeposit2 = grandTotal - calculatedDeposit1 - designFee - advanceHold;
  
  // Auto-set deposit1 to 50% when grandTotal changes (only for new orders)
  useEffect(() => {
    if (!editingOrder) {
      setDeposit1(calculatedDeposit1);
    }
  }, [calculatedDeposit1, editingOrder]);

    useEffect(() => {
        if (!editingOrder) {
            setDeposit2(0);
        }
    }, [calculatedDeposit2, editingOrder]);
  
  const balance = grandTotal - deposit1 - deposit2;

  const generateOrderId = useCallback(() => {
        return editingOrder ? editingOrder.order_no : (customerId?.trim() || "");
    }, [editingOrder, customerId]);

  const handleSaveOrder = async () => {
        // Validation: Check if job code is provided
        if (!customerId || customerId.trim() === "") {
                onNotify("กรุณากรอกรหัสงาน", "error");
                return;
        }

    // Validation: Check if customer name is provided
    if (!customerName || customerName.trim() === "") {
        onNotify("กรุณากรอกชื่อลูกค้า", "error");
        return;
    }

    // Validation: Check if at least one quantity is > 0
    const hasQuantity = Object.values(quantities).some(qty => qty > 0);
    if (!hasQuantity) {
        onNotify("กรุณากรอกจำนวนสินค้าอย่างน้อย 1 ชิ้น", "error");
        return;
    }

    // ⚠️ NEW VALIDATION: Check if basePrice is reasonable
    if (basePrice < 50 || basePrice > 500) {
        console.error("⛔ SUSPICIOUS BASE PRICE:", basePrice);  
        onNotify(`ราคาต่อหน่วยผิดปกติ: ${basePrice} บาท (ควรอยู่ระหว่าง 50-500)`, "error");
        return;
    }

    try {
        // !! CRITICAL DEBUG LOGGING
        console.log("=== DEBUG: Order Pricing ===");
        console.log("basePrice (raw):", basePrice);
        console.log("basePrice (type):", typeof basePrice);
        console.log("basePrice (Number):", Number(basePrice));
        console.log("productSubtotal:", productSubtotal);
        console.log("totalQty:", totalQty);
        console.log("Calculation check:", totalQty, "×", basePrice, "=", totalQty * basePrice);
        console.log("===========================");
        
        // Build final items list: combine previously added items and current form item (if any)
        const finalItems = [...orderItems];
        if (totalQty > 0) {
            const productName = productType === 'sportsPants'
                ? 'กางเกงกีฬา'
                : productType === 'fashionPants'
                    ? 'กางเกงแฟชั่น'
                    : `${selectedNeck || 'เสื้อ'} ${selectedSleeve || ''}`.trim();
            finalItems.push({
                product_name: productName,
                fabric_type: selectedFabric || null,
                neck_type: productType === 'shirt' ? (selectedNeck || null) : null,
                sleeve_type: productType === 'shirt' ? (selectedSleeve || null) : null,
                quantity_matrix: quantities,
                total_qty: totalQty,
                base_price: Number(basePrice) || 0,
                price_per_unit: Number(basePrice) || 0,
                total_price: Number(productSubtotal) || 0,
                cost_per_unit: 0,
                total_cost: 0
            });
        }
            // attach per-item add-ons and oversize flag for backend
                // If slope is forced by neck and included in basePrice, don't send it as selected_add_ons to avoid double-count
                const selNormForPayload = normalizeNeckName(selectedNeck || '');
                const isSpecialForPayload = SPECIAL_NECKS_FORCE_340_UI.some(n => normalizeNeckName(n) === selNormForPayload || selNormForPayload.includes(normalizeNeckName(n)));
                const selectedAddOns = (addOnDefinitions || []).filter(opt => addOnOptions[opt.id]).map(o => o.id).filter(id => {
                    // Exclude slopeShoulder and collarTongue from payload when neck forces slope
                    // but if this is one of the special UI necks we DO want to include the slope add-on
                    if (isSlopeForcedByNeck && !isSpecialForPayload && (id === 'slopeShoulder' || id === 'collarTongue')) return false;
                    return true;
                });
                finalItems[finalItems.length - 1].selected_add_ons = selectedAddOns;
                finalItems[finalItems.length - 1].is_oversize = Boolean(isOversize);
                // Indicate explicitly that slope fee is already included in base price when forced (and NOT the special UI case)
                finalItems[finalItems.length - 1].slope_included_in_base = Boolean(isSlopeForcedByNeck && !isSpecialForPayload);

        if (finalItems.length === 0) {
            onNotify('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการก่อนบันทึก', 'error');
            return;
        }

        const orderData = {
            order_no: customerId.trim(),
            customer_name: customerName && customerName.trim() !== "" ? customerName.trim() : null,
            phone: phoneNumber && phoneNumber.trim() !== "" ? phoneNumber.trim() : null,
            contact_channel: contactChannel || null,
            address: address && address.trim() !== "" ? address.trim() : null,
            graphic_code: graphicCode && graphicCode.trim() !== "" ? graphicCode.trim() : null,
            brand: brand,
            design_fee: Number(designFee) || 0,
            product_type: productType,
            shipping_cost: Number(shippingCost) || 0,
            add_on_cost: Number(addOnCost) || 0,
            sizing_surcharge: Number(sizingSurcharge) || 0,
            add_on_options_total: Number(addOnOptionsTotal) || 0,
            discount_type: "THB",
            discount_value: Number(discount) || 0,
            discount_amount: Number(discount) || 0,
            deposit_1: Number(deposit1) || 0,
            deposit_2: Number(deposit2) || 0,
            deposit_amount: Number(deposit1 + deposit2) || 0,
            is_vat_included: Boolean(isVatIncluded),
            status: status || "draft",
            urgency_level: urgencyStatus || "normal",
            deadline: deadline && deadline.trim() !== "" ? new Date(deadline).toISOString() : null,
            usage_date: deliveryDate && deliveryDate.trim() !== "" ? new Date(deliveryDate).toISOString() : null,
            note: note && note.trim() !== "" ? note.trim() : null,
            advance_hold: Number(advanceHold) || 0,
            items: finalItems
        };

        console.log("Sending order data:", JSON.stringify(orderData, null, 2));

        const url = editingOrder ? `/orders/${editingOrder.id}` : '/orders/';
        const method = editingOrder ? 'PUT' : 'POST';
        
        const response = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(orderData)
        });
        
        console.log("Order saved successfully:", response);
        onNotify(editingOrder ? "แก้ไขออเดอร์สำเร็จ" : "สร้างออเดอร์สำเร็จ", "success");
        setShowSuccess(true);
        
        // Navigate back to order list after 1.5 seconds
        setTimeout(() => {
            onNavigate('order_list');
        }, 1500);
    } catch (e) {
        console.error("Order save error:", e);
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
    const diffDays = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)); 
        // Red: 3-5 days, Yellow: 7-10 days, Green: 10-14 days (default)
        if (diffDays <= 5) {
      setUrgencyStatus("critical");
    } else if (diffDays <= 10) {
      setUrgencyStatus("warning");
    } else {
      setUrgencyStatus("normal");
    }
  }, [deadline]);

  const theme = {
    critical: { border: "border-l-8 border-rose-500", header: "bg-rose-500 text-white", invoiceBg: "bg-rose-500" },
    warning: { border: "border-l-8 border-amber-500", header: "bg-amber-500 text-white", invoiceBg: "bg-amber-500" },
    normal: { border: "border-l-8 border-emerald-500", header: "bg-emerald-500 text-white", invoiceBg: "bg-emerald-500" }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 md:p-10 fade-in overflow-y-auto bg-[#f0f2f5] h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-10 h-10 border-4 border-gray-300 border-t-[#1a1c23] rounded-full mb-4"></div>
          <p className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-10 fade-in overflow-y-auto bg-[#f0f2f5] h-full">
        {showPreview && <InvoiceModal data={{
            customerName,
            customerId,
            graphicCode,
            phoneNumber,
            contactChannel,
            address,
            deadline,
            deliveryDate,
            brand,
            quantities,
            totalQty,
            basePrice,
            productSubtotal,
            sizingSurcharge,
            oversizeSurchargeQty,
            addOnOptionsTotal,
            selectedAddOns: ADDON_OPTIONS.filter(opt => addOnOptions[opt.id]),
            addOnCost, 
            shippingCost, 
            discount, 
            isVatIncluded, 
            vatAmount, 
            grandTotal, 
            deposit1,
            deposit2,
            designFee,
            balance, 
            fabric: selectedFabric, 
            neck: selectedNeck, 
            sleeve: selectedSleeve, 
            order_no: generateOrderId(),
            urgencyStatus,
            isOversize,
            isFactoryView
        }} onClose={() => setShowPreview(false)} />}
        {showSuccess && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in px-4">
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full">
                    <div className="w-16 sm:w-20 h-16 sm:h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"><CheckCircle size={40} className="sm:w-12 sm:h-12 text-emerald-500"/></div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">บันทึกสำเร็จ!</h3>
                    <button onClick={() => { setShowSuccess(false); onNavigate('order_list'); }} className="w-full bg-slate-900 text-white font-bold py-2.5 sm:py-3 rounded-xl mt-4">กลับหน้ารายการ</button>
                </div>
            </div>
        )}

        {/* Add Custom Size Modal */}
        {showAddSizeModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm fade-in px-4">
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg sm:text-xl font-black text-[#1a1c23]">เพิ่มไซส์ใหม่</h3>
                        <button 
                            onClick={() => { setShowAddSizeModal(false); setNewSizeInput(""); }}
                            className="text-gray-400 hover:text-gray-600 transition"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">ป้อนชื่อไซส์ที่ต้องการเพิ่ม เช่น 6XL, 7XL หรือขนาดอื่นๆ</p>
                    
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-700 mb-2">ชื่อไซส์ใหม่</label>
                        <input 
                            type="text"
                            className="w-full border-2 border-gray-200 p-3 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm md:text-base"
                            placeholder="เช่น 6XL, 7XL, ขนาดกำหนดเอง"
                            value={newSizeInput}
                            onChange={(e) => setNewSizeInput(e.target.value.toUpperCase())}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSize()}
                            autoFocus
                        />
                    </div>

                    {displaySizes.includes(newSizeInput.trim()) && newSizeInput.trim() && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-800 font-semibold">⚠️ ไซส์นี้มีอยู่แล้ว</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setShowAddSizeModal(false); setNewSizeInput(""); }}
                            className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition text-sm md:text-base"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            onClick={handleAddCustomSize}
                            disabled={!newSizeInput.trim() || displaySizes.includes(newSizeInput.trim())}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition text-sm md:text-base flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            <span>เพิ่มไซส์</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        <header className="mb-6 sm:mb-8 flex items-center justify-between gap-3">
             <div className="flex items-center gap-3">
                 <button onClick={() => onNavigate('order_list')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center border hover:bg-gray-50 shadow-sm"><ArrowLeft size={20}/></button>
                 <h1 className="text-xl sm:text-2xl font-black text-[#1a1c23]">{editingOrder ? "แก้ไขออเดอร์" : "สร้างออเดอร์ใหม่"}</h1>
             </div>
             <div className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold ${theme[urgencyStatus].header}`}><AlertCircle size={16} className="inline mr-1 sm:mr-2"/>{urgencyStatus.toUpperCase()}</div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
                <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 flex items-center text-gray-800"><User className="mr-2" size={18}/> ข้อมูลลูกค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <input type="text" className="border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" placeholder="ชื่อลูกค้า" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        <input type="text" className="border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" placeholder="เบอร์โทร" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                        
                        <input type="text" className="border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" placeholder="รหัสงาน" value={customerId} onChange={e => setCustomerId(e.target.value)} />
                        <input type="text" className="border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" placeholder="แอดมิน" value={graphicCode} onChange={e => setGraphicCode(e.target.value)} />
                        
                        <select className="border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={contactChannel} onChange={e => setContactChannel(e.target.value)}><option>LINE OA</option><option>Facebook</option><option>โทรศัพท์</option></select>
                        <input type="date" className="border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                        <textarea className="col-span-1 md:col-span-2 border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" placeholder="ที่อยู่" value={address} onChange={e => setAddress(e.target.value)}></textarea>
                        <textarea className="col-span-1 md:col-span-2 border-gray-200 border p-2.5 md:p-3 rounded-xl bg-yellow-50 focus:bg-white transition text-sm md:text-base" placeholder="หมายเหตุ (Note)" value={note} onChange={e => setNote(e.target.value)}></textarea>
                    
                        <div>
                            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">วันที่จัดส่ง</label>
                            <input type="date" className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 text-sm md:text-base" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                        </div>

                        <div>
                            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">สถานะงาน</label>
                            <select className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-white focus:ring-2 focus:ring-[#1a1c23] text-sm md:text-base" value={status} onChange={(e) => setStatus(e.target.value)}>
                                {statusOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 flex items-center text-gray-800"><Box className="mr-2" size={18}/> รายละเอียดสินค้า</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                        <div>
                            <label className="block text-xs md:text-sm mb-1 text-gray-500">แบรนด์</label>
                            <select className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={brand} onChange={e => setBrand(e.target.value)}>
                                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm mb-1 text-gray-500">ประเภทสินค้า</label>
                            <select className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={productType} onChange={e => setProductType(e.target.value)}>
                                {PRODUCT_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-xs md:text-sm mb-1 text-gray-500">ชนิดผ้า</label>
                            <select className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={selectedFabric} onChange={e => setSelectedFabric(e.target.value)}>
                                <option value="">-- เลือกผ้า --</option>
                                {fabrics.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm mb-1 text-gray-500">คอเสื้อ</label>
                            <select className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={selectedNeck} onChange={e => setSelectedNeck(e.target.value)} disabled={productType !== 'shirt'}>
                                <option value="">-- เลือกคอ --</option>
                                {availableNeckTypes.map(n => (
                                    <option key={n.id} value={n.name}>
                                        {n.name}
                                        {n.extraPrice > 0 && n.forceSlope ? (
                                            <span> (+{n.extraPrice} รวมใน basePrice, บังคับไหล่สโลป)</span>
                                        ) : n.extraPrice > 0 ? (
                                            <span> (+{n.extraPrice} รวมใน basePrice)</span>
                                        ) : n.forceSlope ? (
                                            <span> (บังคับไหล่สโลป+40 บาท/ตัว)</span>
                                        ) : null}
                                    </option>
                                ))}
                            </select>
                            {neckExtraPrice > 0 && (
                                <div className="mt-1 text-xs text-orange-600 font-medium">
                                    📍 ราคาคอ +{neckExtraPrice} บาท/ตัว (รวมใน basePrice แล้ว)
                                </div>
                            )}
                            {selectedNeck.includes('ปก') && (
                                <div className="mt-1 text-xs text-purple-600 font-medium">
                                    🏷️ ใช้เรทราคา: คอปก/อื่นๆ
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm mb-1 text-gray-500">แขนเสื้อ</label>
                            <select className="w-full border-gray-200 border p-2.5 md:p-3 rounded-xl bg-gray-50 focus:bg-white transition text-sm md:text-base" value={selectedSleeve} onChange={e => setSelectedSleeve(e.target.value)} disabled={productType !== 'shirt'}>
                                <option value="">-- เลือกแขน --</option>
                                {sleeves.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {productType !== 'shirt' && (
                        <div className="mb-4 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            <Info size={12} className="inline mr-1"/> กางเกงจะคิดราคาต่อชิ้นตามประเภทสินค้า (ไม่ใช้คอเสื้อ/แขนเสื้อ และไม่คิด Add-on)
                        </div>
                    )}
                    
                    {/* NEW: Oversize Checkbox */}
                    {productType === 'shirt' && (
                    <div className="mb-4 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="mr-3 w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500" 
                                checked={isOversize} 
                                onChange={e => setIsOversize(e.target.checked)}
                            />
                            <div>
                                <span className="font-bold text-sm md:text-base text-gray-800">ทรง Oversize</span>
                                <p className="text-xs text-gray-500">ไซส์ 2XL ขึ้นไป +100 บาท/ตัว (ปกติ 4XL ขึ้นไป +100)</p>
                            </div>
                        </label>
                        {isOversize && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-100 p-2 rounded">
                                <Info size={12} className="inline mr-1"/> ไหล่สโลปโอเวอร์ไซส์ จะถูกเลือกอัตโนมัติ (เฉพาะคอกลม, คอวี, คอวีตัด, คอวีปก)
                            </div>
                        )}
                    </div>
                    )}

                    {/* NEW: Add-on Options */}
                    {productType === 'shirt' && (
                    <div className="mb-4 p-3 md:p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <label className="block text-xs md:text-sm font-bold text-gray-700 mb-3">ตัวเลือกเพิ่มเติม</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                            {(addOnDefinitions || ADDON_OPTIONS).map(opt => (
                                <label key={opt.id} className={`flex items-center p-2 md:p-3 rounded-lg border cursor-pointer transition ${addOnOptions[opt.id] ? 'bg-purple-100 border-purple-400' : 'bg-white border-gray-200 hover:border-purple-300'}`}>
                                    <input 
                                        type="checkbox" 
                                        className="mr-2 rounded text-purple-600" 
                                        checked={addOnOptions[opt.id] || false}
                                        disabled={
                                            (opt.id === 'slopeShoulder' && isOversize && isOversizeAllowed) ||
                                            (opt.id === 'slopeShoulder' && isSlopeForcedByNeck) ||
                                            (opt.id === 'oversizeSlopeShoulder' && isOversize && isOversizeAllowed) ||
                                            (opt.id === 'collarTongue' && isSlopeForcedByNeck)
                                        }
                                        onChange={e => setAddOnOptions({...addOnOptions, [opt.id]: e.target.checked})}
                                    />
                                    <div>
                                        <span className="text-xs md:text-sm font-medium text-gray-700">{opt.name}</span>
                                        <span className="block text-[10px] md:text-xs text-purple-600">+{opt.price} บาท/ตัว</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {addOnOptionsTotal > 0 && (
                            <div className="mt-3 text-sm font-bold text-purple-700">
                                รวม Add-on: {addOnOptionsTotal.toLocaleString()} บาท ({totalQty} ตัว)
                            </div>
                        )}
                    </div>
                    )}

                    <div className="bg-gray-50 p-4 md:p-6 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <label className="block text-xs md:text-sm font-bold text-gray-700">ระบุจำนวน</label>
                            <button
                                type="button"
                                onClick={openAddSizeModal}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                            >
                                <Plus size={16} />
                                <span>เพิ่มไซส์</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-4">
                            {displaySizes.map((size) => {
                                const isSurcharge = isOversize 
                                    ? ['2XL', '3XL', '4XL', '5XL'].includes(size)
                                    : ['4XL', '5XL'].includes(size);
                                return (
                                    <div key={size} className="text-center">
                                        <label className={`text-xs font-bold mb-1 block ${isSurcharge ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {size} {isSurcharge && <span className="text-[10px]">+100</span>}
                                        </label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            className={`w-full text-center border rounded-lg p-1.5 md:p-2 focus:ring-2 focus:ring-[#1a1c23] text-xs md:text-base ${isSurcharge ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`} 
                                            placeholder="0"
                                            value={quantities[size] || ''}
                                            onChange={(e) => setQuantities({...quantities, [size]: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {sizingSurcharge > 0 && (
                            <div className="mt-3 text-sm font-bold text-orange-600">
                                ค่าไซส์พิเศษ: +{sizingSurcharge.toLocaleString()} บาท ({oversizeSurchargeQty} ตัว)
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="lg:col-span-1">
                <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg border border-gray-100 sticky top-6">
                    <div className="flex justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-gray-100">
                        <h3 className="text-lg md:text-xl font-black text-[#1a1c23]">สรุปยอด</h3>
                        {/* Factory View Toggle */}
                        <label className="flex items-center cursor-pointer text-xs">
                            <input type="checkbox" className="mr-1 rounded" checked={isFactoryView} onChange={e => setIsFactoryView(e.target.checked)}/>
                            <span className="text-gray-500">Factory View</span>
                        </label>
                    </div>
                    <div className="space-y-3 md:space-y-4 mb-6 md:mb-8 text-xs md:text-sm text-gray-600">
                        <div className="flex justify-between"><span>จำนวนรวม</span><span className="font-bold text-gray-800">{totalQty} ตัว</span></div>
                        
                        {!isFactoryView && (
                            <>
                                <div className="flex justify-between items-center bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-200">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-blue-700">ราคาขาย/ตัว (อัตโนมัติ)</span>
                                        <span className="text-[10px] text-blue-500">
                                            {productType === 'shirt'
                                                ? (selectedNeck.includes('ปก') ? 'เรท: คอปก/คออื่นๆ' : (ROUND_V_NECK_TYPES.some(type => selectedNeck.includes(type)) ? 'เรท: คอกลม/คอวี' : 'เรท: คอปก/คออื่นๆ'))
                                                : (productType === 'sportsPants' ? 'เรท: กางเกงกีฬา' : 'เรท: กางเกงแฟชั่น')}
                                            {productType === 'shirt' && neckExtraPrice > 0 && ` (+${neckExtraPrice} บาท/ตัว)`}
                                        </span>
                                    </div>
                                    <span className="font-bold text-blue-700 text-lg">{basePrice.toLocaleString()} ฿</span>
                                </div>
                                
                                {/* Pricing Reference Table */}
                                {productType === 'shirt' && (
                                    <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded -mt-1 border border-gray-100">
                                        <div className="font-bold mb-1">ตารางเรทราคา: {neckExtraPrice > 0 && <span className="text-orange-500">(+{neckExtraPrice} บาท/ตัว สำหรับคอนี้)</span>}</div>
                                        <div className="grid grid-cols-3 gap-1">
                                            <span className="font-semibold">จำนวน</span>
                                            <span className="text-center">คอกลม/วี</span>
                                            <span className="text-right">คอปก/อื่นๆ</span>
                                            
                                            <span className={totalQty >= 10 && totalQty <= 30 ? 'font-bold text-blue-600' : ''}>10-30</span>
                                            <span className={`text-center ${totalQty >= 10 && totalQty <= 30 && !selectedNeck.includes('ปก') && ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t)) ? 'font-bold text-blue-600' : ''}`}>240</span>
                                            <span className={`text-right ${totalQty >= 10 && totalQty <= 30 && (selectedNeck.includes('ปก') || !ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t))) ? 'font-bold text-blue-600' : ''}`}>300</span>
                                            
                                            <span className={totalQty >= 31 && totalQty <= 50 ? 'font-bold text-blue-600' : ''}>31-50</span>
                                            <span className={`text-center ${totalQty >= 31 && totalQty <= 50 && !selectedNeck.includes('ปก') && ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t)) ? 'font-bold text-blue-600' : ''}`}>220</span>
                                            <span className={`text-right ${totalQty >= 31 && totalQty <= 50 && (selectedNeck.includes('ปก') || !ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t))) ? 'font-bold text-blue-600' : ''}`}>260</span>
                                            
                                            <span className={totalQty >= 51 && totalQty <= 100 ? 'font-bold text-blue-600' : ''}>51-100</span>
                                            <span className={`text-center ${totalQty >= 51 && totalQty <= 100 && !selectedNeck.includes('ปก') && ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t)) ? 'font-bold text-blue-600' : ''}`}>190</span>
                                            <span className={`text-right ${totalQty >= 51 && totalQty <= 100 && (selectedNeck.includes('ปก') || !ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t))) ? 'font-bold text-blue-600' : ''}`}>240</span>
                                            
                                            <span className={totalQty >= 101 && totalQty <= 300 ? 'font-bold text-blue-600' : ''}>101-300</span>
                                            <span className={`text-center ${totalQty >= 101 && totalQty <= 300 && !selectedNeck.includes('ปก') && ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t)) ? 'font-bold text-blue-600' : ''}`}>180</span>
                                            <span className={`text-right ${totalQty >= 101 && totalQty <= 300 && (selectedNeck.includes('ปก') || !ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t))) ? 'font-bold text-blue-600' : ''}`}>220</span>
                                            
                                            <span className={totalQty > 300 ? 'font-bold text-blue-600' : ''}>300+</span>
                                            <span className={`text-center ${totalQty > 300 && !selectedNeck.includes('ปก') && ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t)) ? 'font-bold text-blue-600' : ''}`}>170</span>
                                            <span className={`text-right ${totalQty > 300 && (selectedNeck.includes('ปก') || !ROUND_V_NECK_TYPES.some(t => selectedNeck.includes(t))) ? 'font-bold text-blue-600' : ''}`}>200</span>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Show pricing breakdown */}
                                <div className="text-[10px] text-gray-400 pl-2">
                                    ยอดสินค้า: {productSubtotal.toLocaleString()} บาท
                                </div>
                                
                                {sizingSurcharge > 0 && (
                                    <div className="flex justify-between text-orange-600">
                                        <span>ค่าไซส์พิเศษ ({oversizeSurchargeQty} ตัว)</span>
                                        <span>+{sizingSurcharge.toLocaleString()}</span>
                                    </div>
                                )}
                                
                                {addOnOptionsTotal > 0 && (
                                    <div className="flex justify-between text-purple-600">
                                        <span>ค่า Add-on Options</span>
                                        <span>+{addOnOptionsTotal.toLocaleString()}</span>
                                    </div>
                                )}
                                
                                {/* neckExtraPrice รวมเข้า basePrice แล้ว แสดงเป็น info */}
                                {neckExtraPrice > 0 && (
                                    <div className="text-[10px] text-orange-500 pl-2">
                                        (รวมค่าคอเสื้อ +{neckExtraPrice} บาท/ตัว ใน basePrice แล้ว)
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center"><span>ค่าบล็อก/อื่นๆ</span><input type="number" className="w-16 md:w-20 text-right border-gray-200 border rounded p-1 bg-gray-50 text-xs md:text-base" value={addOnCost} onChange={e => setAddOnCost(Number(e.target.value))}/></div>
                                <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                  <span className="font-semibold">ค่าขนส่ง (อัตโนมัติ)</span>
                                  <span className="font-bold">{shippingCost.toLocaleString()} ฿</span>
                                </div>
                                {totalQty > 100 && (
                                  <div className="text-xs text-emerald-600 px-2 -mt-1">
                                    = 230 + ({totalQty - 100} × {getExtraShippingCost()}) ฿
                                  </div>
                                )}
                                <div className="flex justify-between items-center text-red-500"><span>ส่วนลด</span><input type="number" className="w-16 md:w-20 text-right border-rose-200 border rounded p-1 bg-rose-50 text-rose-600 text-xs md:text-base" value={discount} onChange={e => setDiscount(Number(e.target.value))}/></div>
                                
                                <div className="flex justify-between items-center py-2 md:py-3 border-t border-dashed">
                                    <label className="flex items-center text-xs cursor-pointer">
                                        <input type="checkbox" className="mr-2 rounded text-[#1a1c23]" checked={isVatIncluded} onChange={e => setIsVatIncluded(e.target.checked)}/>
                                        ราคารวม VAT ({config.vat_rate*100}%)
                                    </label>
                                </div>

                                <div className="text-[10px] text-gray-500 px-2">
                                    หากต้องการใบกำกับภาษี กรุณาแจ้งแอดมินก่อนสรุปยอด
                                </div>

                                <div className="flex justify-between font-black text-lg md:text-2xl text-[#1a1c23] mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100"><span>ยอดสุทธิ</span><span>{grandTotal.toLocaleString()} ฿</span></div>
                                
                                {/* 50/50 Deposit Section with Design Fee */}
                                <div className="bg-emerald-50 p-2.5 md:p-3 rounded-xl space-y-2 md:space-y-3 mt-2 border border-emerald-200">
                                    <div className="text-xs font-bold text-emerald-800 mb-2">การชำระเงิน (50/50)</div>
                                    
                                    <div className="flex justify-between items-center text-xs">
                                        <span>มัดจำ 1 (50%)</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-gray-400">แนะนำ: {calculatedDeposit1.toLocaleString()}</span>
                                            <input type="number" className="w-16 md:w-20 border text-right border-gray-200 rounded p-1 bg-white text-xs md:text-base" value={deposit1} onChange={e=>setDeposit1(Number(e.target.value))}/>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-xs">
                                        <span>ค่าขึ้นแบบ (หักจากมัดจำ 2)</span>
                                        <input type="number" className="w-16 md:w-20 border text-right border-amber-200 rounded p-1 bg-amber-50 text-amber-700 text-xs md:text-base" value={designFee} onChange={e=>setDesignFee(Number(e.target.value))}/>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-xs">
                                        <span>มัดจำ 2 (หลังหักค่าขึ้นแบบ)</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-gray-400">แนะนำ: {calculatedDeposit2.toLocaleString()}</span>
                                            <input type="number" className="w-16 md:w-20 border text-right border-gray-200 rounded p-1 bg-white text-xs md:text-base" value={deposit2} onChange={e=>setDeposit2(Number(e.target.value))}/>
                                        </div>
                                    </div>
                                    
                                    {/* Quick-select advance hold (500/1000) to subtract from deposit 2 */}
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                        <span className="text-gray-600">มัดจำจองเดิม:</span>
                                        <div className="flex items-center gap-2">
                                            {[0,500,1000].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => setAdvanceHold(v)}
                                                    className={`px-2 py-1 text-xs rounded-lg border ${advanceHold === v ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                                >{v === 0 ? 'ไม่หัก' : v}</button>
                                            ))}
                                        </div>
                                        <div className="text-[11px] text-gray-500">(จะถูกหักจากมัดจำ 2 อัตโนมัติ)</div>
                                    </div>
                                    
                                    <div className="border-t border-emerald-300 pt-2 mt-2">
                                        <div className="flex justify-between font-bold text-emerald-700 text-xs md:text-sm">
                                            <span>ค้างชำระ</span>
                                            <span>{Math.abs(balance).toLocaleString()} บาท</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {isFactoryView && (
                            <div className="bg-gray-100 p-4 rounded-xl text-center text-gray-500">
                                <Box size={32} className="mx-auto mb-2 opacity-50"/>
                                <p className="text-sm font-bold">Factory View Mode</p>
                                <p className="text-xs">ราคาถูกซ่อน สำหรับส่งโรงงาน</p>
                            </div>
                        )}
                    </div>
                                        <div className="space-y-2">
                                            {orderItems.length > 0 && (
                                                <div className="bg-white p-2 rounded-lg border">
                                                    <div className="text-xs font-bold mb-2">รายการสินค้าที่เพิ่ม</div>
                                                    <div className="space-y-1">
                                                        {orderItems.map((it, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-sm">
                                                                <div className="truncate">{it.product_name} — {it.total_qty} ชิ้น</div>
                                                                <button className="text-red-500 text-xs" onClick={() => removeItemAt(idx)}>ลบ</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <button className="flex-1 py-2 text-sm font-bold bg-white border rounded-lg hover:bg-gray-50" onClick={addCurrentItemToList}>
                                                    <Plus className="inline mr-2" size={14}/> เพิ่มสินค้า
                                                </button>
                                                <button className="flex-1 bg-[#1a1c23] hover:bg-slate-800 text-white font-bold py-2.5 md:py-4 rounded-xl shadow-lg flex justify-center items-center transition text-sm md:text-base" onClick={handleSaveOrder}>
                                                    <Save className="mr-2" size={18}/> {editingOrder ? "บันทึกการแก้ไข" : "บันทึกออเดอร์"}
                                                </button>
                                            </div>
                                        </div>
                    <div className="grid grid-cols-3 gap-2 md:gap-3 mt-3 md:mt-4">
                        <button className="py-1.5 md:py-2 text-xs font-bold text-gray-500 border rounded-lg hover:bg-gray-50" onClick={() => { setIsFactoryView(false); setShowPreview(true); }}>ดูตัวอย่าง</button>
                        <button className="py-1.5 md:py-2 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50" onClick={() => { setIsFactoryView(true); setShowPreview(true); }}>ใบโรงงาน</button>
                        <button className="py-1.5 md:py-2 text-xs font-bold text-gray-500 border rounded-lg hover:bg-gray-50" onClick={handleCopySummary}>คัดลอก</button>
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto flex flex-col">
      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-4 sm:p-6 rounded-xl w-full max-w-sm sm:max-w-md shadow-xl">
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
                      <div className="hidden">
                          <label className="block text-sm font-medium text-slate-700 mb-1">จำนวน (คงเหลือ)</label>
                          <input 
                              type="number" 
                              min="0"
                              className="w-full border border-slate-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="0" 
                              value={0}
                              onChange={() => {}}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">ราคา Add-on</label>
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

      <header className="mb-4 sm:mb-6 md:mb-8 flex flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1a1c23]">สินค้า</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-500 font-medium">จัดการผ้าและวัตถุดิบ</p>
        </div>
        <button onClick={openAddModal} className="bg-[#1a1c23] text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg whitespace-nowrap text-xs sm:text-sm">
            <Plus size={14} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2"/> เพิ่มสินค้า
        </button>
      </header>
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[350px] sm:min-h-[400px] md:min-h-[500px]">
        <div className="flex border-b border-gray-100 overflow-x-auto">
            <TabButton id="ชนิดผ้า" label="ชนิดผ้า" />
            <TabButton id="รูปแบบคอ" label="รูปแบบคอ" />
            <TabButton id="รูปแบบแขน" label="รูปแบบแขน" />
        </div>
        <div className="p-1 sm:p-2 md:p-6 flex-1 overflow-x-auto">
            {loading ? <p className="p-10 text-center text-gray-400">Loading...</p> : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <th className="py-4 px-6 w-[50%] text-center border-r border-gray-200">ชื่อรายการ</th>
                            <th className="py-4 px-6 w-[30%] text-center border-r border-gray-200">ราคา Add-on</th>
                            <th className="py-4 px-6 w-[20%] text-center">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {paginatedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition group border-b border-gray-200">
                                <td className="py-4 px-6 font-bold text-gray-700 text-center border-r border-gray-200">{item.name}</td>
                                <td className="py-4 px-6 text-center text-gray-600 font-medium border-r border-gray-200">
                                    {item.cost_price ? `฿${parseFloat(item.cost_price).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <div className="flex justify-center gap-3">
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
                                <td colSpan="3" className="py-12 text-center">
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
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <PaginationControls 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        )}
      </div>
    </div>
  );
};

// 2.4 CUSTOMER PAGE (UI Layout Improved)
const CustomerPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [currentCustomer, setCurrentCustomer] = useState({ id: null, name: "", phone: "", channel: "LINE OA", address: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCustomers = async () => {
      setLoading(true);
      try {
          const data = await fetchWithAuth('/customers/');
          setCustomers(data || []);
    } catch { console.warn("Fetch failed"); }
      finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openAddModal = () => {
      setModalMode("add");
      setCurrentCustomer({ id: null, name: "", phone: "", channel: "LINE OA", address: "" });
      setIsModalOpen(true);
  };

  const openEditModal = (cust) => {
      setModalMode("edit");
      setCurrentCustomer({ 
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          channel: cust.channel || cust.contact_channel || "LINE OA",
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

  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const paginatedCustomers = customers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto flex flex-col">
      {/* Modal Form: ปรับ Layout ให้ดู Balance ขึ้น */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
              <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                      <h3 className="text-xl font-black text-[#1a1c23]">
                          {modalMode === 'add' ? 'เพิ่มลูกค้าใหม่' : 'แก้ไขข้อมูลลูกค้า'}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อลูกค้า</label>
                            <input 
                                className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c23] focus:bg-white transition" 
                                placeholder="ระบุชื่อลูกค้า" 
                                value={currentCustomer.name} 
                                onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">เบอร์โทรศัพท์</label>
                            <input 
                                className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c23] focus:bg-white transition" 
                                placeholder="0xx-xxx-xxxx" 
                                value={currentCustomer.phone} 
                                onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">ช่องทางติดต่อ</label>
                            <select 
                                className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c23] focus:bg-white transition cursor-pointer" 
                                value={currentCustomer.channel} 
                                onChange={e => setCurrentCustomer({...currentCustomer, channel: e.target.value})}
                            >
                                <option>LINE OA</option>
                                <option>Facebook</option>
                                <option>Phone</option>
                                <option>Walk-in</option>
                            </select>
                          </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">ที่อยู่จัดส่ง</label>
                        <textarea 
                            className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c23] focus:bg-white transition resize-none" 
                            placeholder="ระบุที่อยู่สำหรับจัดส่ง..." 
                            rows="3" 
                            value={currentCustomer.address} 
                            onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})}
                        ></textarea>
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                      <button 
                          onClick={() => setIsModalOpen(false)} 
                          className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition"
                      >
                          ยกเลิก
                      </button>
                      <button 
                          onClick={handleSave} 
                          className="px-6 py-2.5 text-sm font-bold bg-[#1a1c23] text-white rounded-xl hover:bg-slate-800 transition shadow-lg"
                      >
                          บันทึกข้อมูล
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
                  <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">ยืนยันการลบ</h3>
                  <p className="text-gray-500 mb-6 text-sm">
                      คุณต้องการลบข้อมูลลูกค้า <br/><span className="font-bold text-gray-800">"{deleteConfirm.name}"</span> ใช่หรือไม่?
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition">ยกเลิก</button>
                      <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition shadow-md">ยืนยันลบ</button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-4 sm:mb-6 md:mb-8 flex flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1a1c23]">ลูกค้า</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-500 font-medium">จัดการฐานข้อมูลลูกค้า</p>
        </div>
        <button onClick={openAddModal} className="bg-[#1a1c23] text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg whitespace-nowrap text-xs sm:text-sm">
            <Plus size={14} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2"/> เพิ่มลูกค้า
        </button>
      </header>
        
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[350px] sm:min-h-[400px] md:min-h-[500px]">
        <div className="p-0 overflow-x-auto flex-1">
            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mb-2"></div>
                    <p>กำลังโหลดข้อมูล...</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 sticky top-0 z-10">
                        <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {/* Adjusted Alignment */}
                            <th className="py-5 px-6 text-center w-[30%] border-r border-gray-200">ชื่อลูกค้า</th>
                            <th className="py-5 px-6 text-center w-[20%] border-r border-gray-200">ช่องทาง</th>
                            <th className="py-5 px-6 text-center w-[25%] border-r border-gray-200">เบอร์โทร</th>
                            <th className="py-5 px-6 text-center w-[25%]">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {paginatedCustomers.map((cust) => (
                            <tr key={cust.id} className="hover:bg-blue-50/30 transition duration-150 group border-b border-gray-200">
                                <td className="py-4 px-6 font-bold text-gray-700 group-hover:text-[#1a1c23] text-center border-r border-gray-200">
                                    {cust.name}
                                </td>
                                <td className="py-4 px-6 text-center border-r border-gray-200">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                        (cust.channel || cust.contact_channel) === 'LINE OA' ? 'bg-green-50 text-green-700 border-green-200' :
                                        (cust.channel || cust.contact_channel) === 'Facebook' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}>
                                        {cust.channel || cust.contact_channel || '-'}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-center text-sm text-gray-600 font-mono tracking-wide border-r border-gray-200">
                                    {cust.phone || '-'}
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            onClick={() => openEditModal(cust)} 
                                            className="p-2 text-gray-400 hover:text-[#1a1c23] hover:bg-gray-100 rounded-lg transition" 
                                            title="แก้ไข"
                                        >
                                            <Edit size={18}/>
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(cust)} 
                                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                                            title="ลบ"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {customers.length === 0 && (
                            <tr>
                                <td colSpan="4" className="py-20 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-300">
                                        <User size={64} className="mb-4 opacity-20" />
                                        <p className="text-lg font-medium text-gray-400">ยังไม่มีข้อมูลลูกค้า</p>
                                        <p className="text-sm mt-1 text-gray-300">เริ่มสร้างฐานลูกค้าของคุณได้เลย</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white">
                <span className="text-xs font-bold text-gray-400">
                    หน้า {currentPage} จาก {totalPages}
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        ก่อนหน้า
                    </button>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        ถัดไป
                    </button>
                </div>
            </div>
        )}
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
  const [currentPage, setCurrentPage] = useState(1);
  const [detailOrder, setDetailOrder] = useState(null);
  const itemsPerPage = 10;
   
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
          // Get the order to find the customer_id
          const orderToDelete = orders.find(o => o.id === id);
          
          // Delete the order
          await fetchWithAuth(`/orders/${id}`, { method: 'DELETE' });
          
          // If order has a customer_id, delete the customer as well
          if (orderToDelete && orderToDelete.customer_id) {
              try {
                  await fetchWithAuth(`/customers/${orderToDelete.customer_id}`, { method: 'DELETE' });
              } catch (err) {
                  console.warn("Could not delete customer:", err);
              }
          }
          
          setDeleteConfirm(null);
          fetchOrders();
      } catch (e) { alert("Error: " + e.message); }
  };

  const handleStatusChange = async (orderId, newStatus) => {
      try {
          const order = orders.find(o => o.id === orderId);
          if (!order) return;
          
          await fetchWithAuth(`/orders/${orderId}`, {
              method: 'PUT',
              body: JSON.stringify({
                  ...order,
                  status: newStatus,
                  customer_name: order.customer_name,
                  phone: order.phone,
                  contact_channel: order.contact_channel,
                  address: order.address,
                  items: []
              })
          });
          onNotify(`เปลี่ยนสถานะเป็น ${newStatus} สำเร็จ`, "success");
          fetchOrders();
      } catch (e) { 
          onNotify("เปลี่ยนสถานะไม่สำเร็จ: " + e.message, "error");
      }
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

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto flex flex-col">
      {/* Invoice Modal for Order Detail */}
      {detailOrder && (
        <InvoiceModal 
                    data={buildInvoiceDataFromOrder(detailOrder)}
          onClose={() => setDetailOrder(null)}
        />
      )}

      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-4 sm:p-6 rounded-xl w-full max-w-sm sm:max-w-md shadow-xl">
                  <div className="flex items-center mb-3 sm:mb-4">
                      <AlertCircle className="text-rose-500 mr-2 sm:mr-3" size={20} />
                      <h3 className="text-base sm:text-lg font-bold">ยืนยันการลบออเดอร์</h3>
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6">คุณต้องการลบออเดอร์ <span className="font-bold">"{deleteConfirm.order_no}"</span> ใช่หรือไม่?</p>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-3 sm:px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded transition">ยกเลิก</button>
                      <button onClick={() => handleDelete(deleteConfirm.id)} className="px-3 sm:px-4 py-2 text-sm bg-rose-600 text-white rounded hover:bg-rose-700 transition">ลบ</button>
                  </div>
              </div>
          </div>
      )}

      <header className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
            <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1a1c23]">รายการออเดอร์</h1>
                <p className="text-xs sm:text-sm md:text-base text-gray-500 font-medium">จัดการและติดตามสถานะการผลิต</p>
            </div>

            <div className="flex flex-row gap-2 w-full sm:w-auto">
                {/* Search bar */}
                <div className="relative flex-1 sm:min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 sm:top-3 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="ค้นหา..." 
                        className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-sm bg-white border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1c23]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl flex items-center hover:bg-emerald-700 transition shadow-lg whitespace-nowrap text-xs sm:text-sm">
                    <Download size={14} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2"/> Export
                </button>
                <button onClick={() => onNavigate('create_order')} className="bg-[#1a1c23] text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold flex items-center hover:bg-slate-800 transition shadow-lg whitespace-nowrap text-xs sm:text-sm">
                    <Plus size={14} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2"/> สร้างใหม่
                </button>
            </div>
        </div>
      </header>
        
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[350px] sm:min-h-[400px] md:min-h-[500px]">
        <div className="p-0 sm:p-1 md:p-2 overflow-x-auto flex-1">
            {loading ? <p className="text-center text-slate-500 py-6 sm:py-10 text-sm">Loading...</p> : (
                <table className="w-full text-left min-w-[600px] sm:min-w-[700px] md:min-w-[800px] table-fixed border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <th className="py-4 px-6 w-[15%] text-center border-r border-gray-200">รหัสงาน</th>
                            <th className="py-4 px-6 w-[20%] text-center border-r border-gray-200">ลูกค้า</th>
                            <th className="py-4 px-6 w-[15%] text-center border-r border-gray-200">กำหนดส่ง</th>
                            <th className="py-4 px-6 w-[15%] text-center border-r border-gray-200">ยอดรวม</th>
                            <th className="py-4 px-6 w-[15%] text-center border-r border-gray-200">สถานะ</th>
                            <th className="py-4 px-6 w-[20%] text-center">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {paginatedOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50 transition group cursor-pointer border-b border-gray-200" onClick={(e) => { if (!e.target.closest('select') && !e.target.closest('button')) setDetailOrder(order); }}>
                                <td className="py-4 px-6 font-mono font-bold text-gray-700 truncate text-center border-r border-gray-200">{order.order_no}</td>
                                <td className="py-4 px-6 text-gray-700 truncate text-center border-r border-gray-200">
                                    <div className="font-medium truncate">{order.customer_name}</div>
                                    <div className="text-xs text-gray-400">{order.contact_channel}</div>
                                </td>
                                <td className="py-4 px-6 text-gray-500 text-sm text-center border-r border-gray-200">
                                    {order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH') : '-'}
                                </td>
                                <td className="py-4 px-6 text-center font-bold text-gray-700 border-r border-gray-200">{order.grand_total?.toLocaleString()}</td>
                                <td className="py-4 px-6 text-center border-r border-gray-200">
                                    <select 
                                        value={order.status || 'draft'}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => { e.stopPropagation(); handleStatusChange(order.id, e.target.value); }}
                                        className="text-xs font-bold px-2 py-1 rounded border border-gray-300 bg-white focus:ring-2 focus:ring-[#1a1c23] outline-none cursor-pointer hover:border-gray-400 transition"
                                    >
                                        <option value="ร่าง">ร่าง</option>
                                        <option value="ออกแบบ">ออกแบบ</option>
                                        <option value="รออนุมัติ">รออนุมัติ</option>
                                        <option value="ผลิต">ผลิต</option>
                                        <option value="จัดส่ง">จัดส่ง</option>
                                        <option value="ส่งแล้ว">ส่งแล้ว</option>
                                    </select>
                                </td>
                                <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex justify-center gap-3">
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
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <PaginationControls 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        )}
      </div>
    </div>
  );
};

// 2.6 SETTINGS PAGE (UPDATED: Delete Modal & Save Notify)
const SettingsPage = ({ onNotify, addOnDefinitions, setAddOnDefinitions }) => {
  const [pricingRules, setPricingRules] = useState([]);
   
  // Pricing Rule State
  const [newRule, setNewRule] = useState({ min_qty: 0, max_qty: 0, fabric_type: "", unit_price: 0 });
  const [fabrics, setFabrics] = useState([]); 
  const [deleteConfirm, setDeleteConfirm] = useState(null); // State for delete modal

  // Global Config State
  const [globalConfig, setGlobalConfig] = useState({ vat_rate: 7, default_shipping_cost: 0 });

    // Add-on edit state for Settings page
    const [editingAddOnId, setEditingAddOnId] = useState(null);
    const [editingAddOnPrice, setEditingAddOnPrice] = useState(0);

  // Shipping Cost Table State
  const [shippingTable, setShippingTable] = useState(getShippingCostTable());
  const [extraShippingCost, setExtraShippingCost] = useState(getExtraShippingCost());
  const [newShippingRow, setNewShippingRow] = useState({ minQty: 0, maxQty: 0, cost: 0 });

    // Status Options State
    const [statusOptions, setStatusOptions] = useState(getStatusOptions());
    const [newStatusLabel, setNewStatusLabel] = useState("");
    const [newStatusValue, setNewStatusValue] = useState("");

  const fetchRulesAndMasters = async () => {
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
    fetchRulesAndMasters();
    fetchGlobalConfig();
  }, []);

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
    } catch { onNotify("ลบข้อมูลไม่สำเร็จ", "error"); }
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

  // --- Add-on price editor (Settings) ---
  const startEditAddOn = (opt) => {
      setEditingAddOnId(opt.id);
      setEditingAddOnPrice(opt.price || 0);
  };

  const cancelEditAddOn = () => {
      setEditingAddOnId(null);
      setEditingAddOnPrice(0);
  };

  const saveAddOnPrice = async () => {
      try {
          // Update local state first so UI updates immediately
          const updated = (addOnDefinitions || []).map(a => a.id === editingAddOnId ? { ...a, price: Number(editingAddOnPrice) } : a);
          setAddOnDefinitions(updated);

          // Try to persist to backend if endpoint exists (graceful fallback)
          try {
              await fetchWithAuth('/company/addons', {
                  method: 'PUT',
                  body: JSON.stringify(updated)
              });
          } catch (e) {
              // it's OK if backend doesn't support persistence yet
              console.warn('Persisting addons failed (backend may not support PUT /company/addons):', e.message || e);
          }

          onNotify('บันทึกราคา Add-on เรียบร้อยแล้ว', 'success');
      } catch (e) {
          console.error('Failed to save add-on price', e);
          onNotify('บันทึกราคา Add-on ไม่สำเร็จ', 'error');
      } finally {
          cancelEditAddOn();
      }
  };

  // Shipping Cost Table functions
  const handleAddShippingRow = () => {
    if (newShippingRow.minQty <= 0 || newShippingRow.maxQty <= 0 || newShippingRow.cost <= 0) {
      onNotify("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
      return;
    }
    const updatedTable = [...shippingTable, newShippingRow].sort((a, b) => a.minQty - b.minQty);
    setShippingTable(updatedTable);
    localStorage.setItem('shippingCostTable', JSON.stringify(updatedTable));
    setNewShippingRow({ minQty: 0, maxQty: 0, cost: 0 });
    onNotify("เพิ่มเงื่อนไขค่าขนส่งสำเร็จ", "success");
  };

  const handleDeleteShippingRow = (index) => {
    const updatedTable = shippingTable.filter((_, i) => i !== index);
    setShippingTable(updatedTable);
    localStorage.setItem('shippingCostTable', JSON.stringify(updatedTable));
    onNotify("ลบเงื่อนไขค่าขนส่งสำเร็จ", "success");
  };

  const handleSaveExtraShippingCost = () => {
    localStorage.setItem('extraShippingCostPerUnit', JSON.stringify(extraShippingCost));
    onNotify("บันทึกค่าขนส่งเพิ่มเติมสำเร็จ", "success");
  };

  const handleResetShippingTable = () => {
    setShippingTable(DEFAULT_SHIPPING_COST_TABLE);
    setExtraShippingCost(50);
    localStorage.setItem('shippingCostTable', JSON.stringify(DEFAULT_SHIPPING_COST_TABLE));
    localStorage.setItem('extraShippingCostPerUnit', JSON.stringify(50));
    onNotify("รีเซ็ตตารางค่าขนส่งเป็นค่าเริ่มต้น", "success");
  };

    const handleSaveStatusOptions = () => {
        saveStatusOptions(statusOptions);
        onNotify("บันทึกสถานะงานสำเร็จ", "success");
    };

    const handleAddStatusOption = () => {
        if (!newStatusLabel.trim()) {
            onNotify("กรุณากรอกชื่อสถานะ", "error");
            return;
        }
        const value = newStatusValue.trim() || newStatusLabel.trim();
        const next = [...statusOptions, { value, label: newStatusLabel.trim() }];
        setStatusOptions(next);
        setNewStatusLabel("");
        setNewStatusValue("");
        saveStatusOptions(next);
    };

    const handleDeleteStatusOption = (value) => {
        const next = statusOptions.filter(opt => opt.value !== value);
        setStatusOptions(next);
        saveStatusOptions(next);
    };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-10 fade-in h-full bg-[#f0f2f5] overflow-y-auto">
      {/* Delete Modal */}
      {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-4 sm:p-6 rounded-xl w-full max-w-sm sm:max-w-md shadow-xl">
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

      <header className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1a1c23]">ตั้งค่าระบบ</h1>
        <p className="text-xs sm:text-sm md:text-base text-gray-500 font-medium">กำหนดราคาและค่าเริ่มต้นของระบบ</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-8">
              {/* Left Column: Form + VAT */}
              <div className="space-y-3 sm:space-y-4 pr-0 lg:pr-2">
                  {/* Form เพิ่มกฎ */}
                  <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100">
                      <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 text-[#1a1c23]">เพิ่มเงื่อนไขราคา</h3>
                      <div className="space-y-2.5">
                          <div>
                              <label className="block text-xs font-medium mb-0.5">ชนิดผ้า</label>
                              <select 
                                className="w-full border p-1.5 rounded-lg text-sm"
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
                          <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                  <label className="block text-xs font-medium mb-0.5">ขั้นต่ำ (ตัว)</label>
                                  <input type="number" className="w-full border p-1.5 rounded-lg text-sm" value={newRule.min_qty} onChange={e => setNewRule({...newRule, min_qty: parseInt(e.target.value)||0})} />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium mb-0.5">ถึง (ตัว)</label>
                                  <input type="number" className="w-full border p-1.5 rounded-lg text-sm" value={newRule.max_qty} onChange={e => setNewRule({...newRule, max_qty: parseInt(e.target.value)||0})} />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-medium mb-0.5">ราคาต่อหน่วย (บาท)</label>
                              <input type="number" className="w-full border p-1.5 rounded-lg bg-gray-50 text-[#1a1c23] font-bold text-sm" value={newRule.unit_price} onChange={e => setNewRule({...newRule, unit_price: parseFloat(e.target.value)||0})} />
                          </div>
                          <button onClick={handleAddRule} className="bg-[#1a1c23] text-white font-bold py-2 px-6 text-sm rounded-xl hover:bg-slate-800 transition shadow-lg mx-auto block">บันทึก</button>
                      </div>
                  </div>

                  {/* VAT & Shipping Section */}
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                      <h3 className="text-sm font-bold text-[#1a1c23] mb-3 flex items-center">
                          <Calculator size={18} className="mr-2 text-gray-400"/>
                          ตั้งค่า VAT
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">อัตรา VAT (%)</label>
                              <div className="relative">
                                  <input 
                                      type="number" 
                                      className="w-full border border-gray-200 p-1.5 rounded-xl pl-8 text-sm" 
                                      placeholder="7" 
                                      value={globalConfig.vat_rate}
                                      onChange={e => setGlobalConfig({...globalConfig, vat_rate: parseFloat(e.target.value)})}
                                  />
                                  <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">%</span>
                              </div>
                          </div>
                      </div>
                      <button 
                          onClick={handleSaveConfig}
                          className="bg-[#1a1c23] text-white font-bold py-2 px-6 text-sm rounded-xl hover:bg-slate-800 transition mt-3 shadow-lg mx-auto block"
                      >
                          บันทึกการตั้งค่า
                      </button>
                  </div>

                  {/* Add-on Prices Editor */}
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-purple-100">
                      <h3 className="text-sm font-bold text-[#1a1c23] mb-3 flex items-center">
                          <Tag size={18} className="mr-2 text-purple-500" />
                          ราคาตัวเลือกเพิ่มเติม (Add-on)
                      </h3>
                      <div className="space-y-2">
                          {(addOnDefinitions || ADDON_OPTIONS).map(opt => (
                              <div key={opt.id} className="flex items-center justify-between gap-2">
                                  <div>
                                      <div className="text-sm font-medium">{opt.name}</div>
                                      <div className="text-xs text-gray-500">id: {opt.id}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      {editingAddOnId === opt.id ? (
                                          <>
                                              <input type="number" className="w-24 border p-1 rounded text-sm" value={editingAddOnPrice} onChange={e => setEditingAddOnPrice(parseFloat(e.target.value)||0)} />
                                              <button onClick={saveAddOnPrice} className="px-3 py-1 bg-purple-600 text-white rounded text-xs">บันทึก</button>
                                              <button onClick={cancelEditAddOn} className="px-3 py-1 text-xs border rounded">ยกเลิก</button>
                                          </>
                                      ) : (
                                          <>
                                              <div className="text-sm font-bold">+{opt.price} ฿/ตัว</div>
                                              <button onClick={() => startEditAddOn(opt)} className="ml-3 text-xs text-sky-600 hover:underline">แก้ไข</button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Status Options Section */}
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-blue-200">
                      <h3 className="text-sm font-bold text-[#1a1c23] mb-3 flex items-center">
                          <Info size={18} className="mr-2 text-blue-500"/>
                          ตั้งค่าสถานะงาน
                      </h3>
                      <div className="space-y-2">
                          {statusOptions.map((opt, idx) => (
                              <div key={`${opt.value}-${idx}`} className="flex items-center gap-2">
                                  <input
                                      type="text"
                                      className="flex-1 border border-gray-200 p-1.5 rounded-lg text-xs"
                                      value={opt.label}
                                      onChange={e => {
                                          const next = [...statusOptions];
                                          next[idx] = { ...next[idx], label: e.target.value };
                                          setStatusOptions(next);
                                      }}
                                  />
                                  <input
                                      type="text"
                                      className="flex-1 border border-gray-200 p-1.5 rounded-lg text-xs"
                                      value={opt.value}
                                      onChange={e => {
                                          const next = [...statusOptions];
                                          next[idx] = { ...next[idx], value: e.target.value };
                                          setStatusOptions(next);
                                      }}
                                  />
                                  <button
                                      onClick={() => handleDeleteStatusOption(opt.value)}
                                      className="text-gray-400 hover:text-rose-500 transition"
                                  >
                                      <Trash2 size={14}/>
                                  </button>
                              </div>
                          ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                          <input
                              type="text"
                              className="border border-gray-200 p-1.5 rounded-lg text-xs"
                              placeholder="ชื่อสถานะใหม่"
                              value={newStatusLabel}
                              onChange={e => setNewStatusLabel(e.target.value)}
                          />
                          <input
                              type="text"
                              className="border border-gray-200 p-1.5 rounded-lg text-xs"
                              placeholder="ค่า (value)"
                              value={newStatusValue}
                              onChange={e => setNewStatusValue(e.target.value)}
                          />
                      </div>
                      <div className="flex gap-2 mt-3">
                          <button
                              onClick={handleAddStatusOption}
                              className="flex-1 bg-blue-600 text-white font-bold py-1.5 text-xs rounded-lg hover:bg-blue-700 transition"
                          >
                              + เพิ่มสถานะ
                          </button>
                          <button
                              onClick={handleSaveStatusOptions}
                              className="flex-1 bg-[#1a1c23] text-white font-bold py-1.5 text-xs rounded-lg hover:bg-slate-800 transition"
                          >
                              บันทึกสถานะ
                          </button>
                      </div>
                      <div className="mt-2 text-[10px] text-gray-500">
                          แก้ไขรายการสถานะงานที่ใช้ในหน้าออเดอร์
                      </div>
                  </div>

                  {/* Shipping Cost Table Section */}
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-emerald-200">
                      <h3 className="text-sm font-bold text-[#1a1c23] mb-3 flex items-center">
                          <Truck size={18} className="mr-2 text-emerald-500"/>
                          ตารางค่าขนส่งอัตโนมัติ
                      </h3>
                      
                      {/* Shipping Table */}
                      <div className="max-h-48 overflow-y-auto mb-3">
                          <table className="w-full text-xs">
                              <thead className="bg-emerald-50 sticky top-0">
                                  <tr>
                                      <th className="p-2 text-left">จำนวน (ตัว)</th>
                                      <th className="p-2 text-right">ค่าขนส่ง (บาท)</th>
                                      <th className="p-2 text-center w-16">จัดการ</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {shippingTable.map((row, index) => (
                                      <tr key={index} className="hover:bg-gray-50">
                                          <td className="p-2">
                                              <span className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-700 font-mono">
                                                  {row.minQty} - {row.maxQty}
                                              </span>
                                          </td>
                                          <td className="p-2 text-right font-bold">{row.cost} ฿</td>
                                          <td className="p-2 text-center">
                                              <button 
                                                  onClick={() => handleDeleteShippingRow(index)}
                                                  className="text-gray-400 hover:text-rose-500 transition"
                                              >
                                                  <Trash2 size={14}/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      {/* Add New Shipping Row */}
                      <div className="bg-emerald-50 p-3 rounded-xl mb-3">
                          <div className="grid grid-cols-3 gap-2 mb-2">
                              <div>
                                  <label className="block text-xs font-medium mb-0.5">ขั้นต่ำ</label>
                                  <input 
                                      type="number" 
                                      className="w-full border p-1.5 rounded-lg text-xs" 
                                      placeholder="10"
                                      value={newShippingRow.minQty || ''}
                                      onChange={e => setNewShippingRow({...newShippingRow, minQty: parseInt(e.target.value) || 0})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium mb-0.5">สูงสุด</label>
                                  <input 
                                      type="number" 
                                      className="w-full border p-1.5 rounded-lg text-xs" 
                                      placeholder="15"
                                      value={newShippingRow.maxQty || ''}
                                      onChange={e => setNewShippingRow({...newShippingRow, maxQty: parseInt(e.target.value) || 0})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium mb-0.5">ค่าขนส่ง</label>
                                  <input 
                                      type="number" 
                                      className="w-full border p-1.5 rounded-lg text-xs" 
                                      placeholder="60"
                                      value={newShippingRow.cost || ''}
                                      onChange={e => setNewShippingRow({...newShippingRow, cost: parseInt(e.target.value) || 0})}
                                  />
                              </div>
                          </div>
                          <button 
                              onClick={handleAddShippingRow}
                              className="w-full bg-emerald-600 text-white font-bold py-1.5 text-xs rounded-lg hover:bg-emerald-700 transition"
                          >
                              + เพิ่มช่วงราคา
                          </button>
                      </div>

                      {/* Extra cost for > 100 */}
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mb-3">
                          <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-amber-800">ค่าขนส่งเพิ่มเติม (เกิน 100 ตัว)</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-xs text-amber-700">ค่าขนส่ง = 230 + (จำนวนเกิน × </span>
                              <input 
                                  type="number" 
                                  className="w-16 border border-amber-300 p-1 rounded text-center text-xs font-bold"
                                  value={extraShippingCost}
                                  onChange={e => setExtraShippingCost(parseInt(e.target.value) || 0)}
                              />
                              <span className="text-xs text-amber-700">บาท)</span>
                              <button 
                                  onClick={handleSaveExtraShippingCost}
                                  className="bg-amber-600 text-white text-xs px-2 py-1 rounded hover:bg-amber-700"
                              >
                                  บันทึก
                              </button>
                          </div>
                      </div>

                      {/* Reset Button */}
                      <button 
                          onClick={handleResetShippingTable}
                          className="w-full bg-gray-100 text-gray-600 font-bold py-1.5 text-xs rounded-xl hover:bg-gray-200 transition"
                      >
                          รีเซ็ตเป็นค่าเริ่มต้น
                      </button>
                  </div>
              </div>

              {/* Right Column: Table รายการกฎ */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-100">
                      <h3 className="font-bold text-lg text-[#1a1c23]">ราคาปัจจุบัน</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-white border-b border-gray-200 sticky top-0">
                              <tr>
                                  <th className="p-4 pl-6 text-gray-500 font-semibold text-xs">ชนิดผ้า</th>
                                  <th className="p-4 text-gray-500 font-semibold text-xs">จำนวน (ตัว)</th>
                                  <th className="p-4 text-right text-gray-500 font-semibold text-xs">ราคา</th>
                                  <th className="p-4 text-right pr-6 text-gray-500 font-semibold text-xs">จัดการ</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {pricingRules.length === 0 ? (
                                  <tr><td colSpan="4" className="p-12 text-center text-gray-400">ยังไม่มีการตั้งราคา</td></tr>
                              ) : pricingRules.map((rule) => (
                                  <tr key={rule.id} className="hover:bg-gray-50">
                                      <td className="p-4 pl-6 font-semibold text-gray-800">{rule.fabric_type}</td>
                                      <td className="p-4">
                                          <span className="bg-gray-100 px-3 py-1 rounded-md text-xs font-mono font-bold text-gray-700">
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
          </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }) => (
        <button 
            onClick={onClick}
            className={`w-full flex items-center space-x-3 sm:space-x-4 p-2.5 sm:p-3 rounded-lg sm:rounded-xl transition duration-200 group relative ${active ? 'text-white' : 'text-gray-500 hover:text-white'}`}
        >
                {active && <div className="absolute left-0 w-1 h-6 sm:h-8 bg-[#d4e157] rounded-r-full shadow-[0_0_10px_rgba(212,225,87,0.5)]"></div>}
                {React.createElement(icon, { size: 18, className: `sm:w-5 sm:h-5 transition ${active ? 'text-[#d4e157]' : 'text-gray-500 group-hover:text-white'}` })}
                <span className="font-medium text-xs sm:text-sm tracking-wide">{label}</span>
        </button>
);

// --- 3. MAIN APP (Revised Sidebar & Routing) ---
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || 'user'); // Add State for Role
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
   
  // Notification State
  const [notification, setNotification] = useState(null);
    // Authoritative add-on definitions (shared across app)
    const [addOnDefinitions, setAddOnDefinitions] = useState(ADDON_OPTIONS);
  
  // ✅ FIX: Track when customer list should refresh (after order creation)
  const [customerRefreshTrigger, setCustomerRefreshTrigger] = useState(false);

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
        
        // Role already initialized from localStorage on state creation
  }, [isLoggedIn]);

    // Listen for logout events triggered by fetchWithAuth to gracefully return to login
    useEffect(() => {
        const onLogout = () => {
            setIsLoggedIn(false);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
        };
        window.addEventListener('blook:logout', onLogout);
        return () => window.removeEventListener('blook:logout', onLogout);
    }, []);

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

  const handleNotify = useCallback((message, type = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  }, [setNotification]);

  // Memoized wrapper for order page to toggle customer refresh without recreating inline function
  const handleOrderNotify = useCallback((msg, type) => {
      handleNotify(msg, type);
      if (type === 'success') setCustomerRefreshTrigger(prev => !prev);
  }, [handleNotify, setCustomerRefreshTrigger]);

  if (!isLoggedIn) return <LoginPage onLogin={(role) => {
      setIsLoggedIn(true);
      setUserRole(role);
  }} />;

  const renderContent = () => {
    switch(currentPage) {
        case 'dashboard': return <DashboardPage onEdit={handleEditOrder} />;
        case 'order_list': return <OrderListPage onNavigate={handleNavigate} onEdit={handleEditOrder} onNotify={handleNotify} />;
        case 'settings': return <SettingsPage onNotify={handleNotify} addOnDefinitions={addOnDefinitions} setAddOnDefinitions={setAddOnDefinitions} />;
        case 'create_order': return <OrderCreationPage onNavigate={handleNavigate} editingOrder={editingOrder} onNotify={handleOrderNotify} addOnDefinitions={addOnDefinitions} setAddOnDefinitions={setAddOnDefinitions} />;
        case 'product': return <ProductPage />;
        case 'customer': return <CustomerPage refreshTrigger={customerRefreshTrigger} />;
        case 'users': return <UserManagementPage onNotify={handleNotify} />;
        default: return <OrderListPage onNavigate={handleNavigate} onEdit={handleEditOrder} onNotify={handleNotify} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-slate-800 flex flex-col md:flex-row relative">
       {/* Toast Notification */}
       {notification && (
           <div className={`fixed top-3 sm:top-6 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-4 rounded-lg sm:rounded-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-5 max-w-[90vw] sm:max-w-none ${notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'}`}>
               {notification.type === 'success' ? <CheckCircle size={18} className="sm:w-6 sm:h-6 text-emerald-400 shrink-0" /> : <AlertCircle size={18} className="sm:w-6 sm:h-6 text-white shrink-0" />}
               <span className="font-medium text-sm sm:text-base md:text-lg line-clamp-2">{notification.message}</span>
           </div>
       )}

       {/* Mobile Header */}
    <div className="md:hidden bg-[#1a1c23] text-white p-3 sm:p-4 flex justify-center items-center sticky top-0 z-30 shadow-lg">
           <button onClick={() => setIsSidebarOpen(true)} className="absolute left-3 sm:left-4"><Menu size={22} className="sm:w-6 sm:h-6" /></button>
           <div className="flex items-center gap-2">
                <img src={LOGO_URL} alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full"/>
                <span className="font-bold text-base sm:text-lg tracking-tight">B-LOOK</span>
           </div>
       </div>
       {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

       {/* Sidebar (Dark Theme) */}
       <aside className={`fixed md:sticky top-0 left-0 h-screen w-56 sm:w-60 md:w-64 bg-[#1a1c23] text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl border-r border-gray-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-4 sm:p-6 md:p-8 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <img src={LOGO_URL} alt="Logo" className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-white/20"/>
                    <span className="font-black text-lg sm:text-xl tracking-tight text-white">B-LOOK</span>
                </div>
                <button className="md:hidden text-gray-500 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={22}/></button>
            </div>
            
            <nav className="flex-1 px-2 sm:px-3 md:px-4 space-y-1 sm:space-y-2 mt-2 sm:mt-4">
                <NavItem id="dashboard" icon={LayoutDashboard} label="หน้าหลัก" active={currentPage === 'dashboard'} onClick={() => handleNavigate('dashboard')} />
                <NavItem id="create_order" icon={DollarSign} label="สร้างออเดอร์ใหม่" active={currentPage === 'create_order'} onClick={() => handleNavigate('create_order')} />
                <NavItem id="order_list" icon={FileText} label="รายการออเดอร์" active={currentPage === 'order_list'} onClick={() => handleNavigate('order_list')} />
                <NavItem id="product" icon={ShoppingCart} label="สินค้า" active={currentPage === 'product'} onClick={() => handleNavigate('product')} />
                <NavItem id="customer" icon={User} label="ลูกค้า" active={currentPage === 'customer'} onClick={() => handleNavigate('customer')} />
                
                {/* --- แสดงเฉพาะ Admin หรือ Owner --- */}
                {(userRole === 'admin' || userRole === 'owner') && (
                    <NavItem id="users" icon={Users} label="จัดการผู้ใช้" active={currentPage === 'users'} onClick={() => handleNavigate('users')} />
                )}
                
                <NavItem id="settings" icon={Settings} label="ตั้งค่าระบบ" active={currentPage === 'settings'} onClick={() => handleNavigate('settings')} />
            </nav>

            {/* Profile Section */}
            <div className="p-3 sm:p-4 md:p-6 border-t border-gray-800">
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('user_role'); setIsLoggedIn(false); }}>
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-[#d4e157] rounded-full flex items-center justify-center text-[#1a1c23] font-bold text-xs sm:text-sm shadow-md group-hover:scale-105 transition">
                            {userRole.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="text-xs sm:text-sm font-bold text-white group-hover:text-[#d4e157] transition capitalize">{userRole}</div>
                            <div className="text-[9px] sm:text-[10px] text-gray-500">ออกจากระบบ</div>
                        </div>
                    </div>
                    <ChevronDown size={14} className="sm:w-4 sm:h-4 text-gray-500"/>
                </div>
            </div>
       </aside>

       <main className="flex-1 overflow-auto h-[calc(100vh-52px)] sm:h-[calc(100vh-56px)] md:h-screen w-full relative">{renderContent()}</main>
    </div>
  );
};

export default App;