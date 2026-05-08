import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFestival } from '../contexts/FestivalContext';
import { Devotee, Expense, CulturalEvent } from '../types';
import { BarChart3, Printer, Users, TrendingUp, IndianRupee, FileText } from 'lucide-react';
import { maskPhoneNumber } from '../lib/privacy';

export const Reports = () => {
    const { role } = useAuth();
    const { activeYear } = useFestival();
    const [loading, setLoading] = useState(true);
    const [devotees, setDevotees] = useState<Devotee[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [events, setEvents] = useState<CulturalEvent[]>([]);

    useEffect(() => {
        if (!activeYear || !['SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
            setLoading(false);
            return;
        }

        const fetchAll = async () => {
            try {
                const yearId = activeYear.id;

                const dSnap = await getDocs(query(collection(db, 'devotees'), where('yearId', '==', yearId)));
                const dData: Devotee[] = [];
                dSnap.forEach(d => dData.push({ id: d.id, ...d.data() } as Devotee));
                setDevotees(dData);

                const eSnap = await getDocs(query(collection(db, 'expenses'), where('yearId', '==', yearId)));
                const eData: Expense[] = [];
                eSnap.forEach(e => eData.push({ id: e.id, ...e.data() } as Expense));
                setExpenses(eData);

                const cSnap = await getDocs(query(collection(db, 'culturalEvents'), where('yearId', '==', yearId)));
                const cData: CulturalEvent[] = [];
                cSnap.forEach(c => cData.push({ id: c.id, ...c.data() } as CulturalEvent));
                setEvents(cData);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [activeYear, role]);

    const handlePrint = () => {
        window.print();
    };

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year</div>;

    // Derived Reports
    const totalPledged = devotees.reduce((sum, d) => sum + Number(d.amountPledged || 0), 0);
    const totalCollected = devotees.reduce((sum, d) => sum + Number(d.paidAmount || 0), 0);
    const totalCash = devotees.filter(d => d.paymentMode === 'Cash').reduce((sum, d) => sum + Number(d.paidAmount || 0), 0);
    const totalUpi = devotees.filter(d => d.paymentMode === 'UPI').reduce((sum, d) => sum + Number(d.paidAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const balance = totalCollected - totalExpenses;

    const pendingDevotees = devotees.filter(d => d.paidAmount < d.amountPledged && d.amountPledged > 0).sort((a, b) => b.amountPledged - a.amountPledged);
    const topContributors = [...devotees].sort((a, b) => b.paidAmount - a.paidAmount).slice(0, 10);
    const vips = devotees.filter(d => d.isVip);

    // Volunteer Summary
    const volunteerStats = devotees.reduce((acc, current) => {
        const vid = current.addedBy || 'Unknown';
        if (!acc[vid]) acc[vid] = { amount: 0, count: 0 };
        acc[vid].amount += Number(current.paidAmount || 0);
        acc[vid].count += 1;
        return acc;
    }, {} as Record<string, { amount: number, count: number }>);

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .app-layout { background: white !important; }
                    .glass-header, .desktop-only, mobile-only { display: none !important; }
                    main { padding: 0 !important; max-width: 100% !important; overflow: visible !important; }
                    .card, .stat-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; margin-bottom: 2rem !important; }
                    .fade-in { animation: none !important; opacity: 1 !important; transform: none !important; }
                    body { font-size: 10pt; color: black; }
                    h1, h2, h3 { color: black !important; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 6px; font-size: 9pt; }
                    .page-break { page-break-after: always; }
                }
                `}
            </style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', color: 'var(--saffron-700)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 size={28} /> Advanced Reports
                </h1>
                <button onClick={handlePrint} className="btn btn-primary">
                    <Printer size={18} /> Print All Reports
                </button>
            </div>

            {loading ? <div className="loader loader-lg"></div> : (
                <div id="print-area">
                    {/* Final Balance Report */}
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', borderBottom: '2px solid var(--saffron-100)', paddingBottom: '0.5rem' }}>
                            <FileText size={24} color="var(--saffron-600)" /> Final Festival Balance Report {activeYear.id}
                        </h2>

                        <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
                            <div className="stat-card" style={{ padding: '1rem' }}>
                                <span className="stat-label">Total Collections</span>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>₹{totalCollected.toLocaleString()}</div>
                            </div>
                            <div className="stat-card" style={{ padding: '1rem', background: 'var(--saffron-50)' }}>
                                <span className="stat-label">Cash Collected</span>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>₹{totalCash.toLocaleString()}</div>
                            </div>
                            <div className="stat-card" style={{ padding: '1rem', background: 'var(--saffron-50)' }}>
                                <span className="stat-label">UPI Collected</span>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>₹{totalUpi.toLocaleString()}</div>
                            </div>
                            <div className="stat-card" style={{ padding: '1rem', border: '1px solid var(--danger)', background: 'white' }}>
                                <span className="stat-label">Total Expenses</span>
                                <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>₹{totalExpenses.toLocaleString()}</div>
                            </div>
                        </div>

                        <div style={{ background: balance >= 0 ? 'var(--saffron-50)' : '#fee2e2', padding: '1.5rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Net Festival Balance (Surplus/Deficit)</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: balance >= 0 ? '#166534' : '#991b1b' }}>
                                {balance >= 0 ? '+' : ''}₹{balance.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="page-break"></div>

                    {/* Pending Devotees */}
                    {pendingDevotees.length > 0 && (
                        <div className="card" style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <TrendingUp size={20} color="var(--danger)" /> Pending Balances
                            </h2>
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Devotee Name</th><th>Phone</th><th>Pledged</th><th>Paid</th><th>Due</th></tr></thead>
                                    <tbody>
                                        {pendingDevotees.map(d => (
                                            <tr key={d.id}>
                                                <td style={{ fontWeight: 600 }}>{d.name}</td>
                                                <td>{maskPhoneNumber(d.phoneNumber)}</td>
                                                <td>₹{d.amountPledged}</td>
                                                <td>₹{d.paidAmount}</td>
                                                <td style={{ color: 'var(--danger)', fontWeight: 600 }}>₹{Number(d.amountPledged) - Number(d.paidAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="page-break"></div>

                    {/* Extracted Sections for Printing */}
                    <div className="grid-cols-2">
                        {/* Top Contributors */}
                        <div className="card">
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--saffron-600)' }}>
                                <IndianRupee size={20} /> Top Contributors
                            </h2>
                            <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                <tbody>
                                    {topContributors.map((t, i) => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{i + 1}. {t.name}</td>
                                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 700, color: '#166534' }}>₹{t.paidAmount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Volunteer Summary */}
                        <div className="card">
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--saffron-600)' }}>
                                <Users size={20} /> Collection By Volunteer ID
                            </h2>
                            <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr><th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Volunteer UID</th><th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Count</th><th style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>Amount</th></tr>
                                </thead>
                                <tbody>
                                    {Object.entries(volunteerStats).map(([uid, stats]) => (
                                        <tr key={uid} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.75rem 0', fontFamily: 'monospace', fontSize: '0.75rem' }}>{uid.substring(0, 8)}...</td>
                                            <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>{stats.count}</td>
                                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--saffron-700)' }}>₹{stats.amount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
