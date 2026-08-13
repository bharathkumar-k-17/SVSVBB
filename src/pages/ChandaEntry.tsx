import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useDevotees, useAppSettings, useUsers } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import { QrCode, Banknote, Save, HeartHandshake, Crown, UploadCloud, FileCheck, Trash2 } from 'lucide-react';
import { Receipt } from '../components/Receipt';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { hydrateTemplate, DEFAULT_CHANDA_CONFIRMATION } from '../lib/templates';
import { TeluguInput } from '../components/TeluguInput';
import { MaskedPhoneInput } from '../components/MaskedPhoneInput';

import { maskPhoneNumber, normalizePhoneDigits } from '../lib/privacy';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { shareReceiptWhatsApp } from '../lib/whatsapp';

interface ChandaEntryProps {
  isPortal?: boolean;
}

export function ChandaEntry({ isPortal = false }: ChandaEntryProps) {
  const { currentYear } = useAppStore();
  const { appUser } = useAuthStore();
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin';
  
  // Use React Query for recent devotees
  const { data: devoteesData, refetch: refetchDevotees } = useDevotees(currentYear, 0, 50, '', 'ALL', 'LATEST');
  const devotees = devoteesData?.data || [];
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSavedDevotee, setLastSavedDevotee] = useState<any>(null);
  const [upiId, setUpiId] = useState('');
  const [upiMobile, setUpiMobile] = useState('');
  const [upiPaymentInitiated, setUpiPaymentInitiated] = useState(false);

  // New States for Enterprise Flow
  const { data: usersData } = useUsers();
  const [paidToUserId, setPaidToUserId] = useState('');
  const [paidToSearch, setPaidToSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [paymentProofPath, setPaymentProofPath] = useState('');

  const generatePDF = async (receiptNo: string) => {
    const element = document.getElementById('receipt-export-container');
    if (!element) return;
    try {
      await new Promise(r => setTimeout(r, 300));
      const canvas = await html2canvas(element, { 
        scale: 3, 
        useCORS: true,
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('receipt-export-container');
          if (el) {
            el.style.width = '794px';
            el.style.maxWidth = 'none';
            el.style.minHeight = '1123px';
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const yOffset = imgH < (pageH - margin * 2) ? (pageH - imgH) / 2 : margin;
      
      pdf.addImage(imgData, 'PNG', margin, yOffset, imgW, imgH, '', 'FAST');
      pdf.save(`Receipt_${receiptNo}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
    }
  };

  const { data: appSettings } = useAppSettings();

  useEffect(() => {
    if (appSettings?.upi_id) {
      setUpiId(appSettings.upi_id);
    }
    if (appSettings?.upi_mobile) {
      setUpiMobile(appSettings.upi_mobile);
    }
  }, [appSettings]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    totalAmount: '',
    paidAmount: '',
    donationItem: '',
    paymentMode: '' as 'Cash' | 'UPI' | '',
    gotram: '',
    familyMembersStr: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const totalAmtNum = Number(formData.totalAmount) || 0;
  const isVip = totalAmtNum >= 1000 || formData.donationItem.trim().length > 0;
  
  const isCurrentDay = (timestamp?: number) => {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };
  const todaysCollections = devotees.filter(
    (devotee) => isCurrentDay(devotee.createdAt) && (isAdmin || devotee.volunteerId === appUser?.email),
  );

  // Generate receipt number using atomic counter


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPortal && !appUser) return;
    let rawPhone = normalizePhoneDigits(formData.phone);
    if (rawPhone.length === 12 && rawPhone.startsWith('91')) {
      rawPhone = rawPhone.slice(2);
    }
    
    if (rawPhone && rawPhone.length !== 10) {
      alert('Enter a valid 10-digit phone number or leave it blank.');
      return;
    }
    setLoading(true);
    setSuccess(false);

    try {
      const now = Date.now();
      const tAmt = Number(formData.totalAmount) || 0;
      const pAmt = Number(formData.paidAmount) || 0;
      const pending = tAmt - pAmt;
      const status = pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID');

      // 1. Centralized Validation (canSubmitChanda logic)
      if (!paidToUserId) {
        alert('Please select who the payment was paid to.');
        setLoading(false);
        return;
      }
      if (formData.paymentMode === 'UPI' && !paymentProofFile && !paymentProofPath) {
        alert('Please upload your UPI payment proof before registering.');
        setLoading(false);
        return;
      }
      
      const paidToUserObj = usersData?.find(u => u.id === paidToUserId);
      let finalProofPath = paymentProofPath;
      let proofName = '';
      let proofType = '';

      // 2. Upload Payment Proof if UPI
      if (formData.paymentMode === 'UPI' && paymentProofFile) {
        setIsUploadingProof(true);
        const fileExt = paymentProofFile.name.split('.').pop();
        const fileName = `proof-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${currentYear}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, paymentProofFile);

        setIsUploadingProof(false);

        if (uploadError) {
          console.error("Upload Error:", uploadError);
          alert('Payment proof upload failed. Please try again.');
          setLoading(false);
          return;
        }

        finalProofPath = filePath;
        proofName = paymentProofFile.name;
        proofType = paymentProofFile.type;
        setPaymentProofPath(filePath);
      }

      let devoteeId = '';
      let receiptNo = '';
      let createdTime = formData.date ? new Date(formData.date).getTime() : now;

      // Securely process through the Edge Function for all users
      const { data: funcData, error: funcError } = await supabase.functions.invoke('create-chanda', {
        body: {
          name: formData.name,
          phone: rawPhone,
          total_amount: tAmt,
          paid_amount: pAmt,
          donation_item: formData.donationItem,
          payment_mode: formData.paymentMode,
          payment_status: status,
          gotram: isVip ? formData.gotram : '',
          family_members: isVip ? formData.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
          year: currentYear,
          created_at: createdTime,
          isPortal: isPortal,
          volunteer_id: isPortal ? 'portal' : (appUser?.email || 'admin'),
          volunteer_name: isPortal ? 'Self (Portal)' : (appUser?.name || 'Admin'),
          volunteer_phone: isPortal ? rawPhone : (appUser?.phone || ''),
          
          // New Enterprise Fields
          paid_to_user_id: paidToUserId,
          paid_to_name: paidToUserObj?.name || '',
          paid_to_phone: paidToUserObj?.phone || '',
          payment_proof_path: finalProofPath,
          payment_proof_name: proofName,
          payment_proof_type: proofType,
          payment_proof_uploaded_at: finalProofPath ? now : null,
          payment_proof_status: finalProofPath ? 'UPI_PAYMENT_PROOF_SUBMITTED' : null,
        }
      });

      if (funcError) throw funcError;
      if (funcData?.error) throw new Error(funcData.error);
      
      devoteeId = funcData.devoteeId;
      receiptNo = funcData.receiptNo;

      // Build camelCase object for the Receipt component (it expects app-side types)
      const savedDevotee = {
        id: devoteeId,
        name: formData.name,
        phone: rawPhone,
        totalAmount: tAmt,
        paidAmount: pAmt,
        pendingAmount: pending,
        donationItem: formData.donationItem,
        paymentMode: formData.paymentMode,
        paymentStatus: status,
        gotram: isVip ? formData.gotram : '',
        familyMembers: isVip ? formData.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
        year: currentYear,
        volunteerId: isPortal ? 'portal' : (appUser?.email || 'admin'),
        volunteerName: isPortal ? 'Self (Portal)' : (appUser?.name || 'Admin'),
        volunteerPhone: isPortal ? formData.phone : (appUser?.phone || ''),
        createdAt: createdTime,
        receiptNo: receiptNo,
        paidToUserId: paidToUserId,
        paidToName: paidToUserObj?.name || '',
        paidToPhone: paidToUserObj?.phone || '',
        paymentProofStatus: finalProofPath ? 'UPI_PAYMENT_PROOF_SUBMITTED' : undefined,
      };
      setLastSavedDevotee(savedDevotee);
      setSuccess(true);
      refetchDevotees();
      
      // Auto-generate and download PDF only in portal mode
      if (isPortal) {
        setTimeout(() => generatePDF(receiptNo), 500);
      }

      setFormData({
        name: '',
        phone: '',
        totalAmount: '',
        paidAmount: '',
        donationItem: '',
        paymentMode: '',
        gotram: '',
        familyMembersStr: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      setUpiPaymentInitiated(false);
      setPaidToUserId('');
      setPaymentProofFile(null);
      setPaymentProofPath('');

    } catch (error: any) {
      console.error("Error adding devotee: ", error);
      alert(`Unable to save the Chanda entry. Please try again. (Error: ${error.message || 'Unknown backend error'})`);
    } finally {
      setLoading(false);
    }
  };

  const hasPhone = formData.phone && normalizePhoneDigits(formData.phone).length === 10;

  const handleShareWhatsApp = async () => {
    if (!lastSavedDevotee?.phone || !lastSavedDevotee?.id) return;
    setLoading(true);
    try {
      const baseUrl = window.location.origin;
      const receiptUrl = `${baseUrl}/portal/receipt/${lastSavedDevotee.id}`;
      
      shareReceiptWhatsApp(lastSavedDevotee, receiptUrl, appSettings?.chanda_confirmation_template);
    } catch (e) {
      console.error("WhatsApp share error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleShareSMS = () => {
    if (!lastSavedDevotee?.phone || !lastSavedDevotee?.id) return;
    const normalizedPhone = normalizePhoneDigits(lastSavedDevotee.phone);
    const baseUrl = window.location.origin;
    const receiptUrl = `${baseUrl}/portal/receipt/${lastSavedDevotee.id}`;
    
    const dateValue = lastSavedDevotee.date || lastSavedDevotee.createdAt;
    const formattedDate = dateValue ? format(new Date(dateValue), 'dd MMM yyyy') : new Date().toLocaleDateString('en-IN');
    const amount = lastSavedDevotee.totalAmount || lastSavedDevotee.paidAmount || 0;

    const payload = {
      name: lastSavedDevotee.name || '',
      receiptNo: lastSavedDevotee.receiptNo || '',
      date: formattedDate,
      amount: amount,
      receiptLink: receiptUrl,
      festivalYear: new Date().getFullYear().toString(),
    };

    const text = hydrateTemplate(appSettings?.chanda_confirmation_template || DEFAULT_CHANDA_CONFIRMATION, payload);
    let encodedText = encodeURIComponent(text);
    if (receiptUrl) {
      encodedText = encodedText.replace(encodeURIComponent(receiptUrl), receiptUrl);
    }
    const smsLink = `sms:+91${normalizedPhone}?body=${encodedText}`;
    window.open(smsLink, '_self');
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Form Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <HeartHandshake className="text-primary" />
          Chanda Collection {currentYear}
        </h2>

        {success && lastSavedDevotee && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="p-4 bg-green-50 text-green-800 rounded-lg flex flex-col gap-3 items-center border border-green-200 shadow-sm mb-6">
              <span className="font-bold flex items-center gap-2 text-lg">✅ Chanda Entry Saved Successfully!</span>
              <p className="text-sm">Please see the generated receipt below. You can print or share it using the buttons provided.</p>
            </div>
            
            <div className="w-full" id="receipt-container">
              <Receipt 
                data={lastSavedDevotee} 
                isBlank={false}
                hideActions={!isPortal}
                isPortal={isPortal}
              />
            </div>
            
            {/* Custom Sharing Buttons for Private UI */}
            {!isPortal && lastSavedDevotee.phone && (
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={handleShareWhatsApp}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : 'WhatsApp'}
                </button>
                <button
                  onClick={handleShareSMS}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  SMS
                </button>
              </div>
            )}
            
            <button
               onClick={() => {
                 setSuccess(false);
                 setLastSavedDevotee(null);
                 setUpiPaymentInitiated(false);
                 setPaidToUserId('');
                 setPaymentProofFile(null);
                 setPaymentProofPath('');
                 setFormData({ name: '', phone: '', totalAmount: '', paidAmount: '', donationItem: '', paymentMode: '', gotram: '', familyMembersStr: '', date: format(new Date(), 'yyyy-MM-dd') });
               }}
               className="mt-6 w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-xl shadow-sm bg-white font-bold text-gray-700 hover:bg-gray-50"
            >
              Add Another Devotee
            </button>
          </div>
        )}

        {!success && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base font-medium"
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base"
                  placeholder=""
                  autoComplete="name"
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                <MaskedPhoneInput
                  value={formData.phone}
                  onChange={(phone) => setFormData({...formData, phone})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base"
                />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  inputMode="numeric"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-bold text-gray-900 text-base"
                  placeholder=""
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Paid Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max={formData.totalAmount || "0"}
                  inputMode="numeric"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({...formData, paidAmount: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-bold text-green-700 text-base"
                  placeholder=""
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Items/In-kind Donation</label>
                <input
                  type="text"
                  value={formData.donationItem}
                  onChange={(e) => setFormData({...formData, donationItem: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-medium text-orange-600 text-base"
                  placeholder=""
                />
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
            <label className="block text-sm font-semibold text-gray-900 mb-3">Payment Status & Mode</label>
            <div className="flex gap-4 mb-4">
               {/* Amount Status display logic */}
               <div className="flex-1 font-bold text-sm bg-white p-3 rounded border border-orange-200 flex justify-between">
                 Pending Amount: 
                 <span className="text-red-500">₹{(Number(formData.totalAmount || 0) - Number(formData.paidAmount || 0)).toLocaleString()}</span>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.paymentMode === 'Cash' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="paymentMode"
                  value="Cash"
                  checked={formData.paymentMode === 'Cash'}
                  onChange={() => {
                    setFormData({...formData, paymentMode: 'Cash'});
                    setUpiPaymentInitiated(false);
                    setPaymentProofFile(null);
                    setPaymentProofPath('');
                  }}
                  className="hidden"
                />
                <Banknote className="mr-2" size={20} />
                <span className="font-bold">Cash</span>
              </label>

              <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.paymentMode === 'UPI' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="paymentMode"
                  value="UPI"
                  checked={formData.paymentMode === 'UPI'}
                  onChange={() => {
                    setFormData({...formData, paymentMode: 'UPI'});
                    setUpiPaymentInitiated(false);
                  }}
                  className="hidden"
                />
                <QrCode className="mr-2" size={20} />
                <span className="font-bold">UPI</span>
              </label>
            </div>
            
            
            {/* Conditional Content based on Payment Mode */}
            {formData.paymentMode && (
              <>
                {/* UPI Top UI (App selection, QR code) */}
                {formData.paymentMode === 'UPI' && (
                  <div className="mt-4 p-5 bg-white border border-orange-200 rounded-xl flex flex-col items-center justify-center text-center">
                    {upiId ? (() => {
                      const numAmt = Number(formData.paidAmount) || 0;
                      const upiUrl = `upi://pay?pa=${upiId}&pn=SVSVBB&am=${numAmt > 0 ? numAmt : ''}&cu=INR&tn=Chanda%20Donation`;
                      
                      const handleAppSelect = (appName: string) => {
                        if (numAmt <= 0) {
                          alert('Enter a valid Paid Amount greater than 0.');
                          return;
                        }
                        const intentPayee = upiId;
                        let intentUrl = upiUrl;
                        if (appName === 'PhonePe') intentUrl = `phonepe://pay?pa=${intentPayee}&pn=SVSVBB&am=${numAmt}&cu=INR&tn=Chanda%20Donation`;
                        else if (appName === 'Google Pay') intentUrl = `tez://upi/pay?pa=${intentPayee}&pn=SVSVBB&am=${numAmt}&cu=INR&tn=Chanda%20Donation`;
                        else if (appName === 'Paytm') intentUrl = `paytmmp://pay?pa=${intentPayee}&pn=SVSVBB&am=${numAmt}&cu=INR&tn=Chanda%20Donation`;
                        else if (appName === 'BHIM') intentUrl = `bhim://pay?pa=${intentPayee}&pn=SVSVBB&am=${numAmt}&cu=INR&tn=Chanda%20Donation`;
                        
                        setUpiPaymentInitiated(true);
                        window.location.href = intentUrl;
                        
                        setTimeout(() => {
                          if (!document.hidden) {
                            setUpiPaymentInitiated(true);
                          }
                        }, 2000);
                      };

                      return (
                        <>
                           {isPortal && !upiPaymentInitiated ? (
                             <div className="w-full animate-in fade-in slide-in-from-top-2">
                               <p className="text-sm font-bold text-gray-700 mb-3">Select Payment App</p>
                               <div className="grid grid-cols-4 gap-2 mb-4">
                                 {[
                                    { name: 'PhonePe', icon: '/payment/phonepe.svg' },
                                    { name: 'Google Pay', icon: '/payment/gpay.svg' },
                                    { name: 'Paytm', icon: '/payment/paytm.svg' },
                                    { name: 'Other UPI', icon: '/payment/upi.svg' }
                                 ].map(app => (
                                   <button
                                     key={app.name}
                                     type="button"
                                     onClick={() => handleAppSelect(app.name)}
                                     className="flex items-center justify-center bg-white p-3 rounded-xl border border-gray-100 hover:border-orange-400 hover:shadow-md transition-all group aspect-square"
                                   >
                                     <div className="w-full h-full flex items-center justify-center transition-transform group-hover:scale-105">
                                       <img src={app.icon} alt={`${app.name} Logo`} className="w-full h-full object-contain" />
                                     </div>
                                   </button>
                                 ))}
                               </div>
                               <div className="relative flex py-2 items-center">
                                  <div className="flex-grow border-t border-gray-200"></div>
                                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium">OR Scan QR Code</span>
                                  <div className="flex-grow border-t border-gray-200"></div>
                               </div>
                             </div>
                           ) : null}
                           
                           <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 mb-4 inline-block mt-2">
                             <QRCodeSVG value={upiUrl} size={150} level="M" />
                           </div>
                           <div className="w-full bg-orange-50 rounded-lg p-3 text-sm text-gray-700 border border-orange-100/50 shadow-sm text-left">
                             <div className="flex justify-between items-center mb-1">
                               <span className="text-gray-500 font-medium text-xs">UPI ID</span>
                               <span className="font-bold">{upiId}</span>
                             </div>
                             <div className="flex justify-between items-center">
                               <span className="text-gray-500 font-medium text-xs">Amount</span>
                               <span className="font-bold text-red-600">₹{numAmt}</span>
                             </div>
                           </div>
                        </>
                      );
                    })() : (
                      <p className="text-gray-500 text-sm font-medium">UPI ID is not configured in settings. Please contact admin.</p>
                    )}
                  </div>
                )}

                {/* PAID TO SECTION (Shared) */}
                <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200 relative animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Paid To <span className="text-red-500">*</span></label>
                  {!paidToUserId ? (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search and select recipient..."
                        value={paidToSearch}
                        onChange={(e) => {
                          setPaidToSearch(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base font-medium"
                      />
                      {isDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {usersData?.filter(u => u.name.toLowerCase().includes(paidToSearch.toLowerCase()) || u.phone?.includes(paidToSearch)).length === 0 && (
                            <div className="p-3 text-sm text-gray-500 text-center">No users found.</div>
                          )}
                          {usersData?.filter(u => u.name.toLowerCase().includes(paidToSearch.toLowerCase()) || u.phone?.includes(paidToSearch)).map(u => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setPaidToUserId(u.id);
                                setIsDropdownOpen(false);
                                setPaidToSearch('');
                              }}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-100 flex justify-between items-center"
                            >
                              <span className="font-bold text-gray-800">{u.name}</span>
                              <span className="text-sm text-gray-500 font-medium">📞 {maskPhoneNumber(u.phone) || 'N/A'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (() => {
                    const u = usersData?.find(x => x.id === paidToUserId);
                    return (
                      <div className="flex justify-between items-center bg-green-50 p-3 border border-green-200 rounded-xl shadow-sm">
                        <div>
                          <div className="font-bold text-green-900">{u?.name}</div>
                          <div className="text-sm text-green-700 font-medium">📞 {maskPhoneNumber(u?.phone) || 'N/A'}</div>
                        </div>
                        <button type="button" onClick={() => setPaidToUserId('')} className="text-red-500 text-sm font-bold hover:underline px-2 bg-white rounded shadow-sm border border-red-100 py-1">Change</button>
                      </div>
                    );
                  })()}
                </div>

                {/* PAYMENT PROOF SECTION (UPI Only) */}
                {formData.paymentMode === 'UPI' && (
                  <div className="w-full mt-4 p-5 bg-white border border-gray-200 rounded-xl flex flex-col text-center animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-gray-900 mb-3 tracking-wide">Upload UPI Payment Proof <span className="text-red-500">*</span></label>
                    {!paymentProofFile && !paymentProofPath ? (
                      <div className="w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-orange-300 border-dashed rounded-xl cursor-pointer bg-orange-50 hover:bg-orange-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-8 h-8 text-orange-500 mb-2" />
                            <p className="mb-2 text-sm text-gray-700 font-bold">Tap to Upload Screenshot</p>
                            <p className="text-xs text-gray-500">JPG, PNG, or PDF (Max 10MB)</p>
                          </div>
                          <input type="file" className="hidden" accept="image/jpeg,image/png,application/pdf" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) {
                              alert('Payment proof must be within the allowed file size (10MB).');
                              return;
                            }
                            const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
                            if (!validTypes.includes(file.type)) {
                              alert('Please upload a JPG, PNG, or PDF payment proof.');
                              return;
                            }
                            setPaymentProofFile(file);
                          }} />
                        </label>
                      </div>
                    ) : (
                      <div className="w-full p-4 border border-green-200 bg-green-50 rounded-xl flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden text-left">
                          <div className="p-2 bg-green-100 rounded-lg shrink-0">
                            <FileCheck className="text-green-600" size={24} />
                          </div>
                          <div className="truncate pr-2">
                            <p className="text-sm font-bold text-green-800 truncate">{paymentProofFile?.name || 'Uploaded File'}</p>
                            <p className="text-xs text-green-600 font-medium">Payment proof selected</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => {
                          setPaymentProofFile(null);
                          setPaymentProofPath('');
                        }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg shrink-0 transition-colors" title="Remove">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* VIP Section Content */}
          {isVip && (
             <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200 shadow-inner">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                    <Crown size={20} /> VIP Gotram Slot unlocked!
                  </h3>
               </div>
               
               <div className="mb-4">
                  <TeluguInput
                    label="Gotram Name"
                    value={formData.gotram}
                    onChange={(val) => setFormData({...formData, gotram: val})}
                    placeholder=""
                  />
               </div>

                   <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-semibold text-gray-700">Family Members (Comma separated)</label>
                      </div>
                      <TeluguInput
                        value={formData.familyMembersStr}
                        onChange={(val) => setFormData({...formData, familyMembersStr: val})}
                        placeholder="name1, name2, name3..."
                      />
                   </div>
             </div>
          )}

          {formData.paymentMode === 'UPI' && isPortal && !upiPaymentInitiated ? null : (
            <button
              type="submit"
              disabled={loading || isUploadingProof || !formData.paymentMode || !paidToUserId || (formData.paymentMode === 'UPI' && !paymentProofFile && !paymentProofPath)}
              className="w-full flex items-center justify-center gap-2 py-4 border border-transparent rounded-xl shadow-md text-white font-bold text-lg bg-gradient-to-r from-primary to-orange-500 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || isUploadingProof ? (
                 <div className="flex items-center gap-2">
                   <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
                   <span>{isUploadingProof ? 'Uploading Proof...' : 'Saving...'}</span>
                 </div>
               ) : (
                  <> <Save size={24} /> {formData.paymentMode === 'UPI' && upiPaymentInitiated ? '✅ Save & Register' : (isPortal ? 'Save & Register' : (hasPhone ? 'Save & Share' : 'Save'))} </>
               )}
            </button>
          )}
        </form>
        )}
      </div>

      {/* Current Day Collections */}
      {!isPortal && (
      <div className="mt-8 bg-white/50 backdrop-blur-xl rounded-2xl shadow-lg border border-white/60 overflow-hidden relative">
        <div className="px-6 py-4 border-b border-white/40 flex justify-between items-center bg-white/30 backdrop-blur-sm">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <HeartHandshake size={20} className="text-primary" />
            Today's Collections
          </h3>
          <span className="text-xs font-bold text-gray-500 bg-white/50 px-3 py-1 rounded-full border border-white/60 shadow-sm">
            {todaysCollections.length} Today
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/40">
            <thead className="bg-white/30">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">S.No</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Devotee</th>
                <th className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Cash/UPI</th>
                <th className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Amount Paid</th>
                <th className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/10">
              {todaysCollections
                .map((dev: any, idx: number) => (
                  <tr key={dev.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-600">
                      {format(dev.createdAt, 'dd MMM, HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-black text-gray-900">{dev.name}</div>
                      <div className="text-[10px] font-bold text-gray-500">{maskPhoneNumber(dev.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded border ${
                        dev.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {dev.paymentMode || 'Cash'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-black text-emerald-700">₹{(dev.paidAmount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        dev.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                        dev.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {dev.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              {todaysCollections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-bold text-sm bg-white/20">
                    ✨ No collections recorded yet. Start by adding one above! ✨
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
