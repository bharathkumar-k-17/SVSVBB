import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { ChevronLeft, Save, HeartHandshake, Banknote, QrCode, UploadCloud, FileCheck, Trash2, Smartphone, Download, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePortalStore } from '../../store/portalStore';
import { MaskedPhoneInput } from '../../components/MaskedPhoneInput';
import { QRCodeSVG } from 'qrcode.react';
import { Receipt } from '../../components/Receipt';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function QRChanda() {
    const { settings } = usePortalStore();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [receiptNo, setReceiptNo] = useState('');
    const [devoteeId, setDevoteeId] = useState('');
    const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
    const [isFetchingCommittee, setIsFetchingCommittee] = useState(true);

    // Paid To Dropdown state
    const [paidToUserId, setPaidToUserId] = useState('');
    const [paidToSearch, setPaidToSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // App settings for UPI
    const [appSettings, setAppSettings] = useState<{ upi_id?: string, upi_mobile?: string }>({});

    // Desktop UPI fallback
    const [showDesktopUpiMsg, setShowDesktopUpiMsg] = useState(false);

    useEffect(() => {
        async function loadData() {
            const { data: appData } = await supabase.from('app_settings').select('upi_id, upi_mobile').eq('id', 'app').single();
            if (appData) setAppSettings(appData);

            // Fetch committee Users
            setIsFetchingCommittee(true);
            const { data } = await supabase.functions.invoke('get-committee');
            if (data && data.success) {
                setCommitteeUsers(data.users || []);
            }
            setIsFetchingCommittee(false);
        }
        loadData();
    }, []);

    useEffect(() => {
        if (success && devoteeId) {
            const uploadPdf = async () => {
                const element = document.getElementById('receipt-export-container');
                if (!element) return;
                try {
                    await new Promise(r => setTimeout(r, 600));
                    const canvas = await html2canvas(element, {
                        scale: 3, useCORS: true, windowWidth: 1024,
                        onclone: (clonedDoc) => {
                            const el = clonedDoc.getElementById('receipt-export-container');
                            if (el) { el.style.width = '794px'; el.style.maxWidth = 'none'; el.style.minHeight = '1123px'; }
                        }
                    });
                    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                    const pageW = pdf.internal.pageSize.getWidth(); const pageH = pdf.internal.pageSize.getHeight();
                    const margin = 12; const imgW = pageW - margin * 2; const imgH = (canvas.height * imgW) / canvas.width;
                    const yOffset = imgH < (pageH - margin * 2) ? (pageH - imgH) / 2 : margin;
                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, yOffset, imgW, imgH, '', 'FAST');
                    const blob = pdf.output('blob');
                    await supabase.storage.from('payment-proofs').upload(`receipts/${devoteeId}.pdf`, blob, { contentType: 'application/pdf', upsert: true });
                } catch (err) { console.error('Upload failed', err); }
            };
            uploadPdf();
        }
    }, [success, devoteeId]);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        total_amount: '',
        paid_amount: '',
        payment_mode: '' as 'Cash' | 'UPI' | '',
        donation_item: '',
        gotram: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const numAmt = Number(formData.paid_amount) || 0;

        if (!formData.name || !formData.phone || numAmt <= 0) {
            toast.error('Please fill in all required fields and valid amount');
            return;
        }

        if (!paidToUserId) {
            toast.error('Please select the Committee Member you paid to.');
            return;
        }

        setLoading(true);

        try {
            const paidToUserObj = committeeUsers.find(u => u.id === paidToUserId);

            const response = await supabase.functions.invoke('create-qr-chanda', {
                body: {
                    name: formData.name,
                    phone: formData.phone.replace(/\D/g, ''),
                    total_amount: Number(formData.total_amount),
                    paid_amount: numAmt,
                    payment_mode: formData.payment_mode,
                    donation_item: formData.donation_item,
                    gotram: formData.gotram,
                    family_members: [], // Implement if needed
                    paidToUserId: paidToUserId,
                    paidToName: paidToUserObj?.name || '',
                    paidToPhone: paidToUserObj?.phone || '',
                    // Note: upload functionality is currently not attached. 
                    // To add proof upload back into the request, add it here.
                }
            });

            if (response.error) throw response.error;
            const data = response.data;
            if (!data.success) throw new Error(data.error);

            setReceiptNo(data.receiptNo);
            setDevoteeId(data.devoteeId);
            setSuccess(true);
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit registration');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        const u = committeeUsers.find(x => x.id === paidToUserId);

        return (
            <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mb-10">
                <div className="animate-in fade-in slide-in-from-top-2 text-center mb-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful</h2>
                    <p className="text-gray-600 font-medium">
                        Your entry has been securely registered into the database.
                    </p>
                </div>

                <Receipt
                    data={{
                        receiptNo,
                        name: formData.name,
                        phone: formData.phone,
                        totalAmount: Number(formData.total_amount) || 0,
                        paidAmount: Number(formData.paid_amount) || 0,
                        pendingAmount: (Number(formData.total_amount) || 0) - (Number(formData.paid_amount) || 0),
                        donationItem: formData.donation_item,
                        paymentMode: formData.payment_mode || 'Cash',
                        gotram: formData.gotram,
                        volunteerName: u?.name || 'Portal',
                        volunteerPhone: u?.phone || '',
                        createdAt: Date.now(),
                        paidToName: u?.name || 'Portal'
                    }}
                    isBlank={false}
                    hideActions={false}
                    isPortal={false}
                    renderTrigger={({ downloadPDF, loading: pdfLoading }) => (
                        <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                            <button
                                onClick={downloadPDF}
                                disabled={pdfLoading}
                                className="flex items-center justify-center gap-2 w-full py-4 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 transition-colors shadow-md disabled:bg-orange-400"
                            >
                                {pdfLoading ? (
                                    <div className="flex items-center gap-2">
                                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                                        <span>Generating PDF...</span>
                                    </div>
                                ) : (
                                    <> <Download size={20} /> Download Receipt PDF </>
                                )}
                            </button>
                        </div>
                    )}
                />

                <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4 max-w-lg mx-auto">
                    <button onClick={() => {
                        setSuccess(false);
                        setReceiptNo('');
                        setDevoteeId('');
                        setFormData({
                            name: '', phone: '', total_amount: '', paid_amount: '',
                            payment_mode: '', donation_item: '', gotram: ''
                        });
                        setPaidToUserId('');
                    }} className="flex-1 py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-sm">
                        Register Another
                    </button>
                    <Link to="/portal" className="flex-1 py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center">
                        Return to Portal
                    </Link>
                </div>
            </div >
        );
    }

    const numAmt = Number(formData.paid_amount) || 0;

    const handleUpiAppSelect = (appName: string) => {
        if (numAmt <= 0) {
            toast.error('Enter a valid Paid Amount first.');
            return;
        }

        setShowDesktopUpiMsg(false);

        const params = new URLSearchParams({
            pa: appSettings?.upi_id || 'bharathkumar17@axl',
            pn: 'SVSVBB Committee',
            am: numAmt.toFixed(2),
            cu: 'INR',
            tn: 'Chanda Donation'
        });

        const baseParams = params.toString();

        let intentUrl = `upi://pay?${baseParams}`;

        const userAgent = navigator.userAgent || navigator.vendor;
        const isAndroid = /android/i.test(userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
        const isMobile = isAndroid || isIOS;

        if (!isMobile) {
            setShowDesktopUpiMsg(true);
            return;
        }

        if (isAndroid) {
            if (appName === 'PhonePe') intentUrl = `intent://pay?${baseParams}#Intent;scheme=upi;package=com.phonepe.app;end;`;
            else if (appName === 'Google Pay') intentUrl = `intent://pay?${baseParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end;`;
            else if (appName === 'Paytm') intentUrl = `intent://pay?${baseParams}#Intent;scheme=upi;package=net.one97.paytm;end;`;
            else if (appName === 'BHIM') intentUrl = `intent://pay?${baseParams}#Intent;scheme=upi;package=in.org.npci.upiapp;end;`;
        } else if (isIOS) {
            if (appName === 'PhonePe') intentUrl = `phonepe://pay?${baseParams}`;
            else if (appName === 'Google Pay') intentUrl = `tez://upi/pay?${baseParams}`;
            else if (appName === 'Paytm') intentUrl = `paytmmp://pay?${baseParams}`;
            else if (appName === 'BHIM') intentUrl = `bhim://pay?${baseParams}`;
        }

        try {
            window.location.href = intentUrl;
        } catch (err) {
            console.error('Failed to launch UPI Intent', err);
            setShowDesktopUpiMsg(true);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <Link to="/portal" className="inline-flex items-center text-sm font-bold text-orange-600 mb-6 bg-white px-4 py-2 rounded-xl shadow-sm">
                <ChevronLeft size={16} className="mr-1" /> Back to Portal
            </Link>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <HeartHandshake className="text-primary" />
                    QR Chanda Registration
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                                placeholder="Full Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number <span className="text-red-500">*</span></label>
                            <MaskedPhoneInput
                                value={formData.phone}
                                onChange={(val) => setFormData({ ...formData, phone: val })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Total Amount (₹)</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.total_amount}
                                onChange={e => setFormData({ ...formData, total_amount: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all font-bold text-gray-900 outline-none"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Paid Amount (₹)</label>
                            <input
                                required
                                type="number"
                                min="0"
                                max={formData.total_amount || 0}
                                value={formData.paid_amount}
                                onChange={e => setFormData({ ...formData, paid_amount: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all font-bold text-green-700 outline-none"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">In-kind Donation / Item</label>
                            <input
                                type="text"
                                value={formData.donation_item}
                                onChange={e => setFormData({ ...formData, donation_item: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <label className={`flex items-center justify-center p-4 rounded-2xl cursor-pointer transition-all ${formData.payment_mode === 'Cash' ? 'border-2 border-orange-200 bg-orange-100 text-gray-900 font-bold' : 'border border-gray-200 bg-white hover:bg-gray-50 font-bold text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="paymentMode"
                                    value="Cash"
                                    checked={formData.payment_mode === 'Cash'}
                                    onChange={() => setFormData({ ...formData, payment_mode: 'Cash' })}
                                    className="hidden"
                                />
                                <div className="border border-current rounded p-0.5 mr-2">
                                    <Banknote size={16} />
                                </div>
                                Cash
                            </label>
                            <label className={`flex items-center justify-center p-4 rounded-2xl cursor-pointer transition-all ${formData.payment_mode === 'UPI' ? 'border-2 border-orange-200 bg-orange-100 text-orange-600 font-bold' : 'border border-gray-200 bg-white hover:bg-gray-50 font-bold text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="paymentMode"
                                    value="UPI"
                                    checked={formData.payment_mode === 'UPI'}
                                    onChange={() => setFormData({ ...formData, payment_mode: 'UPI' })}
                                    className="hidden"
                                />
                                <QrCode className="mr-2" size={20} />
                                UPI
                            </label>
                        </div>

                        {formData.payment_mode && (
                            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 relative animate-in fade-in slide-in-from-top-2">
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Paid To <span className="text-red-500">*</span></label>
                                {isFetchingCommittee ? (
                                    <div className="p-3 text-sm text-gray-500 animate-pulse">Loading committee members...</div>
                                ) : !paidToUserId ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search and select Committee Member..."
                                            value={paidToSearch}
                                            onChange={(e) => {
                                                setPaidToSearch(e.target.value);
                                                setIsDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base font-medium"
                                        />
                                        {isDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                                {committeeUsers.filter(u => u.name.toLowerCase().includes(paidToSearch.toLowerCase()) || (u.phone && u.phone.includes(paidToSearch))).length === 0 && (
                                                    <div className="p-3 text-sm text-gray-500 text-center">No users found.</div>
                                                )}
                                                {committeeUsers.filter(u => u.name.toLowerCase().includes(paidToSearch.toLowerCase()) || (u.phone && u.phone.includes(paidToSearch))).map(u => (
                                                    <div
                                                        key={u.id}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Prevent input from losing focus immediately
                                                            setPaidToUserId(u.id);
                                                            setIsDropdownOpen(false);
                                                            setPaidToSearch('');
                                                        }}
                                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-100 flex justify-between items-center"
                                                    >
                                                        <span className="font-bold text-gray-800">{u.name}</span>
                                                        <span className="text-sm text-gray-500 font-medium">📞 {u.phone || 'N/A'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (() => {
                                    const u = committeeUsers.find(x => x.id === paidToUserId);
                                    return (
                                        <div className="flex justify-between items-center bg-green-50 p-3 border border-green-200 rounded-xl shadow-sm">
                                            <div>
                                                <div className="font-bold text-green-900">{u?.name}</div>
                                                <div className="text-sm text-green-700 font-medium">📞 {u?.phone || 'N/A'}</div>
                                            </div>
                                            <button type="button" onClick={() => setPaidToUserId('')} className="text-red-500 text-sm font-bold hover:underline px-2 bg-white rounded shadow-sm border border-red-100 py-1">Change</button>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {formData.payment_mode === 'UPI' && (
                            <div className="mt-6 p-5 bg-white border border-gray-200 rounded-xl text-center shadow-sm animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Select Payment App</h3>

                                <div className="grid grid-cols-4 gap-2 mb-6">
                                    <button type="button" onClick={() => handleUpiAppSelect('PhonePe')} className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors h-16">
                                        <img src="/payment/phonepe.svg" alt="PhonePe" className="w-10 h-10 object-contain" />
                                    </button>
                                    <button type="button" onClick={() => handleUpiAppSelect('Google Pay')} className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors h-16">
                                        <img src="/payment/gpay.svg" alt="Google Pay" className="w-10 h-10 object-contain" />
                                    </button>
                                    <button type="button" onClick={() => handleUpiAppSelect('Paytm')} className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors h-16">
                                        <img src="/payment/paytm.svg" alt="Paytm" className="w-10 h-10 object-contain" />
                                    </button>
                                    <button type="button" onClick={() => handleUpiAppSelect('Other')} className="flex flex-col items-center justify-center p-2 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors h-16">
                                        <img src="/payment/upi.svg" alt="Other UPI" className="w-10 h-10 object-contain" />
                                    </button>
                                </div>

                                {showDesktopUpiMsg && (
                                    <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm font-medium">
                                        UPI payment apps are available on mobile. Please scan the QR code or use the UPI ID.
                                    </div>
                                )}

                                {appSettings?.upi_id ? (() => {
                                    const params = new URLSearchParams({
                                        pa: appSettings?.upi_id || 'bharathkumar17@axl',
                                        pn: 'SVSVBB Committee',
                                        am: numAmt.toFixed(2),
                                        cu: 'INR'
                                    });
                                    const upiUrl = `upi://pay?${params.toString()}`;

                                    return (
                                        <div className="flex flex-col mx-auto items-center">
                                            <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 mb-6 inline-block">
                                                <QRCodeSVG value={upiUrl} size={160} level="M" />
                                            </div>
                                            <div className="w-full max-w-sm text-left grid grid-cols-2 bg-orange-50/50 p-4 rounded-xl">
                                                <span className="text-slate-500 font-medium text-sm">UPI ID</span>
                                                <span className="font-bold text-slate-800 text-right">{appSettings?.upi_id || 'bharathkumar17@axl'}</span>
                                                <div className="col-span-2 border-t border-orange-100/50 my-2"></div>
                                                <span className="text-slate-500 font-medium text-sm self-center">Amount</span>
                                                <span className="font-bold text-red-600 text-lg text-right">₹{numAmt}</span>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <p className="text-gray-500 text-sm font-medium">UPI ID is not configured.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || formData.name.trim() === '' || numAmt <= 0 || !formData.payment_mode || !paidToUserId}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-md text-white font-bold text-lg bg-gradient-to-r from-primary to-orange-500 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
                                <span>Saving...</span>
                            </div>
                        ) : (
                            <> <Save size={24} /> Submit Registration </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
