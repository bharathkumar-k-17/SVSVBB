import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFestival } from '../contexts/FestivalContext';
import { AnnadanamItem } from '../types';
import { UtensilsCrossed, CheckCircle2 } from 'lucide-react';

export const Annadanam = () => {
    const { activeYear } = useFestival();
    const [items, setItems] = useState<AnnadanamItem[]>([]);

    // Form states
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');
    const [assigned, setAssigned] = useState('');

    const fetchItems = async () => {
        if (!activeYear) return;
        const q = query(collection(db, 'annadanam'), where('yearId', '==', activeYear.id));
        const res = await getDocs(q);
        const data: AnnadanamItem[] = [];
        res.forEach(d => data.push({ id: d.id, ...d.data() } as AnnadanamItem));
        setItems(data);
    };

    useEffect(() => { fetchItems(); }, [activeYear]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeYear) return;
        try {
            await addDoc(collection(db, 'annadanam'), {
                yearId: activeYear.id,
                itemName,
                quantity,
                cost: Number(cost),
                assignedVolunteer: assigned,
                createdAt: new Date().toISOString()
            });
            setItemName(''); setQuantity(''); setCost(''); setAssigned('');
            fetchItems();
        } catch (e) { }
    };

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year</div>;

    const totalCost = items.reduce((acc, current) => acc + Number(current.cost), 0);

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--saffron-700)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UtensilsCrossed size={28} /> Annadanam Preparation
            </h1>

            <div className="grid-cols-2">
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Assign Responsibility</h2>
                    <form onSubmit={handleAdd}>
                        <div className="form-group">
                            <label className="form-label">Item / Task</label>
                            <input type="text" className="form-input" value={itemName} onChange={e => setItemName(e.target.value)} required placeholder="" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Quantity Required</label>
                            <input type="text" className="form-input" value={quantity} onChange={e => setQuantity(e.target.value)} required placeholder="" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Estimated/Actual Cost (₹)</label>
                            <input type="number" className="form-input" value={cost} onChange={e => setCost(e.target.value)} required placeholder="" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assigned Volunteer</label>
                            <input type="text" className="form-input" value={assigned} onChange={e => setAssigned(e.target.value)} required placeholder="" />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Item</button>
                    </form>
                </div>

                <div>
                    <div className="stat-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, white, #dcfce7)', borderColor: '#bbf7d0' }}>
                        <span className="stat-label">Total Annadanam Estimate</span>
                        <div className="stat-value" style={{ color: '#166534' }}>₹{totalCost.toLocaleString()}</div>
                    </div>

                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
                            <table>
                                <thead><tr><th>Item Details</th><th>Cost</th><th>Assigned To</th></tr></thead>
                                <tbody>
                                    {items.map(it => (
                                        <tr key={it.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{it.itemName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{it.quantity}</div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>₹{it.cost}</td>
                                            <td>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--gray-100)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                                                    <CheckCircle2 size={14} color="var(--success)" /> {it.assignedVolunteer}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>No items added</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
