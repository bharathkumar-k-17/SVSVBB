import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFestival } from '../contexts/FestivalContext';
import { Devotee } from '../types';
import { Send, User, Phone, List, QrCode, MessageCircle, MessageSquare, PlusCircle, X, CheckCircle2, IndianRupee, HeartHandshake } from 'lucide-react';
import { format } from 'date-fns';
import { maskPhoneNumber } from '../lib/privacy';

export const Chanda = () => {
    const { user } = useAuth();
    const { activeYear } = useFestival();
    const [activeTab, setActiveTab] = useState<'new' | 'list'>('new');
    const [loading, setLoading] = useState(false);
    const [myCollections, setMyCollections] = useState<Devotee[]>([]);

    // Form states
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [pledged, setPledged] = useState('');
    const [paid, setPaid] = useState('');
    const [mode, setMode] = useState<'Cash' | 'UPI'>('Cash');
    const [gotram, setGotram] = useState('');
    const [familyNames, setFamilyNames] = useState('');
    const [inKindDonation, setInKindDonation] = useState('');

    // Receipt Modal State
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastReceipt, setLastReceipt] = useState<Devotee | null>(null);

    // Convert to numbers safely
    const numPledged = Number(pledged) || 0;
    const numPaid = Number(paid) || 0;
    const isVip = numPledged >= 1000;

    const fetchMyCollections = async () => {
        if (!user || !activeYear) return;
        try {
            const q = query(
                collection(db, 'devotees'),
                where('addedBy', '==', user.uid),
                where('yearId', '==', activeYear.id)
            );
            const querySnapshot = await getDocs(q);
            const data: Devotee[] = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as Devotee);
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setMyCollections(data);
        } catch (error) {
            console.error("Error fetching collections:", error);
        }
    };

    useEffect(() => {
        if (activeTab === 'list') {
            fetchMyCollections();
        }
    }, [activeTab, user, activeYear]);

    // Transliterate Telugu Function
    const handleTeluguInput = async (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
        setter(val);
        if (val.endsWith(' ')) {
            const words = val.trim().split(' ');
            const lastWord = words[words.length - 1];
            if (/^[a-zA-Z]+$/.test(lastWord)) {
                try {
                    const response = await fetch(`https://inputtools.google.com/request?text=${lastWord}&itc=te-t-i0-und&num=1`);
                    const data = await response.json();
                    if (data[0] === 'SUCCESS' && data[1][0][1][0]) {
                        const teluguWord = data[1][0][1][0];
                        words[words.length - 1] = teluguWord;
                        setter(words.join(' ') + ' ');
                    }
                } catch (e) {
                    // Ignore errors
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !activeYear) return alert('Session or Year missing!');

        setLoading(true);
        try {
            const now = Date.now();
            const yy = format(now, 'yy');
            const mm = format(now, 'MM');
            const dd = format(now, 'dd');
            const dateStr = `${yy}${mm}${dd}`;
            const counterRef = doc(db, 'counters', `receipt_${dateStr}`);
            let currentCount = 1;

            try {
                await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    if (!counterDoc.exists()) {
                        transaction.set(counterRef, { count: 1 });
                        currentCount = 1;
                    } else {
                        currentCount = counterDoc.data().count + 1;
                        transaction.update(counterRef, { count: currentCount });
                    }
                });
            } catch (txnError) {
                console.error("Transaction failed: ", txnError);
                throw new Error("Ensure device is online to generate secure tracking ID.");
            }

            const paddedCount = currentCount.toString().padStart(3, '0');
            const receiptNumber = `G${dateStr}${paddedCount}`;
            const payload = {
                yearId: activeYear.id,
                name,
                phoneNumber: phone,
                amountPledged: numPledged,
                paidAmount: numPaid,
                paymentMode: mode,
                gotram,
                familyNames,
                inKindDonation,
                isVip,
                receiptNumber,
                addedBy: user.uid,
                createdAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, 'devotees'), payload);

            // Set Receipt and Show Modal automatically
            setLastReceipt({ id: docRef.id, ...payload } as Devotee);
            setShowReceipt(true);

            // Reset form fields
            setName(''); setPhone(''); setPledged(''); setPaid(''); setGotram(''); setFamilyNames(''); setInKindDonation(''); setMode('Cash');

        } catch (error) {
            console.error(error);
            alert("Error adding collection");
        } finally {
            setLoading(false);
        }
    };

    // Auto Sending Handlers
    const constructMessageBody = (receipt: Devotee) => {
        const inKindMsg = receipt.inKindDonation ? `\nIn-Kind Details: ${receipt.inKindDonation}` : '';
        const pendingMsg = receipt.amountPledged > receipt.paidAmount
            ? `\nPending Balance: ₹${receipt.amountPledged - receipt.paidAmount}`
            : '';

        return encodeURIComponent(
            `🙏🏻 *శ్రీ వరసిద్ధి వినాయక భక్త బృందం* 🙏🏻\n` +
            `---------------------------\n` +
            `*RECEIPT NO:* ${receipt.receiptNumber}\n` +
            `*DATE:* ${new Date(receipt.createdAt).toLocaleDateString()}\n\n` +
            `Dear *${receipt.name}* garu,\n` +
            `Thank you for your generous Chanda contribution towards Ganesh Utsav ${receipt.yearId}.\n\n` +
            `*Paid Amount:* ₹${receipt.paidAmount}\n` +
            `*Payment Mode:* ${receipt.paymentMode}` +
            `${inKindMsg}${pendingMsg}\n\n` +
            `May Lord Ganesha bless you and your family!\n` +
            `🌺 *గణపతి బప్పా మోరియా* 🌺`
        );
    };

    const sendWhatsApp = (receipt: Devotee) => {
        const text = constructMessageBody(receipt);
        const formattedPhone = receipt.phoneNumber.startsWith('+') ? receipt.phoneNumber : `+91${receipt.phoneNumber}`;
        window.open(`https://wa.me/${formattedPhone.replace('+', '')}?text=${text}`, '_blank');
    };

    const sendSMS = (receipt: Devotee) => {
        const text = constructMessageBody(receipt);
        window.open(`sms:${receipt.phoneNumber}?body=${text}`, '_self');
    };

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year configured.</div>;

    const getStatus = (pledge: number, paid: number) => {
        if (paid >= pledge && pledge > 0) return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: '#dcfce7', color: '#166534' }}>PAID</span>;
        if (paid > 0 && paid < pledge) return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: '#fef3c7', color: '#92400e' }}>PARTIAL</span>;
        return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: '#fee2e2', color: '#991b1b' }}>UNPAID</span>;
    };

    return (
        <div className="fade-in" style={{ paddingBottom: '4rem', position: 'relative' }}>
            <h1 style={{ fontSize: '1.75rem', color: '#c2410c', marginBottom: '1.5rem', fontWeight: 'bold' }}>Chanda Collection</h1>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #ffedd5' }}>
                <button
                    onClick={() => setActiveTab('new')}
                    style={{ padding: '0.75rem 1rem', borderBottom: activeTab === 'new' ? '3px solid #ea580c' : '3px solid transparent', color: activeTab === 'new' ? '#c2410c' : '#9ca3af', fontWeight: activeTab === 'new' ? 700 : 500, background: 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <PlusCircle size={18} /> New Entry
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    style={{ padding: '0.75rem 1rem', borderBottom: activeTab === 'list' ? '3px solid #ea580c' : '3px solid transparent', color: activeTab === 'list' ? '#c2410c' : '#9ca3af', fontWeight: activeTab === 'list' ? 700 : 500, background: 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <List size={18} /> My Collections
                </button>
            </div>

            {activeTab === 'new' ? (
                <div style={{ maxWidth: '650px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', padding: '1.5rem' }} className="fade-in">

                    <form onSubmit={handleSubmit}>
                        {/* Section 1: Basic Info */}
                        <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#9a3412', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={18} /> Primary Details
                            </h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#78350f', marginBottom: '0.5rem' }}>Full Name *</label>
                                <input type="text" value={name} onChange={e => handleTeluguInput(e.target.value, setName)} required placeholder="" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #fdba74', outline: 'none', backgroundColor: 'white' }} />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#78350f', marginBottom: '0.5rem' }}>WhatsApp Number *</label>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #fdba74', outline: 'none', backgroundColor: 'white' }} />
                            </div>
                        </div>

                        {/* Section 2: Family & Traditional Info */}
                        <div style={{ padding: '1rem', background: '#faf5ff', borderRadius: '12px', border: '1px solid #f3e8ff', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={18} /> Family & Poojari Details
                            </h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#581c87', marginBottom: '0.5rem' }}>Gotram</label>
                                <input type="text" value={gotram} onChange={e => handleTeluguInput(e.target.value, setGotram)} placeholder="" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #d8b4fe', outline: 'none', backgroundColor: 'white' }} />
                            </div>

                            <div style={{ marginBottom: '0' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#581c87', marginBottom: '0.5rem' }}>Family Names</label>
                                <textarea
                                    value={familyNames}
                                    onChange={e => handleTeluguInput(e.target.value, setFamilyNames)}
                                    placeholder=""
                                    rows={2}
                                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #d8b4fe', outline: 'none', backgroundColor: 'white', resize: 'vertical' }}
                                />
                            </div>
                        </div>

                        {/* Section 3: Payment & Kind Details */}
                        <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#166534', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <IndianRupee size={18} /> Donation Details
                            </h3>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#14532d', marginBottom: '0.5rem' }}>Amount Pledged (₹) *</label>
                                    <input type="number" value={pledged} onChange={e => setPledged(e.target.value)} required placeholder="" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #86efac', outline: 'none', backgroundColor: 'white' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#14532d', marginBottom: '0.5rem' }}>Amount Paid (₹) *</label>
                                    <input type="number" value={paid} onChange={e => setPaid(e.target.value)} required placeholder="" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #86efac', outline: 'none', backgroundColor: 'white' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#14532d', marginBottom: '0.5rem' }}>Payment Mode *</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {['Cash', 'UPI'].map((m) => (
                                        <label key={m} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: mode === m ? '2px solid #22c55e' : '1px solid #bbf7d0', borderRadius: '8px', flex: 1, cursor: 'pointer', background: mode === m ? '#ecfdf5' : 'white', color: mode === m ? '#166534' : '#14532d', fontWeight: 600, transition: 'all 0.2s' }}>
                                            <input type="radio" value={m} checked={mode === m} onChange={() => setMode(m as any)} style={{ display: 'none' }} />
                                            {m === 'UPI' ? <QrCode size={18} /> : <IndianRupee size={18} />}
                                            {m}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamic UPI QR Code Revealer */}
                            {mode === 'UPI' && (
                                <div className="fade-in" style={{ padding: '1rem', background: '#ffffff', borderRadius: '8px', border: '1px dashed #22c55e', textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600, marginBottom: '0.5rem' }}>Official Temple UPI QR Code (Auto-Amount: ₹{numPaid || 0})</p>
                                    <div style={{ background: '#f8fafc', padding: '0.5rem', display: 'inline-block', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        {/* In production, substitute pa= email/id of specific merchant */}
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=templemerchant@ybl%26pn=SREE%20VARA%20SIDHI%20VINAYAKA%20BAKTHA%20BHRUNDAM%26am=${numPaid || ''}%26cu=INR`}
                                            alt="SVSVBB UPI Payment QR"
                                            style={{ width: '180px', height: '180px', borderRadius: '4px' }}
                                        />
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Ask devotee to scan the image above to pay via PhonePe / GPay / Paytm.</p>
                                </div>
                            )}

                            <div style={{ marginBottom: '0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#14532d', marginBottom: '0.5rem' }}>
                                    <HeartHandshake size={18} /> Donation in-kind (Optional Items)
                                </label>
                                <input type="text" value={inKindDonation} onChange={e => setInKindDonation(e.target.value)} placeholder="" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #86efac', outline: 'none', backgroundColor: 'white' }} />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', fontWeight: 700, fontSize: '1.1rem', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(234, 88, 12, 0.4)' }}>
                            {loading ? 'Generating Receipt...' : (
                                <>
                                    <Send size={20} /> Collect & Generate Receipt
                                </>
                            )}
                        </button>
                    </form>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', overflow: 'hidden' }} className="fade-in">
                    {myCollections.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                            <p>You haven't collected any chanda yet for {activeYear.id}.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>S.No</th>
                                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>Date</th>
                                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>Devotee Info</th>
                                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>Status</th>
                                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>Amount</th>
                                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>Quick Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myCollections.map((c, index) => (
                                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1rem', color: '#475569', fontWeight: 'bold', fontSize: '0.875rem' }}>{index + 1}</td>
                                            <td style={{ padding: '1rem', color: '#475569', fontSize: '0.85rem' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                                    {c.name} {c.isVip && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#fef08a', color: '#854d0e', fontSize: '0.65rem', marginLeft: '0.5rem', fontWeight: 800 }}>VIP</span>}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                                    <Phone size={12} /> {maskPhoneNumber(c.phoneNumber)}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>No: {c.receiptNumber}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>{getStatus(c.amountPledged, c.paidAmount)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 700, color: '#166534' }}>₹{c.paidAmount}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#475569' }}>of ₹{c.amountPledged}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => sendWhatsApp(c)} style={{ padding: '0.4rem 0.6rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                        <MessageCircle size={14} /> WhatsApp
                                                    </button>
                                                    <button onClick={() => sendSMS(c)} style={{ padding: '0.4rem 0.6rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                        <MessageSquare size={14} /> SMS
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* AESTHETIC RECEIPT OVERLAY MODAL */}
            {showReceipt && lastReceipt && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="fade-in" style={{ background: '#fff9ed', width: '100%', maxWidth: '420px', borderRadius: '16px', border: '2px dashed #fcd34d', padding: '2rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>

                        {/* Temple Emblem Header */}
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px dashed #f59e0b', paddingBottom: '1rem' }}>
                            <div style={{ width: '48px', height: '48px', background: '#ea580c', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 0.5rem' }}>ॐ</div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', lineHeight: 1.3 }}>
                                శ్రీ వరసిద్ధి వినాయక<br />భక్త బృందం - 2008
                            </h2>
                            <p style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, marginTop: '0.25rem', letterSpacing: '1px' }}>OFFICIAL DONATION RECEIPT</p>
                        </div>

                        {/* Receipt Meta Data */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#78350f', marginBottom: '1.5rem', fontWeight: 600 }}>
                            <div>No: {lastReceipt.receiptNumber}</div>
                            <div>Date: {new Date(lastReceipt.createdAt).toLocaleDateString()}</div>
                        </div>

                        {/* Devotee Data Block */}
                        <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', border: '1px solid #fef3c7', marginBottom: '1.5rem' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 700 }}>Name</span>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{lastReceipt.name}</div>
                            </div>

                            {lastReceipt.gotram && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 700 }}>Gotram</span>
                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>{lastReceipt.gotram}</div>
                                </div>
                            )}

                            {lastReceipt.inKindDonation && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 700 }}>Items Donated</span>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{lastReceipt.inKindDonation}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                                <div>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Payment mode</span>
                                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{lastReceipt.paymentMode}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Amount Paid</span>
                                    <span style={{ fontWeight: 800, color: '#166534', fontSize: '1.25rem' }}>₹{lastReceipt.paidAmount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Send Buttons */}
                        <p style={{ fontSize: '0.8rem', textAlign: 'center', fontWeight: 600, color: '#92400e', marginBottom: '0.75rem' }}>Deliver this receipt instantly to Devotee:</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button onClick={() => sendWhatsApp(lastReceipt)} style={{ background: '#25D366', color: 'white', padding: '0.875rem', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(37, 211, 102, 0.4)' }}>
                                <MessageCircle size={20} /> SEND VIA WHATSAPP (Aesthetic Format)
                            </button>
                            <button onClick={() => sendSMS(lastReceipt)} style={{ background: '#e2e8f0', color: '#334155', padding: '0.875rem', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                <MessageSquare size={20} /> SEND VIA SMS
                            </button>
                        </div>

                        {/* Close Button */}
                        <button onClick={() => { setActiveTab('list'); setShowReceipt(false); }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#ffe4e6', color: '#e11d48', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
