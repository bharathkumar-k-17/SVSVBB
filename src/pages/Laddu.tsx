import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFestival } from '../contexts/FestivalContext';
import { LadduAuction } from '../types';
import { Gift, Gavel } from 'lucide-react';

export const Laddu = () => {
    const { activeYear } = useFestival();
    const [auctions, setAuctions] = useState<LadduAuction[]>([]);

    const [bidderName, setBidderName] = useState('');
    const [amount, setAmount] = useState('');

    const fetchAuctions = async () => {
        if (!activeYear) return;
        const q = query(collection(db, 'ladduAuctions'), where('yearId', '==', activeYear.id));
        const res = await getDocs(q);
        const data: LadduAuction[] = [];
        res.forEach(d => data.push({ id: d.id, ...d.data() } as LadduAuction));
        data.sort((a, b) => b.amount - a.amount);
        setAuctions(data);
    };

    useEffect(() => { fetchAuctions(); }, [activeYear]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeYear) return;
        try {
            await addDoc(collection(db, 'ladduAuctions'), {
                yearId: activeYear.id,
                bidderName,
                amount: Number(amount),
                createdAt: new Date().toISOString()
            });
            setBidderName(''); setAmount('');
            fetchAuctions();
        } catch (e) { }
    };

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year</div>;

    const topBid = auctions.length > 0 ? auctions[0] : null;

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--saffron-700)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gift size={28} /> Laddu Auction & Distribution
            </h1>

            <div className="grid-cols-2">
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Gavel size={20} /> Register Auction Bid
                    </h2>
                    <form onSubmit={handleAdd}>
                        <div className="form-group">
                            <label className="form-label">Bidder Name</label>
                            <input type="text" className="form-input" value={bidderName} onChange={e => setBidderName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bid Amount (₹)</label>
                            <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Register Bid</button>
                    </form>
                </div>

                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--saffron-700)' }}>Current Top Bid</h2>
                    {topBid ? (
                        <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--saffron-50)', borderRadius: 'var(--radius-md)', border: '2px solid var(--saffron-400)' }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--saffron-700)' }}>₹{topBid.amount.toLocaleString()}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>{topBid.bidderName}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Winning so far!</div>
                        </div>
                    ) : <p>No bids yet.</p>}

                    <div style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>All Bids</h3>
                        {auctions.map((a, i) => (
                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                                <span>{i + 1}. {a.bidderName}</span>
                                <span style={{ fontWeight: 600 }}>₹{a.amount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
