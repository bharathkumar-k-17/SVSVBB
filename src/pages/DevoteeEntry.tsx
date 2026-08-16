import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useAppSettings } from '../hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { HeartHandshake, Banknote, QrCode, Crown, Save } from 'lucide-react';
import { MaskedPhoneInput } from '../components/MaskedPhoneInput';
import { TeluguInput } from '../components/TeluguInput';
import { Receipt } from '../components/Receipt';
import { QRCodeSVG } from 'qrcode.react';
import { normalizePhoneDigits } from '../lib/privacy';
import { format } from 'date-fns';

export function DevoteeEntry() {
    const { currentYear } = useAppStore();
    const { appUser } = useAuthStore();
    const queryClient = useQueryClient();
    const { data: appSettings } = useAppSettings();

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [lastSavedDevotee, setLastSavedDevotee] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        totalAmount: '',
        paidAmount: '',
        donationItem: '',
        paymentMode: 'Cash' as 'Cash' | 'UPI',
        gotram: '',
        familyMembersStr: '',
        date: format(new Date(), 'yyyy-MM-dd')
    });

    const totalAmtNum = Number(formData.totalAmount) || 0;
    const paidAmtNum = Number(formData.paidAmount) || 0;
    const pendingAmtNum = totalAmtNum - paidAmtNum;
    const isVip = totalAmtNum >= 1000 || formData.donationItem.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!appUser) return;

        let rawPhone = normalizePhoneDigits(formData.phone);
        if (rawPhone.length === 12 && rawPhone.startsWith('91')) {
            rawPhone = rawPhone.slice(2);
        }
        if (rawPhone && rawPhone.length !== 10) {
            alert('Enter a valid 10-digit phone number or leave it blank.');
            return;
        }

        if (totalAmtNum < 0 || paidAmtNum < 0) {
            alert('Amounts cannot be negative.');
            return;
        }
        if (paidAmtNum > totalAmtNum) {
            alert('Paid amount cannot exceed total amount.');
            return;
        }

        setLoading(true);
        setSuccess(false);

        try {
            const { data, error } = await supabase.functions.invoke('add-devotee', {
                body: {
                    name: formData.name,
                    phone: rawPhone,
                    total_amount: totalAmtNum,
                    paid_amount: paidAmtNum,
                    donation_item: formData.donationItem,
                    payment_mode: formData.paymentMode,
                    gotram: isVip ? formData.gotram : '',
                    family_members: isVip ? formData.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
                    year: currentYear,
                    date: formData.date,
                    volunteer_id: appUser.email || appUser.id,
                    volunteer_name: appUser.name,
                    volunteer_phone: appUser.phone
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            // Successfully saved
            const savedDevotee = {
                id: data.devoteeId,
                name: formData.name,
                phone: rawPhone,
                totalAmount: totalAmtNum,
                paidAmount: paidAmtNum,
                pendingAmount: pendingAmtNum,
                paymentMode: formData.paymentMode,
                paymentStatus: pendingAmtNum === 0 ? 'PAID' : (paidAmtNum > 0 ? 'PARTIAL' : 'UNPAID'),
                donationItem: formData.donationItem,
                gotram: formData.gotram,
                familyMembers: isVip ? formData.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
                volunteerId: appUser.email || appUser.id,
                volunteerName: appUser.name,
                receiptNo: data.receiptNo,
                createdAt: new Date().getTime(),
                year: currentYear
            };

            setLastSavedDevotee(savedDevotee);
            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['devotees'] }); // Refresh queries

            setFormData({
                name: '',
                phone: '',
                totalAmount: '',
                paidAmount: '',
                donationItem: '',
                paymentMode: 'Cash',
                gotram: '',
                familyMembersStr: '',
                date: format(new Date(), 'yyyy-MM-dd')
            });
        } catch (err: any) {
            console.error(err);
            alert(`Error saving devotee: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSuccess(false);
        setLastSavedDevotee(null);
    };

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <HeartHandshake className="text-primary" />
                    Devotee Entry
                </h2>

                {success && lastSavedDevotee ? (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 shadow-sm flex flex-col gap-3 items-center mb-6">
                            <span className="font-bold flex items-center gap-2 text-lg">✅ Entry Saved Successfully!</span>
                        </div>
                        <Receipt data={lastSavedDevotee} isBlank={false} hideActions={false} isPortal={false} />
                        <button
                            onClick={handleReset}
                            className="mt-6 w-full flex items-center justify-center py-3 border border-gray-300 rounded-xl shadow-sm bg-white font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Add Another Devotee
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
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
                                    required
                                    min="0"
                                    value={formData.totalAmount}
                                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all font-bold text-gray-900 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Paid Amount (₹)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    max={formData.totalAmount || "0"}
                                    value={formData.paidAmount}
                                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all font-bold text-green-700 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">In-kind Donation / Item</label>
                                <input
                                    type="text"
                                    value={formData.donationItem}
                                    onChange={(e) => setFormData({ ...formData, donationItem: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <label className="block text-sm font-semibold text-gray-900 mb-3">Payment Summary & Mode</label>
                            <div className="flex bg-white p-3 rounded-lg border border-gray-200 justify-between mb-4 text-sm font-bold shadow-sm">
                                <span>Pending Amount:</span>
                                <span className={pendingAmtNum > 0 ? "text-red-500" : "text-green-500"}>
                                    ₹{pendingAmtNum.toLocaleString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.paymentMode === 'Cash' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="paymentMode"
                                        value="Cash"
                                        checked={formData.paymentMode === 'Cash'}
                                        onChange={() => setFormData({ ...formData, paymentMode: 'Cash' })}
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
                                        onChange={() => setFormData({ ...formData, paymentMode: 'UPI' })}
                                        className="hidden"
                                    />
                                    <QrCode className="mr-2" size={20} />
                                    <span className="font-bold">UPI</span>
                                </label>
                            </div>

                            {formData.paymentMode === 'UPI' && (
                                <div className="mt-4 p-5 bg-white border border-gray-200 rounded-xl flex flex-col items-center text-center animate-in fade-in slide-in-from-top-2">
                                    {appSettings?.upi_id ? (() => {
                                        const numAmt = Number(formData.paidAmount) || 0;
                                        const upiUrl = `upi://pay?pa=${appSettings.upi_id}&pn=SVSVBB&am=${numAmt > 0 ? numAmt : ''}&cu=INR&tn=Chanda%20Donation`;
                                        return (
                                            <>
                                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 mb-4 inline-block mt-2">
                                                    <QRCodeSVG value={upiUrl} size={150} level="M" />
                                                </div>
                                                <div className="w-full bg-orange-50 rounded-lg p-3 text-sm text-gray-700 border border-orange-100/50 shadow-sm text-left">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-gray-500 font-medium text-xs">UPI ID</span>
                                                        <span className="font-bold">{appSettings.upi_id}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500 font-medium text-xs">Amount</span>
                                                        <span className="font-bold text-red-600">₹{numAmt}</span>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })() : (
                                        <p className="text-gray-500 text-sm font-medium">UPI ID is not configured in settings.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {isVip && (
                            <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200 shadow-sm relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-4 font-bold text-yellow-800">
                                    <Crown size={20} /> VIP Slot Auto-Unlocked
                                </div>
                                <div className="space-y-4 relative z-10">
                                    <TeluguInput
                                        label="Gotram Name"
                                        value={formData.gotram}
                                        onChange={(val) => setFormData({ ...formData, gotram: val })}
                                    />
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Family Members (Comma separated)</label>
                                        <TeluguInput
                                            value={formData.familyMembersStr}
                                            onChange={(val) => setFormData({ ...formData, familyMembersStr: val })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || formData.name.trim() === '' || totalAmtNum < 0 || paidAmtNum < 0}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-md text-white font-bold text-lg bg-gradient-to-r from-primary to-orange-500 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            ) : (
                                <> <Save size={24} /> Save Devotee Entry </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
