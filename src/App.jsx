import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  QrCode, 
  History, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Trash2,
  Baby,
  Calculator,
  Tag,
  Contact2,
  Ticket,
  Download,
  Files,
  ChevronDown,
  Search,
  Check,
  ScanLine,
  User,
  Phone,
  Calendar,
  Truck,
  Layers
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import jsQR from 'jsqr';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, initAnalytics } from './firebase';

const GENERATE_QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=";
const VOUCHER_DOC_REF = doc(db, 'bumikids', 'vouchers');

const PACKAGE_LIST = [
  { name: 'Paket Tree', price: 950000, color: 'bg-blue-100 text-blue-500' },
  { name: 'Paket Sea', price: 1550000, color: 'bg-purple-100 text-purple-500' },
  { name: 'Paket Moon', price: 2350000, color: 'bg-orange-100 text-orange-500' },
  { name: 'Paket Sky', price: 3500000, color: 'bg-emerald-100 text-emerald-500' },
  { name: 'Paket Light', price: 5000000, color: 'bg-emerald-100 text-emerald-500' }
];

const TRANSPORT_OPTIONS = [
  { label: 'Tanpa Transport', value: 0 },
  { label: 'Rp 100.000', value: 100000 },
  { label: 'Rp 200.000', value: 200000 },
  { label: 'Rp 300.000', value: 300000 },
  { label: 'Rp 400.000', value: 400000 },
  { label: 'Rp 500.000', value: 500000 }
];

const App = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [vouchers, setVouchers] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isContactSupported, setIsContactSupported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scanError, setScanError] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [packageQuery, setPackageQuery] = useState('');
  const packageDropdownRef = useRef(null);
  const transportDropdownRef = useRef(null);
  const scanVideoRef = useRef(null);
  const scanFrameRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const scanActiveRef = useRef(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    voucherType: 'specific',
    package: PACKAGE_LIST[0].name,
    transportFee: 0,
    discount: '',
    validUntil: '',
    quantity: 1
  });

  useEffect(() => {
    // Add Google Fonts
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;900&family=Poppins:wght@400;600;700;800&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);

    initAnalytics();

    const loadVouchers = async () => {
      try {
        const snapshot = await getDoc(VOUCHER_DOC_REF);
        const cloudVouchers = snapshot.data()?.vouchers;

        if (Array.isArray(cloudVouchers)) {
          setVouchers(cloudVouchers);
          localStorage.setItem('bumikids_vouchers', JSON.stringify(cloudVouchers));
          return;
        }
      } catch (error) {
        console.log('Fallback ke localStorage (Firestore gagal):', error);
      }

      const saved = localStorage.getItem('bumikids_vouchers');
      if (saved) setVouchers(JSON.parse(saved));
    };

    loadVouchers();
    
    if ('contacts' in navigator && 'ContactsManager' in window) {
      setIsContactSupported(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('bumikids_vouchers', JSON.stringify(vouchers));
  }, [vouchers]);

  const persistVouchers = async (nextVouchers) => {
    setVouchers(nextVouchers);
    localStorage.setItem('bumikids_vouchers', JSON.stringify(nextVouchers));

    try {
      await setDoc(VOUCHER_DOC_REF, { vouchers: nextVouchers, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.log('Gagal sinkron ke Firestore:', error);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        packageDropdownRef.current &&
        !packageDropdownRef.current.contains(event.target) &&
        transportDropdownRef.current &&
        !transportDropdownRef.current.contains(event.target)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const formatIDR = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(amount);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const finalValue = (name === 'transportFee' || name === 'quantity') ? parseInt(value) : value;
    setFormData({ ...formData, [name]: finalValue });
  };

  const handleManualTransportChange = (e) => {
    const rawValue = e.target.value;
    const parsedValue = parseInt(rawValue, 10);
    setFormData((prev) => ({
      ...prev,
      transportFee: Number.isNaN(parsedValue) ? 0 : Math.max(0, parsedValue)
    }));
  };

  const filteredPackages = PACKAGE_LIST.filter((pkg) =>
    pkg.name.toLowerCase().includes(packageQuery.toLowerCase())
  );

  const selectedPackage = PACKAGE_LIST.find((pkg) => pkg.name === formData.package);
  const selectedTransport = TRANSPORT_OPTIONS.find((opt) => opt.value === Number(formData.transportFee));
  const transportLabel = selectedTransport?.label || (Number(formData.transportFee) > 0 ? `Manual: ${formatIDR(Number(formData.transportFee))}` : 'Pilih transport');

  const handleSelectPackage = (pkgName) => {
    setFormData((prev) => ({ ...prev, package: pkgName }));
    setActiveDropdown(null);
    setPackageQuery('');
  };

  const handleSelectTransport = (value) => {
    setFormData((prev) => ({ ...prev, transportFee: value }));
    setActiveDropdown(null);
  };

  const handleSelectContact = async () => {
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await navigator.contacts.select(props, opts);
      if (contacts.length > 0) {
        const contact = contacts[0];
        const rawPhone = contact.tel?.[0] || '';
        const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
        setFormData(prev => ({
          ...prev,
          customerName: contact.name?.[0] || prev.customerName,
          phone: cleanPhone
        }));
      }
    } catch (err) { console.log(err); }
  };

  const calculateFinalPrice = (basePrice, transportFee, discountStr) => {
    if (!basePrice && basePrice !== 0) return { discountAmount: 0, finalPrice: 0, subtotal: 0 };
    const subtotal = basePrice + (transportFee || 0);
    const cleanDiscount = discountStr.replace(/[^\d%]/g, '');
    let discountAmount = 0;
    
    if (cleanDiscount.includes('%')) {
      const percentage = parseFloat(cleanDiscount) / 100;
      discountAmount = basePrice * percentage;
    } else {
      discountAmount = parseFloat(cleanDiscount) || 0;
    }
    
    return { 
      discountAmount, 
      subtotal,
      finalPrice: Math.max(0, subtotal - discountAmount) 
    };
  };

  const generateVoucher = async (e) => {
    e.preventDefault();
    const isGeneral = formData.voucherType === 'general';
    const numToGenerate = isGeneral ? Math.max(1, formData.quantity) : 1;
    const newVouchersList = [];

    for (let i = 0; i < numToGenerate; i++) {
      const id = `BK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const selectedPkg = formData.voucherType === 'specific' 
        ? PACKAGE_LIST.find(p => p.name === formData.package) : null;
      
      newVouchersList.push({
        ...formData,
        id,
        customerName: isGeneral ? 'Pelanggan Umum' : formData.customerName,
        phone: isGeneral ? '' : formData.phone,
        basePrice: selectedPkg ? selectedPkg.price : 0,
        transportFee: isGeneral ? 0 : formData.transportFee,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
    }
    
    const updatedVouchers = [...newVouchersList, ...vouchers];
    await persistVouchers(updatedVouchers);
    setActiveTab('history');
    setFormData({
      customerName: '', phone: '', voucherType: 'specific',
      package: PACKAGE_LIST[0].name, transportFee: 0, discount: '', validUntil: '',
      quantity: 1
    });
  };

  const deleteVoucher = async (id) => {
    const updatedVouchers = vouchers.filter(v => v.id !== id);
    await persistVouchers(updatedVouchers);
  };

  const waitForImages = (container) => {
    const imgs = container.querySelectorAll('img');
    const promises = Array.from(imgs).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    return Promise.all(promises);
  };

  const buildWhatsAppMessage = (voucher) => {
    const { finalPrice } = calculateFinalPrice(voucher.basePrice, voucher.transportFee, voucher.discount);
    if (voucher.voucherType === 'specific') {
      return `Halo Bunda ${voucher.customerName},\n\nIni adalah voucher spesial dari *Bumikids Photography*:\n\nPaket: *${voucher.package}*\nHarga Paket: *${formatIDR(voucher.basePrice)}*\nBiaya Transport: *${formatIDR(voucher.transportFee)}*\nDiskon: *${voucher.discount}*\n*Total Akhir: ${formatIDR(finalPrice)}*\n\nKode Voucher: *${voucher.id}*\nBerlaku hingga: ${voucher.validUntil}\n\nTunjukkan kode ini saat sesi foto ya Bunda. Terima kasih! ✨`;
    }
    return `Halo Bunda,\n\nIni adalah *Voucher Promo Spesial* dari *Bumikids Photography*:\n\nKode Voucher: *${voucher.id}*\nNilai Diskon: *${voucher.discount}*\nBerlaku hingga: ${voucher.validUntil}\n\nVoucher ini berlaku untuk pilihan paket foto apa pun yang Bunda ambil nanti. Tunjukkan kode ini saat reservasi ya! ✨`;
  };

  const openWhatsAppText = (voucher) => {
    const message = encodeURIComponent(buildWhatsAppMessage(voucher));
    const cleanedPhone = voucher.phone ? voucher.phone.replace(/\D/g, '') : '';
    const waUrl = cleanedPhone ? `https://wa.me/${cleanedPhone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const sendToWhatsApp = async (voucher) => {
    const canShareFile = !!navigator.share && !!window.File;
    if (!canShareFile) {
      openWhatsAppText(voucher);
      return;
    }

    const exportContainer = document.getElementById('pdf-export-container');
    const cardElement = document.getElementById(`export-card-${voucher.id}`);
    if (!exportContainer || !cardElement) {
      openWhatsAppText(voucher);
      return;
    }

    try {
      setIsExporting(true);
      exportContainer.style.display = 'block';
      await waitForImages(exportContainer);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(cardElement, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF', logging: false });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to create image blob');

      const imageFile = new File([blob], `Voucher-${voucher.id}.png`, { type: 'image/png' });
      const shareData = {
        title: `Voucher ${voucher.id}`,
        text: buildWhatsAppMessage(voucher),
        files: [imageFile]
      };

      if (navigator.canShare && !navigator.canShare({ files: [imageFile] })) {
        openWhatsAppText(voucher);
        return;
      }

      await navigator.share(shareData);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        openWhatsAppText(voucher);
      }
    } finally {
      exportContainer.style.display = 'none';
      setIsExporting(false);
    }
  };

  const exportToPDF = async (voucherList) => {
    setIsExporting(true);
    const isSingle = voucherList.length === 1;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const exportContainer = document.getElementById('pdf-export-container');
    exportContainer.style.display = 'block';

    await waitForImages(exportContainer);
    await new Promise(r => setTimeout(r, 1200));

    const pageWidth = 210; const pageHeight = 297;
    const cols = 4; const rows = 5;
    const cellWidth = pageWidth / cols; const cellHeight = pageHeight / rows;

    for (let i = 0; i < voucherList.length; i++) {
      const v = voucherList[i];
      const cardElement = document.getElementById(`export-card-${v.id}`);
      if (i > 0 && i % (cols * rows) === 0) {
        drawGridGuides(doc, cols, rows, cellWidth, cellHeight, pageWidth, pageHeight);
        doc.addPage();
      }
      const canvas = await html2canvas(cardElement, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF', logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const colIndex = i % cols; const rowIndex = Math.floor((i % (cols * rows)) / cols);
      doc.addImage(imgData, 'JPEG', colIndex * cellWidth, rowIndex * cellHeight, cellWidth, cellHeight);
    }
    drawGridGuides(doc, cols, rows, cellWidth, cellHeight, pageWidth, pageHeight);

    doc.save(isSingle ? `Voucher-${voucherList[0].customerName.replace(/\\s+/g, '_')}.pdf` : `Bumikids_Vouchers_Optimized.pdf`);
    exportContainer.style.display = 'none';
    setIsExporting(false);
  };

  const drawGridGuides = (doc, cols, rows, cellWidth, cellHeight, pageWidth, pageHeight) => {
    doc.setDrawColor(200, 200, 200); doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.1);
    for (let c = 0; c <= cols; c++) doc.line(c * cellWidth, 0, c * cellWidth, pageHeight);
    for (let r = 0; r <= rows; r++) doc.line(0, r * cellHeight, pageWidth, r * cellHeight);
    doc.setLineDashPattern([], 0);
  };

  const simulateScan = (code) => {
    const found = vouchers.find(v => v.id === code.toUpperCase());
    if (found) { setScanResult({ ...found, ...calculateFinalPrice(found.basePrice, found.transportFee, found.discount), status: 'valid' }); }
    else { setScanResult({ id: code, status: 'invalid' }); }
    setScanning(false);
  };

  const stopCameraScan = () => {
    scanActiveRef.current = false;
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (scanVideoRef.current) {
      scanVideoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const scanFromCameraLoop = async () => {
    if (!scanActiveRef.current || !scanVideoRef.current) return;

    try {
      let code = '';
      const video = scanVideoRef.current;

      const decodeWithJsQR = () => {
        if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return '';

        const canvas = scanCanvasRef.current || document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return '';

        const maxWidth = 960;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const targetWidth = Math.max(1, Math.floor(video.videoWidth * scale));
        const targetHeight = Math.max(1, Math.floor(video.videoHeight * scale));

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.drawImage(video, 0, 0, targetWidth, targetHeight);

        const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
        const qrResult = jsQR(imageData.data, targetWidth, targetHeight, { inversionAttempts: 'attemptBoth' });

        scanCanvasRef.current = canvas;
        return qrResult?.data?.trim() || '';
      };

      if (barcodeDetectorRef.current && video.readyState >= 2) {
        const barcodes = await barcodeDetectorRef.current.detect(video);
        if (barcodes.length > 0) code = barcodes[0].rawValue?.trim() || '';
      }

      if (!code) {
        code = decodeWithJsQR();
      }

      if (code) {
        stopCameraScan();
        simulateScan(code);
        return;
      }
    } catch (error) {
      setScanError('Gagal membaca QR dari kamera. Coba arahkan ulang kamera.');
    }

    scanFrameRef.current = requestAnimationFrame(scanFromCameraLoop);
  };

  const startCameraScan = async () => {
    setScanError('');

    if (!window.isSecureContext) {
      setScanError('Akses kamera butuh HTTPS. Buka dari domain HTTPS (mis. Vercel) atau localhost.');
      return;
    }

    const hasModernCameraApi = !!navigator.mediaDevices?.getUserMedia;
    const legacyGetUserMedia =
      navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    if (!hasModernCameraApi && !legacyGetUserMedia) {
      setScanError('Browser/perangkat ini belum mendukung akses kamera. Coba buka di Chrome atau Safari terbaru.');
      return;
    }

    const getCameraStream = async () => {
      const constraintsList = [
        { video: { facingMode: { exact: 'environment' } }, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false }
      ];

      let lastError = null;
      for (const constraints of constraintsList) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return stream;
          }

          const stream = await new Promise((resolve, reject) => {
            legacyGetUserMedia.call(navigator, constraints, resolve, reject);
          });
          return stream;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Camera not available');
    };

    try {
      barcodeDetectorRef.current = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const stream = await getCameraStream();

      cameraStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.setAttribute('playsinline', 'true');
        scanVideoRef.current.setAttribute('webkit-playsinline', 'true');
        scanVideoRef.current.srcObject = stream;
        await scanVideoRef.current.play().catch(() => {});
      }

      scanActiveRef.current = true;
      setScanning(true);
      scanFrameRef.current = requestAnimationFrame(scanFromCameraLoop);
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setScanError('Izin kamera ditolak. Aktifkan permission kamera untuk browser ini.');
      } else {
        setScanError('Kamera tidak tersedia atau sedang dipakai aplikasi lain.');
      }
      stopCameraScan();
    }
  };

  useEffect(() => {
    if (activeTab !== 'scan') {
      stopCameraScan();
      setScanError('');
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  return (
    <div className="min-h-screen text-slate-800 font-['Nunito'] pb-32">
      <style>{`
        body { font-family: 'Nunito', sans-serif; background: #e0e7ff; overflow-x: hidden; }
        .font-poppins { font-family: 'Poppins', sans-serif; }
        .bg-main-gradient { background: linear-gradient(160deg, #dbeafe 0%, #ede9fe 50%, #f5f3ff 100%); min-height: 100vh; width: 100%; }
        .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.8); }
        .shadow-modern { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08); }
        .form-field-clean:focus,
        .form-field-clean:focus-visible {
          outline: none;
          border-color: transparent;
          box-shadow: none;
        }
        @keyframes scan-line { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-scan { animation: scan-line 3s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 bg-main-gradient -z-10" />

      {isExporting && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-indigo-600 font-black font-poppins uppercase tracking-widest text-[10px]">Mengonversi & Kompresi PDF...</p>
          <p className="text-[8px] text-slate-400 font-bold mt-1">Mengoptimalkan Ukuran Penyimpanan</p>
        </div>
      )}

      {/* Hidden Export Container */}
      <div id="pdf-export-container" style={{ position: 'fixed', left: '-9999px', top: 0, width: '400px', display: 'none' }}>
        {vouchers.map(v => (
          <div key={`export-${v.id}`} id={`export-card-${v.id}`} className="w-[400px] bg-white flex flex-col items-center relative overflow-hidden font-nunito" style={{ height: '452px' }}>
            <div className="w-full bg-[#EEF2FF] h-[100px] flex flex-col items-center justify-center rounded-b-[40px] pt-2 border-b border-indigo-100/50">
              <h1 className="font-poppins text-3xl font-bold text-[#312E81] leading-none mb-1">Bumikids</h1>
              <p className="text-[7px] uppercase tracking-[0.4em] text-indigo-400 font-black font-poppins text-center">PHOTOGRAPHY</p>
            </div>
            <div className="text-center w-full px-4 mt-8">
              <p className="text-[8px] uppercase font-bold text-slate-300 tracking-[0.1em] mb-1 font-poppins">VOUCHER UNTUK</p>
              <h2 className="text-[16px] font-bold text-[#1E1B4B] font-poppins px-2">{v.customerName}</h2>
            </div>
            <div className="flex-grow flex flex-col items-center justify-center w-full py-2 min-h-0">
              <div className="bg-white p-2 rounded-2xl border border-indigo-50 shadow-sm overflow-hidden mb-1">
                <img src={`${GENERATE_QR_URL}${v.id}`} className="w-32 h-32 object-contain" alt="QR" crossOrigin="anonymous" />
              </div>
              <p className="font-poppins font-bold tracking-[0.4em] text-indigo-900 text-[10px] uppercase mt-1">
                {v.id.split('-')[0]} - {v.id.split('-')[1] || v.id}
              </p>
            </div>
            <div className="w-[88%] mb-4">
              <div className="bg-[#1E1B4B] text-white py-3 px-3 rounded-[20px] w-full text-center flex flex-col items-center justify-center shadow-lg border border-indigo-800">
                <p className="text-[10px] font-bold uppercase font-poppins tracking-tight opacity-90 break-words w-full">
                  {v.voucherType === 'specific' ? v.package : 'PROMO SEMUA PAKET FOTO'}
                </p>
                <p className="text-[14px] font-black mt-1 font-poppins uppercase tracking-wide">POTONGAN {v.discount}</p>
              </div>
              <div className="text-center mt-3">
                <p className="text-[7px] font-black text-indigo-300 uppercase font-poppins opacity-80 tracking-wider">Berlaku Sampai</p>
                <p className="text-[10px] font-black text-indigo-700 font-poppins tracking-wide">{new Date(v.validUntil).toLocaleDateString('id-ID')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <header className="px-8 pt-12 pb-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-poppins text-lg font-black text-indigo-950 tracking-tighter">Bumikids</h1>
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1" />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 pt-2">
        {activeTab === 'generate' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
            <h2 className="text-[32px] leading-tight font-bold text-indigo-950 font-poppins mb-1">Pilih <span className="text-rose-500 block">Tipe Voucher!</span></h2>
            <p className="text-slate-500 text-sm font-semibold mb-8">Lengkapi data voucher di bawah ini</p>
            <form onSubmit={generateVoucher} className="space-y-4">
              <div className="bg-white/40 p-1.5 rounded-[32px] flex gap-2 mb-8 glass shadow-modern">
                <button type="button" onClick={() => setFormData({...formData, voucherType: 'specific'})} className={`flex-1 py-4 rounded-[26px] text-[10px] font-black uppercase transition-all font-poppins tracking-widest ${formData.voucherType === 'specific' ? 'bg-indigo-950 text-white shadow-xl' : 'text-slate-400'}`}>Paket Foto</button>
                <button type="button" onClick={() => setFormData({...formData, voucherType: 'general'})} className={`flex-1 py-4 rounded-[26px] text-[10px] font-black uppercase transition-all font-poppins tracking-widest ${formData.voucherType === 'general' ? 'bg-indigo-950 text-white shadow-xl' : 'text-slate-400'}`}>Umum</button>
              </div>
              <div className="space-y-3">
                {formData.voucherType === 'specific' ? (
                  <>
                    <div className="bg-white rounded-[28px] p-2 shadow-modern border border-white group animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-4 p-3 rounded-[22px] hover:bg-slate-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Nama Pelanggan</label>
                          <input required name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Ketik nama Bunda..." className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-indigo-950 form-field-clean" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-[28px] p-2 shadow-modern border border-white group animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-4 p-3 rounded-[22px] hover:bg-slate-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Nomor WhatsApp</label>
                            {isContactSupported && <button type="button" onClick={handleSelectContact} className="text-[9px] font-black text-rose-500 uppercase font-poppins">Kontak</button>}
                          </div>
                          <input required name="phone" value={formData.phone} onChange={handleInputChange} placeholder="62812..." className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-indigo-950 form-field-clean" />
                        </div>
                      </div>
                    </div>
                    <div ref={packageDropdownRef} className="bg-white rounded-[28px] p-2 shadow-modern border border-white group animate-in slide-in-from-top-2 relative">
                      <div className="flex items-center gap-4 p-3 rounded-[22px] hover:bg-slate-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 shadow-sm border border-violet-100/50">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Jenis Paket</label>
                          <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'package' ? null : 'package')} className="w-full text-left bg-transparent border-none p-0 pr-2 text-sm font-bold text-indigo-950 form-field-clean">
                            {selectedPackage?.name || 'Pilih paket'}
                          </button>
                          <p className="text-[9px] font-black text-violet-500/90 mt-1 font-poppins tracking-wide">
                            {formatIDR(selectedPackage?.price || 0)}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-violet-100/80 text-violet-600 flex items-center justify-center shadow-sm">
                          <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'package' ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {activeDropdown === 'package' && (
                        <div className="absolute left-2 right-2 top-[calc(100%+8px)] z-30 bg-white rounded-2xl border border-violet-100 shadow-[0_18px_40px_rgba(76,29,149,0.18)] overflow-hidden">
                          <div className="p-3 border-b border-violet-100 bg-violet-50/50">
                            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-violet-100">
                              <Search className="w-4 h-4 text-violet-400" />
                              <input value={packageQuery} onChange={(e) => setPackageQuery(e.target.value)} placeholder="Cari paket..." className="w-full bg-transparent border-none p-0 text-[12px] font-semibold text-violet-900 form-field-clean" />
                            </div>
                          </div>
                          <div className="max-h-52 overflow-auto p-2 space-y-1">
                            {filteredPackages.length > 0 ? (
                              filteredPackages.map((pkg) => (
                                <button key={pkg.name} type="button" onClick={() => handleSelectPackage(pkg.name)} className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${formData.package === pkg.name ? 'bg-violet-600 text-white shadow-md' : 'hover:bg-violet-50 text-violet-900'}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[12px] font-black font-poppins">{pkg.name}</span>
                                    {formData.package === pkg.name ? <Check className="w-4 h-4" /> : <span className="text-[10px] font-black opacity-80">{formatIDR(pkg.price)}</span>}
                                  </div>
                                  {formData.package === pkg.name && <p className="text-[10px] opacity-90 mt-0.5">{formatIDR(pkg.price)}</p>}
                                </button>
                              ))
                            ) : (
                              <p className="text-[11px] font-bold text-violet-400 px-2 py-3">Paket tidak ditemukan</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={transportDropdownRef} className="bg-white rounded-[28px] p-2 shadow-modern border border-white group animate-in slide-in-from-top-2 relative">
                      <div className="flex items-center gap-4 p-3 rounded-[22px] hover:bg-slate-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-sm border border-rose-100/50">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Biaya Transport</label>
                          <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'transport' ? null : 'transport')} className="w-full text-left bg-transparent border-none p-0 pr-2 text-sm font-bold text-indigo-950 form-field-clean">
                            {transportLabel}
                          </button>
                          <div className="mt-2">
                            <input
                              type="number"
                              min="0"
                              value={Number(formData.transportFee) === 0 ? '' : formData.transportFee}
                              onChange={handleManualTransportChange}
                              placeholder="Input nominal manual"
                              className="w-full bg-rose-50/60 border border-rose-100 rounded-xl px-3 py-2 text-[11px] font-bold text-rose-700 placeholder:text-rose-300 form-field-clean"
                            />
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-rose-100/80 text-rose-500 flex items-center justify-center shadow-sm">
                          <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'transport' ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {activeDropdown === 'transport' && (
                        <div className="absolute left-2 right-2 top-[calc(100%+8px)] z-30 bg-white rounded-2xl border border-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.18)] overflow-hidden p-2 space-y-1">
                          {TRANSPORT_OPTIONS.map((opt) => (
                            <button key={opt.value} type="button" onClick={() => handleSelectTransport(opt.value)} className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${Number(formData.transportFee) === opt.value ? 'bg-rose-500 text-white shadow-md' : 'hover:bg-rose-50 text-rose-900'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-black font-poppins">{opt.label}</span>
                                {Number(formData.transportFee) === opt.value && <Check className="w-4 h-4" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 animate-in slide-in-from-top-2">
                    <div className="p-6 bg-indigo-900 rounded-[28px] border border-white/20 flex items-center gap-4 text-white shadow-xl">
                      <Ticket className="w-8 h-8 text-rose-400" />
                      <p className="text-[10px] font-bold font-poppins opacity-90 leading-relaxed italic">Voucher promo Umum berlaku untuk semua jenis sesi foto Bumikids.</p>
                    </div>
                    <div className="bg-white rounded-[28px] p-2 shadow-modern border border-white group animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-4 p-3 rounded-[22px] hover:bg-slate-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Jumlah Voucher</label>
                          <input required type="number" name="quantity" min="1" max="50" value={formData.quantity} onChange={handleInputChange} className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-indigo-950 form-field-clean" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-[24px] p-2 shadow-modern border border-white group">
                    <div className="flex items-center gap-3 p-3 rounded-[18px]">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shadow-sm">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Diskon</label>
                        <input required name="discount" value={formData.discount} onChange={handleInputChange} placeholder="10%/50rb" className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-rose-500 form-field-clean" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-[24px] p-2 shadow-modern border border-white group">
                    <div className="flex items-center gap-3 p-3 rounded-[18px]">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-poppins">Berlaku Hingga</label>
                        <input required type="date" name="validUntil" value={formData.validUntil} onChange={handleInputChange} className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] font-bold text-indigo-950 form-field-clean" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-950 text-white font-black py-6 rounded-[32px] shadow-2xl shadow-indigo-300/40 mt-8 active:scale-95 transition-all font-poppins uppercase tracking-[0.3em] text-[11px]">
                {formData.voucherType === 'general' && formData.quantity > 1 ? `Buat ${formData.quantity} Voucher` : 'Buat Voucher'}
              </button>
            </form>
          </div>
        )}
        {/* TAB: SCAN & HISTORY sections remain implemented with glass design ... */}
        {activeTab === 'scan' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 flex flex-col items-center pb-10">
            <h2 className="text-[32px] leading-tight font-bold text-indigo-950 font-poppins mb-1">Scan <span className="text-rose-500 block">QR Code</span></h2>
            {!scanResult ? (
              <div className="w-full max-w-[300px] space-y-12 mt-12">
                <div className="relative aspect-square w-full">
                  <div className="absolute inset-0 border-[14px] border-white/80 rounded-[64px] shadow-modern glass" />
                  <div className="absolute inset-[14px] bg-indigo-100/20 rounded-[50px] overflow-hidden flex items-center justify-center border border-white/50">
                    <video
                      ref={scanVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover transition-opacity duration-300 ${scanning ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {!scanning && <QrCode className="w-24 h-24 text-indigo-300 opacity-50 absolute" />}
                    {scanning && <div className="w-[85%] h-0.5 bg-gradient-to-r from-transparent via-indigo-600 to-transparent absolute shadow-[0_0_20px_#4f46e5] animate-scan" />}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={scanning ? stopCameraScan : startCameraScan}
                  className={`w-full py-4 rounded-[24px] font-black font-poppins uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${scanning ? 'bg-rose-500 text-white shadow-lg' : 'bg-indigo-950 text-white shadow-xl'}`}
                >
                  <ScanLine className="w-4 h-4" />
                  {scanning ? 'Hentikan Kamera' : 'Scan Dari Kamera'}
                </button>
                {!scanning && !scanError && (
                  <p className="text-center text-[10px] font-bold text-slate-400">
                    Tap "Scan Dari Kamera" untuk mengaktifkan kamera.
                  </p>
                )}
                {scanError && <p className="text-center text-[10px] font-bold text-rose-500">{scanError}</p>}
                <input type="text" placeholder="Masukkan kode manual..." className="w-full glass border-white/80 py-5 px-8 rounded-[30px] text-center font-bold font-mono tracking-widest text-sm shadow-modern focus:ring-2 focus:ring-indigo-300 transition-all text-indigo-900 font-poppins" onKeyDown={(e) => e.key === 'Enter' && simulateScan(e.target.value)} />
              </div>
            ) : (
              <div className="w-full animate-in zoom-in-95 mt-10">
                <div className="bg-white rounded-[40px] p-8 shadow-modern border border-white">
                  {scanResult.status === 'valid' ? (
                    <div className="text-left font-nunito">
                      <div className="bg-emerald-500 text-white w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10" /></div>
                      <h3 className="text-2xl font-black text-indigo-950 font-poppins mb-1 text-center uppercase">Voucher Berlaku!</h3>
                      <div className="p-6 bg-slate-50 rounded-[28px] mt-8">
                        <p className="text-[9px] font-black text-slate-300 uppercase font-poppins">Pelanggan</p>
                        <p className="text-2xl font-black text-indigo-900 font-poppins leading-none">{scanResult.customerName}</p>
                      </div>
                      <div className="p-6 bg-indigo-950 rounded-[32px] text-white mt-4">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">{scanResult.package}</p>
                        <p className="text-3xl font-black font-poppins">{formatIDR(scanResult.finalPrice)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                       <div className="bg-rose-50 text-rose-500 w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-6"><XCircle className="w-10 h-10" /></div>
                       <h3 className="text-2xl font-black text-indigo-950">Gagal Verifikasi</h3>
                    </div>
                  )}
                  <button onClick={() => setScanResult(null)} className="w-full bg-slate-100 py-5 rounded-[28px] mt-10 font-black font-poppins uppercase tracking-widest text-[10px]">Tutup</button>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'history' && (
          <div className="animate-in fade-in pb-10">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-[28px] leading-tight font-bold text-indigo-950 font-poppins">Riwayat Voucher</h2>
                <p className="text-[11px] text-slate-500 font-bold">Semua voucher tersimpan di sini</p>
              </div>
              {vouchers.length > 0 && (
                <button onClick={() => exportToPDF(vouchers)} className="glass shadow-modern px-4 py-3 rounded-[18px] text-indigo-950 active:scale-90 border border-white/50 flex items-center gap-2">
                  <Files className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-wider font-black font-poppins">Export</span>
                </button>
              )}
            </div>
            {vouchers.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-white/70 border border-white rounded-2xl px-4 py-3 shadow-sm">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-black font-poppins">Total</p>
                  <p className="text-xl text-indigo-950 font-black font-poppins">{vouchers.length}</p>
                </div>
                <div className="bg-white/70 border border-white rounded-2xl px-4 py-3 shadow-sm">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-black font-poppins">Terbaru</p>
                  <p className="text-[12px] text-indigo-950 font-black font-poppins">{new Date(vouchers[0].createdAt).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {vouchers.length === 0 ? (
                <div className="glass rounded-[28px] p-10 text-center border border-dashed border-white/60">
                  <History className="w-10 h-10 text-indigo-200 mx-auto mb-3" />
                  <p className="text-indigo-400 font-black uppercase text-[10px] tracking-widest font-poppins">Belum Ada Voucher</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">Voucher yang dibuat akan muncul otomatis.</p>
                </div>
              ) : (
                vouchers.map((v) => (
                  <div key={v.id} className="bg-white/95 rounded-[24px] p-4 shadow-modern border border-white relative overflow-hidden">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-lg font-black text-indigo-950 leading-tight font-poppins">{v.customerName}</h3>
                        <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{v.id}</p>
                      </div>
                      <button onClick={() => deleteVoucher(v.id)} className="p-2.5 text-slate-300 hover:text-rose-500 bg-slate-50 rounded-xl">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[9px] uppercase text-slate-400 font-black tracking-wider">Tipe</p>
                        <p className="text-[11px] font-black text-indigo-900">{v.voucherType === 'specific' ? 'Paket Foto' : 'Umum'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[9px] uppercase text-slate-400 font-black tracking-wider">Berlaku</p>
                        <p className="text-[11px] font-black text-indigo-900">{new Date(v.validUntil).toLocaleDateString('id-ID')}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2 col-span-2">
                        <p className="text-[9px] uppercase text-slate-400 font-black tracking-wider">Detail</p>
                        <p className="text-[11px] font-black text-indigo-900">
                          {v.voucherType === 'specific' ? v.package : 'Promo Semua Paket'} • Diskon {v.discount}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 grid-cols-2">
                      <button onClick={() => sendToWhatsApp(v)} className="bg-[#25D366] text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] uppercase shadow-lg font-poppins tracking-wider">
                        <Send className="w-4 h-4" /> Kirim WA
                      </button>
                      <button onClick={() => exportToPDF([v])} className="bg-white text-indigo-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] uppercase border border-slate-100 font-poppins tracking-wider">
                        <Download className="w-4 h-4" /> Export PDF
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white shadow-[0_25px_60px_rgba(0,0,0,0.18)] border border-white rounded-[44px] px-10 py-5 z-[50] flex justify-between items-center glass">
        <button onClick={() => setActiveTab('generate')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'generate' ? 'text-indigo-900 scale-110 font-black' : 'text-slate-300'}`}><PlusCircle className="w-7 h-7" /><span className={`text-[8px] uppercase tracking-[0.2em] font-black font-poppins ${activeTab === 'generate' ? 'block' : 'hidden'}`}>Buat</span></button>
        <button onClick={() => setActiveTab('scan')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'scan' ? 'text-indigo-900' : 'text-slate-300'}`}><div className={`p-5 rounded-full -mt-16 border-[8px] border-[#e0e7ff] shadow-2xl transition-all ${activeTab === 'scan' ? 'bg-indigo-950 text-white' : 'bg-white'}`}><QrCode className="w-8 h-8" /></div><span className={`text-[8px] uppercase tracking-[0.2em] font-black font-poppins mt-1 ${activeTab === 'scan' ? 'text-indigo-950' : 'hidden'}`}>Scan</span></button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'history' ? 'text-indigo-900 scale-110 font-black' : 'text-slate-300'}`}><History className="w-7 h-7" /><span className={`text-[8px] uppercase tracking-[0.2em] font-black font-poppins ${activeTab === 'history' ? 'block' : 'hidden'}`}>Riwayat</span></button>
      </nav>
    </div>
  );
};

export default App;
