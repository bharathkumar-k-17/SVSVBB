import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFestival } from '../contexts/FestivalContext';
import { Devotee } from '../types';
import { Users, Crown, Search, CheckCircle2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { maskPhoneNumber } from '../lib/privacy';

export const Devotees = () => {
    const { role } = useAuth();
    const { activeYear } = useFestival();
    const [devotees, setDevotees] = useState<Devotee[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'all' | 'vip'>('vip');
    const [search, setSearch] = useState('');

    const canAccess = role === 'ADMIN' || role === 'SUPER_ADMIN';

    useEffect(() => {
        if (!activeYear || !canAccess) {
            setLoading(false);
            return;
        }

        const fetchDevotees = async () => {
            try {
                const q = query(
                    collection(db, 'devotees'),
                    where('yearId', '==', activeYear.id)
                );
                const snapshot = await getDocs(q);
                const data: Devotee[] = [];
                snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Devotee));
                data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setDevotees(data);
            } catch (error) {
                console.error("Error fetching devotees", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDevotees();
    }, [activeYear, canAccess]);

    if (!canAccess) {
        return <Navigate to="/dashboard" replace />;
    }

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year</div>;

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}><div className="loader loader-lg"></div></div>;

    const filtered = devotees.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.phoneNumber.includes(search));
    const vips = filtered.filter(d => d.isVip);

    return (
        <div className="fade-in">
            <h1 style={{ fontSize: '1.75rem', color: 'var(--saffron-700)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={28} /> Devotees Directory
            </h1>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--gray-100)' }}>
                <button
                    onClick={() => setTab('vip')}
                    style={{ padding: '0.75rem 1rem', borderBottom: tab === 'vip' ? '2px solid var(--saffron-600)' : '2px solid transparent', color: tab === 'vip' ? 'var(--saffron-700)' : 'var(--text-muted)', fontWeight: tab === 'vip' ? 600 : 400 }}
                >
                    <Crown size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--gold-500)' }} />
                    VIP Gotrams ({vips.length})
                </button>
                <button
                    onClick={() => setTab('all')}
                    style={{ padding: '0.75rem 1rem', borderBottom: tab === 'all' ? '2px solid var(--saffron-600)' : '2px solid transparent', color: tab === 'all' ? 'var(--saffron-700)' : 'var(--text-muted)', fontWeight: tab === 'all' ? 600 : 400 }}
                >
                    <List size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    All Devotees ({filtered.length})
                </button>
            </div>

            <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    className="form-input"
                    placeholder=""
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: '3rem' }}
                />
            </div>

            <div className="card" style={{ padding: 0 }}>
                {tab === 'vip' ? (
                    <div style={{ padding: '1.5rem' }}>
                        {vips.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No VIP gotrams found.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {vips.map(v => (
                                    <div key={v.id} className="vip-gotram" style={{ margin: 0 }}>
                                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{v.gotram || 'N/A'}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{v.name}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Devotee Name</th>
                                    <th>Phone</th>
                                    <th>Pledged</th>
                                    <th>Paid</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(d => (
                                    <tr key={d.id}>
                                        <td>{d.name} {d.isVip && <span className="badge badge-vip" style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>VIP</span>}</td>
                                        <td>{maskPhoneNumber(d.phoneNumber)}</td>
                                        <td>₹{d.amountPledged}</td>
                                        <td>₹{d.paidAmount}</td>
                                        <td>
                                            {d.paidAmount >= d.amountPledged && d.amountPledged > 0 ? <span className="badge badge-success">PAID</span> : (d.paidAmount > 0 ? <span className="badge badge-warning">PARTIAL</span> : <span className="badge badge-danger">UNPAID</span>)}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No devotees found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// Fake List component since I used it inside
function List({ size, style }: { size: number, style?: React.CSSProperties }) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={size} height={size} style={style}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
    );
}
