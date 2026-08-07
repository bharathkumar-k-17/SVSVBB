import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Share2, ImageIcon, Loader2 } from 'lucide-react';
import { getDynamicReceiptPrefix } from '../lib/receipt';
import toast from 'react-hot-toast';
import { maskPhoneNumber } from '../lib/privacy';
import { supabase } from '../lib/supabase';
import { useGlobalLogo } from '../hooks/useGlobalLogo';
import { shareReceiptWhatsApp } from '../lib/whatsapp';
import { hydrateTemplate, DEFAULT_CHANDA_CONFIRMATION } from '../lib/templates';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

/* ─── Types ─────────────────────────────────────── */
type FamilyMembers = string | string[] | undefined;

interface ReceiptData {
  id?: string;
  whatsappSent?: boolean;
  name?: string;
  phone?: string;
  totalAmount?: number;
  paidAmount?: number;
  pendingAmount?: number;
  paymentMode?: string;
  receiptNo?: string;
  volunteerName?: string;
  volunteerPhone?: string;
  createdAt?: number | string | Date;
  year?: number;
  gotram?: string;
  familyMembers?: FamilyMembers;
  donationItem?: string;
}

interface ReceiptProps {
  data?: Partial<ReceiptData>;
  currentYear?: number;
  isBlank?: boolean;
  logoSrc?: string;
  qrValue?: string;
  hideActions?: boolean;
  isPortal?: boolean;
}

/* ─── Helpers ─────────────────────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);

const parseFamilyMembers = (fm: FamilyMembers): string[] => {
  if (Array.isArray(fm)) return fm.map(s => s.trim()).filter(Boolean);
  if (typeof fm === 'string') return fm.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

/* ─── Main Component ──────────────────────────── */
export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ data, currentYear, isBlank = false, logoSrc: customLogoSrc, qrValue, hideActions = false, isPortal = false }, ref) => {
    const globalLogo = useGlobalLogo();
    const logoSrc = customLogoSrc || globalLogo;
    const exportRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [loading, setLoading] = useState<string | null>(null);
    const [upiId, setUpiId] = useState<string>('');
    const { appUser } = useAuthStore();
    const defaultCollector = appUser?.name || 'Admin';
    const defaultCollectorPhone = appUser?.phone || '';

    useImperativeHandle(ref, () => exportRef.current as HTMLDivElement);

    const [templates, setTemplates] = useState<any>({});

    /* ─ Fetch UPI ID & Templates ─ */
    useEffect(() => {
      const fetchSettings = async () => {
        try {
          const { data } = await supabase.from('app_settings').select('upi_id, chanda_confirmation_template').eq('id', 'app').maybeSingle();
          if (data?.upi_id) setUpiId(data.upi_id);
          if (data) setTemplates(data);
        } catch (err) {}
      };
      fetchSettings();
    }, []);

    /* ─ Resize Observer for Mobile Scaling ─ */
    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect;
        if (width < 794) {
          setScale(width / 794);
        } else {
          setScale(1);
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    /* ─ Derived values ─ */
    const createdAt   = !isBlank && data?.createdAt ? new Date(data.createdAt) : new Date();
    const displayYear = currentYear ?? data?.year ?? createdAt.getFullYear();
    const receiptNo   = isBlank ? `${getDynamicReceiptPrefix()}___` : (data?.receiptNo || `${getDynamicReceiptPrefix()}001`);
    const totalAmt    = Number(data?.totalAmount ?? 0);
    const paidAmt     = Number(data?.paidAmount ?? 0);
    const pendingAmt  = Math.max(Number(data?.pendingAmount ?? (totalAmt - paidAmt)), 0);
    const members     = parseFamilyMembers(data?.familyMembers);
    const isVip       = Boolean(data?.gotram?.trim()) || members.length > 0;
    const isAck       = paidAmt === 0;
    const payMode     = (data?.paymentMode || 'Cash').toUpperCase();

    /* ─ Advanced Dynamic UPI QR Logic ─ */
    const isUnpaid       = paidAmt === 0;
    const isPartial      = paidAmt > 0 && pendingAmt > 0;
    const isFullyPaid    = pendingAmt === 0 && paidAmt > 0;

    // Show Payment QR if there's any pending amount
    const showPaymentQR  = (isUnpaid || isPartial) && !!upiId;
    
    // Show Verification QR only if fully paid and not Cash
    const showVerifyQR   = isFullyPaid && !payMode.includes('CASH');
    
    const showQR         = showPaymentQR || showVerifyQR;

    // Build standard UPI string: upi://pay?pa={UPI_ID}&pn={APP_NAME}&am={PENDING_AMOUNT}&cu=INR
    const upiQrValue = useMemo(() => {
      if (!upiId || pendingAmt <= 0) return '';
      // Cross-platform compatible display name
      const appName = 'SVSVBB'; 
      const transactionNote = `Receipt-${receiptNo}`;
      
      return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(appName)}&am=${pendingAmt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
    }, [upiId, pendingAmt, receiptNo]);
    const verifyQrValue = useMemo(() =>
      [`SVSVBB Receipt`, `No: ${receiptNo}`, `Year: ${displayYear}`,
       `Name: ${data?.name || '-'}`, `Ph: ${data?.phone || '-'}`,
       `Total: ${totalAmt}`, `Paid: ${paidAmt}`, `Pending: ${pendingAmt}`, `Mode: ${payMode}`].join('\n'),
      [data?.name, data?.phone, displayYear, paidAmt, pendingAmt, payMode, receiptNo, totalAmt],
    );

    const dateLabel = isBlank ? 'DD/MM/YYYY' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(createdAt);
    const timeLabel = isBlank ? '--:-- --'   : new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(createdAt);

    /* ─ Export helpers ─ */
    const capture = async () => {
      if (!exportRef.current) return null;
      return html2canvas(exportRef.current, {
        scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false,
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('receipt-export-container');
          if (el) {
            el.style.width = '794px';
            el.style.minHeight = '1123px';
          }
        }
      });
    };

    const blobDownload = (blob: Blob, name: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const withLoading = async (key: string, fn: () => Promise<void>) => {
      setLoading(key);
      try { await fn(); } finally { setLoading(null); }
    };

    const downloadPDF = () => withLoading('pdf', async () => {
      const canvas = await capture(); if (!canvas) return;
      // A4 dimensions in mm
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();   // 210mm
      const pageH = pdf.internal.pageSize.getHeight();  // 297mm
      const margin = 12;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      // Center vertically if short, or clip/page if tall
      const yOffset = imgH < (pageH - margin * 2) ? (pageH - imgH) / 2 : margin;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, yOffset, imgW, imgH, '', 'FAST');
      blobDownload(pdf.output('blob'), `${receiptNo}.pdf`);
    });

    const downloadImage = () => withLoading('img', async () => {
      const canvas = await capture(); if (!canvas) return;
      canvas.toBlob(blob => { if (blob) blobDownload(blob, `${receiptNo}.png`); }, 'image/png', 1);
    });

    const shareWhatsApp = () => withLoading('wa', async () => {
      if (!data?.phone) {
        toast.error('No phone number available');
        return;
      }
      const baseUrl = window.location.origin;
      const receiptUrl = `${baseUrl}/portal/receipt/${data.id || 'preview'}`;
      shareReceiptWhatsApp(data, receiptUrl, templates.chanda_confirmation_template);
    });

    // Auto-WhatsApp removed as requested

    const shareSMS = () => {
      if (!data?.phone) {
        toast.error('No phone number available');
        return;
      }
      const baseUrl = window.location.origin;
      const receiptUrl = `${baseUrl}/portal/receipt/${data.id || 'preview'}`;
      const dateValue = (data as any).date || data.createdAt;
      const formattedDate = dateValue ? format(new Date(dateValue), 'dd MMM yyyy') : new Date().toLocaleDateString('en-IN');
      const amount = data.totalAmount || data.paidAmount || 0;

      const payload = {
        name: data.name || '',
        receiptNo: receiptNo || '',
        date: formattedDate,
        amount: amount,
        receiptLink: receiptUrl,
        festivalYear: displayYear.toString(),
      };

      const text = hydrateTemplate(templates.chanda_confirmation_template || DEFAULT_CHANDA_CONFIRMATION, payload);
      let encodedText = encodeURIComponent(text);
      if (receiptUrl) {
        encodedText = encodedText.replace(encodeURIComponent(receiptUrl), receiptUrl);
      }
      window.open(`sms:${data.phone}?body=${encodedText}`, '_blank');
    };

    const BtnClass = (color: string) =>
      `inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-md w-full sm:w-auto ${color}`;

    return (
      <div className="w-full" ref={containerRef}>
        {(!hideActions && !isPortal) && (
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 mb-5 print:hidden">
            <button onClick={downloadPDF} disabled={!!loading} className={BtnClass('bg-red-600 text-white hover:bg-red-700')}>
              {loading === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download PDF
            </button>
            <button onClick={downloadImage} disabled={!!loading} className={BtnClass('bg-amber-500 text-white hover:bg-amber-600')}>
              {loading === 'img' ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} Save Image
            </button>
            <button onClick={shareWhatsApp} disabled={!!loading} className={BtnClass('bg-green-500 text-white hover:bg-green-600')}>
              {loading === 'wa' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} WhatsApp
            </button>
            
            <button onClick={shareSMS} className={BtnClass('bg-blue-600 text-white hover:bg-blue-700')}>
              <Share2 size={16} /> SMS
            </button>
            <button onClick={() => window.print()} disabled={!!loading} className={BtnClass('bg-gray-700 text-white hover:bg-gray-800')}>
              <Printer size={16} /> Print
            </button>
          </div>
        )}

        {/* ── A4 Receipt Card ──
            794px ≈ A4 width at 96dpi.
            We use a fixed width so the layout is always consistent for PDF/print.
        ── */}
        <div 
          className="mx-auto flex justify-center"
          style={{
            width: scale < 1 ? `${794 * scale}px` : '794px',
            height: scale < 1 ? `${1123 * scale}px` : 'auto',
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: '794px',
            }}
            className="print:transform-none print:w-[794px]"
          >
            <div
              ref={exportRef}
              id="receipt-export-container"
              className="relative bg-white border-2 border-amber-400 shadow-2xl w-[794px] min-h-[1123px]"
              style={{
                fontFamily: "'Segoe UI', 'Noto Sans Telugu', sans-serif",
                breakInside: 'avoid',
              }}
            >
          {/* ── FULL-PAGE WATERMARK ── */}
          <div
            className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0"
          >
            <img
              src={logoSrc}
              alt=""
              style={{ width: '480px', height: '480px', objectFit: 'cover', borderRadius: '50%', opacity: 0.35 }}
            />
          </div>

          {/* ── INNER CONTENT (above watermark) ── */}
          <div className="relative z-10 flex flex-col h-full" style={{ minHeight: '1123px' }}>

            {/* ════ HEADER ════ */}
            <div
              className="flex items-center justify-between px-2 sm:px-10 py-4 sm:py-6 gap-2 sm:gap-0 border-b-4 border-amber-400"
              style={{ background: 'linear-gradient(135deg, rgba(255,247,237,0.85) 0%, rgba(254,243,199,0.85) 50%, rgba(255,247,237,0.85) 100%)' }}
            >
              {/* Left Logo */}
              <img
                src={logoSrc} alt="Logo"
                className="w-12 h-12 sm:w-[90px] sm:h-[90px]"
                style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #f59e0b', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              />

              {/* Center Text */}
              <div className="px-1 sm:px-6" style={{ textAlign: 'center', flex: 1 }}>
                <p className="text-[14px] sm:text-[22px]" style={{ fontWeight: 900, color: '#7c2d12', lineHeight: 1.3, letterSpacing: '0.02em' }}>
                  శ్రీ వరసిద్ధి వినాయక భక్త బృందం
                </p>
                <p className="text-[8px] sm:text-[11px]" style={{ fontWeight: 800, color: '#b45309', letterSpacing: '0.3em', marginTop: '4px', textTransform: 'uppercase' }}>
                  — Sparkling Youth — {displayYear} —
                </p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginTop: '3px' }}>
                  న్యూ కృష్ణ నగర్, కర్నూలు
                </p>
              </div>

              {/* Right Logo */}
              <img
                src={logoSrc} alt="Vinayaka"
                className="w-12 h-12 sm:w-[90px] sm:h-[90px]"
                style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #f59e0b', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              />
            </div>

            {/* ════ RECEIPT TYPE BANNER ════ */}
            <div style={{
              background: isAck
                ? 'linear-gradient(90deg, #ea580c, #f97316)'
                : 'linear-gradient(90deg, #059669, #0d9488)',
              padding: '12px 40px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: '15px', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                {isAck ? '⚠  Acknowledgement Receipt  ⚠' : '✅  Payment Receipt'}
              </p>
              {isAck && (
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 700, marginTop: '3px', letterSpacing: '0.1em' }}>
                  STATUS: UNPAID • PAYMENT PENDING
                </p>
              )}
              {!isAck && pendingAmt > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 700, marginTop: '3px', letterSpacing: '0.1em' }}>
                  PARTIAL PAYMENT • BALANCE PENDING: {fmt(pendingAmt)}
                </p>
              )}
            </div>

            {/* ════ BODY ════ */}
            <div className="px-3 py-4 sm:px-[40px] sm:py-[28px] gap-3 sm:gap-[20px]" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

              {/* 🔹 Row 1: Receipt No, Date, Time, Role */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-[16px]">
                {[
                  { label: 'Receipt No', value: receiptNo },
                  { label: 'Date',       value: dateLabel },
                  { label: 'Time',       value: timeLabel },
                  { label: 'Phone',      value: isBlank ? '__________' : (data?.phone || '—') },
                ].map((item, idx) => (
                  <div key={idx} className="px-2 py-2 sm:px-[16px] sm:py-[12px]" style={{
                    background: 'rgba(255,247,237,0.7)',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}>
                    <p className="text-[8px] sm:text-[11px]" style={{ fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.label}
                    </p>
                    <p className="text-[12px] sm:text-[14px] break-all" style={{ fontWeight: 900, color: '#7c2d12', marginTop: '4px' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Devotee Name ── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,247,237,0.4), rgba(254,243,199,0.4))',
                border: '2px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '12px',
                padding: '16px 20px',
              }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: '8px' }}>
                  Devotee Name
                </p>
                <p style={{ fontSize: '26px', fontWeight: 900, color: '#7c2d12', lineHeight: 1.2 }}>
                  {isBlank ? '________________________________' : (data?.name || '—')}
                </p>
              </div>

              {/* 🔹 Payment Details Table */}
              <div className="px-3 py-3 sm:px-[20px] sm:py-[24px]" style={{
                background: 'rgba(255, 255, 255, 0.75)',
                border: '2px solid #fcd34d',
                borderRadius: '12px',
              }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: '12px' }}>
                  Payment Details
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      { label: 'Total Amount',  value: fmt(totalAmt), color: '#450a0a' },
                      { label: 'Paid Amount',   value: fmt(paidAmt),  color: paidAmt > 0 ? '#065f46' : '#450a0a' },
                      { label: 'Pending Amount',value: pendingAmt > 0 ? fmt(pendingAmt) : '₹0 — Cleared',
                                                 color: pendingAmt > 0 ? '#991b1b' : '#065f46' },
                      { label: 'Payment Mode',  value: data?.paymentMode || (isBlank ? '________' : 'Cash'), color: '#450a0a' },
                    ].map((row, i, arr) => (
                      <tr key={row.label} style={{ borderBottom: i < arr.length - 1 ? '1px solid #fde68a' : 'none' }}>
                        <td className="py-[6px] sm:py-[11px] text-[10px] sm:text-[13px]" style={{ fontWeight: 700, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {row.label}
                        </td>
                        <td className="py-[6px] sm:py-[11px] text-[12px] sm:text-[16px]" style={{ fontWeight: 900, color: row.color, textAlign: 'right' }}>
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Donation Item (conditional) ── */}
              {data?.donationItem && (
                <div style={{
                  background: 'rgba(255,247,237,0.65)',
                  border: '1px solid #fdba74',
                  borderRadius: '10px',
                  padding: '14px 20px',
                }}>
                  <p style={{ fontSize: '9px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '5px' }}>
                    Offering / Donation Item
                  </p>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: '#450a0a' }}>{data.donationItem}</p>
                </div>
              )}

              {/* ── VIP Section (conditional) ── */}
              {isVip && (
                <div style={{
                  background: 'rgba(254,252,232,0.7)',
                  border: '2px solid #eab308',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '10px', fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.35em', marginBottom: '8px' }}>
                    ⭐  VIP Gotram Entry  ⭐
                  </p>
                  <p style={{ fontSize: '22px', fontWeight: 900, color: '#7c2d12' }}>
                    {data?.gotram || 'Special Entry'}
                  </p>
                  {members.length > 0 && (
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#57534e', marginTop: '8px', lineHeight: 1.8 }}>
                      {members.join('  •  ')}
                    </p>
                  )}
                </div>
              )}

              {/* ── Footer: Collected By + QR ── */}
              <div className="px-4 py-4 sm:px-[20px] sm:py-[18px] flex-col sm:flex-row gap-4 sm:gap-[20px]" style={{
                background: 'rgba(255,251,235,0.65)',
                border: '1px solid #fcd34d',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginTop: 'auto',
              }}>
                {/* Left: Collected By */}
                <div style={{ flex: 1 }}>
                  <p className="text-[8px] sm:text-[9px]" style={{ fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '6px' }}>
                    Collected By
                  </p>
                  <p className="text-sm sm:text-[17px]" style={{ fontWeight: 900, color: '#450a0a', marginBottom: '2px' }}>
                    {isBlank ? '________________________' : (data?.volunteerName || defaultCollector)}
                  </p>
                  <p className="text-[9px] sm:text-[11px]" style={{ fontWeight: 700, color: '#92400e', marginBottom: '16px' }}>
                    {isBlank ? 'Mobile: ____________' : ((data?.volunteerPhone || defaultCollectorPhone) ? `Mobile: ${data?.volunteerPhone || defaultCollectorPhone}` : '')}
                  </p>

                  {/* UPI badge */}
                  {showPaymentQR && (
                    <div className="px-2 py-1 sm:px-[12px] sm:py-[6px] mb-3 sm:mb-[14px]" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: '#fff7ed', border: '1px solid #fdba74',
                      borderRadius: '8px',
                    }}>
                      <span className="text-[8px] sm:text-[10px]" style={{ fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        💳 Payment Pending — UPI Available
                      </span>
                    </div>
                  )}

                  {/* Signature */}
                  <div>
                    <div style={{ width: '120px', height: '1px', background: '#f59e0b', marginTop: '32px' }} />
                    <p className="text-[7px] sm:text-[9px]" style={{ color: '#b45309', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Authorised Signature
                    </p>
                  </div>
                </div>

                {/* Right: QR Code */}
                {showQR && (
                  <div className="w-full sm:w-auto flex flex-col items-center gap-2 sm:gap-[10px]">
                    <div className="p-2 sm:p-[12px]" style={{
                      background: '#fff',
                      border: '3px solid #f59e0b',
                      borderRadius: '16px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    }}>
                      <QRCodeSVG
                        value={showPaymentQR ? upiQrValue : verifyQrValue}
                        size={120} // Size 120px–140px as requested
                        marginSize={2}
                        bgColor="#ffffff"
                        fgColor={showPaymentQR ? '#000000' : '#450a0a'}
                        level="H" // High resolution/error correction
                      />
                    </div>
                    <p className="text-[8px] sm:text-[10px]" style={{
                      fontWeight: 900,
                      textAlign: 'center',
                      maxWidth: '140px',
                      lineHeight: 1.4,
                      color: showPaymentQR ? '#059669' : '#92400e',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {showPaymentQR ? 'Scan & Pay Remaining Amount' : 'Scan to verify receipt'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ════ BOTTOM FOOTER ════ */}
            <div className="px-3 py-3 sm:px-[40px] sm:py-[16px]" style={{
              background: 'linear-gradient(135deg, rgba(255,247,237,0.8), rgba(254,243,199,0.8))',
              borderTop: '3px solid #f59e0b',
              textAlign: 'center',
            }}>
              <p className="text-sm sm:text-[20px]" style={{ fontWeight: 900, color: '#7c2d12', letterSpacing: '0.03em' }}>
                🙏 ధన్యవాదాలు 🙏
              </p>
              <p className="text-[8px] sm:text-[11px]" style={{ fontWeight: 700, color: '#b45309', marginTop: '4px', letterSpacing: '0.08em' }}>
                ✨ శ్రీ వరసిద్ధి వినాయక భక్త బృందం తరపున ✨
              </p>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
