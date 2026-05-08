import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFestival } from '../contexts/FestivalContext';
import { HundiCollection } from '../types';
import { Wallet, IndianRupee } from 'lucide-react';

export const Hundi = () => {
    const { activeYear } = useFestival();
    const [hundiLogs, setHundiLogs] = useState<HundiCollection[]>([]);

    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [countedBy, setCountedBy] = useState('');

    const fetchHundi = async () => {
        if (!activeYear) return;
        const q = query(collection(db, 'hundi'), where('yearId', '==', activeYear.id));
        const res = await getDocs(q);
        const data: HundiCollection[] = [];
        res.forEach(d => data.push({ id: d.id, ...d.data() } as HundiCollection));
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHundiLogs(data);
    };

    useEffect(() => { fetchHundi(); }, [activeYear]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeYear) return;
        try {
            await addDoc(collection(db, 'hundi'), {
                yearId: activeYear.id,
                amountCounted: Number(amount),
                date,
                countedBy,
                createdAt: new Date().toISOString()
            });
            setAmount(''); setCountedBy('');
            fetchHundi();
        } catch (e) { }
    };

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year</div>;

    const totalHundi = hundiLogs.reduce((acc, log) => acc + Number(log.amountCounted), 0);

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--saffron-700)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={28} /> Hundi Collections
            </h1>

            <div className="grid-cols-2">
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <IndianRupee size={20} /> Log Hundi Count
                    </h2>
                    <form onSubmit={handleAdd}>
                        <div className="form-group">
                            <label className="form-label">Amount Counted (₹)</label>
                            <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date of Counting</label>
                            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Counted By (Committee Members)</label>
                            <input type="text" className="form-input" value={countedBy} onChange={e => setCountedBy(e.target.value)} required placeholder="" />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Record</button>
                    </form>
                </div>

                <div>
                    <div className="stat-card" style={{ marginBottom: '1.5rem' }}>
                        <span className="stat-label">Total Hundi Revenue</span>
                        <div className="stat-value">₹{totalHundi.toLocaleString()}</div>
                    </div>

                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
                            <table>
                                <thead><tr><th>Date</th><th>Amount</th><th>Witnesses</th></tr></thead>
                                <tbody>
                                    {hundiLogs.map(h => (
                                        <tr key={h.id}>
                                            <td style={{ fontWeight: 600 }}>{h.date}</td>
                                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>₹{h.amountCounted}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{h.countedBy}</td>
                                        </tr>
                                    ))}
                                    {hundiLogs.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>No logs yet</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
