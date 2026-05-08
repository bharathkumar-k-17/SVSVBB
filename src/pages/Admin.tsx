import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, setDoc, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFestival } from '../contexts/FestivalContext';
import { FestivalYear, User } from '../types';
import { Settings, UserPlus, Lock, Unlock, Zap, ShieldAlert, CheckCircle, XCircle, Clock } from 'lucide-react';
import { maskPhoneNumber } from '../lib/privacy';

export const Admin = () => {
    const { role } = useAuth();
    const { years, activeYear } = useFestival();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // New year form
    const [newYearId, setNewYearId] = useState('');

    const fetchUsers = async () => {
        try {
            const q = query(collection(db, 'users'));
            const snapshot = await getDocs(q);
            const data: User[] = [];
            snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as User));
            // Sort to show pending users first
            data.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return 0;
            });
            setUsers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [role]);

    const handleUpdateUserStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
        if (!window.confirm(`Are you sure you want to mark this user as ${newStatus.toUpperCase()}?`)) return;
        try {
            await updateDoc(doc(db, 'users', userId), { status: newStatus });
            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        } catch (error) {
            console.error(error);
            alert('Failed to update user.');
        }
    };

    const handleCreateYear = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newYearId.trim()) return;

        try {
            const docRef = doc(db, 'festivalYears', newYearId);
            await setDoc(docRef, {
                isActive: true,
                isLocked: false,
                nextReceiptNumber: 1,
                createdAt: new Date().toISOString()
            });

            // Deactivate others
            years.forEach(async y => {
                if (y.id !== newYearId && y.isActive) {
                    await updateDoc(doc(db, 'festivalYears', y.id), { isActive: false, isLocked: true });
                }
            });

            setNewYearId('');
            alert('New Festival Year Created & Activated!');
        } catch (error) {
            console.error(error);
            alert('Failed to create year');
        }
    };

    const handleToggleYearLock = async (year: FestivalYear) => {
        try {
            await updateDoc(doc(db, 'festivalYears', year.id), { isLocked: !year.isLocked });
            alert(`Year ${year.id} ${!year.isLocked ? 'Locked' : 'Unlocked'}`);
        } catch (e) {
            alert('Failed to update year');
        }
    };

    const handleSetActiveYear = async (year: FestivalYear) => {
        try {
            for (const y of years) {
                if (y.isActive) {
                    await updateDoc(doc(db, 'festivalYears', y.id), { isActive: false });
                }
            }
            await updateDoc(doc(db, 'festivalYears', year.id), { isActive: true });
            alert(`Year ${year.id} is now Active`);
        } catch (e) {
            alert('Failed to update year');
        }
    };

    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return <div style={{ padding: '2rem', textAlign: 'center' }}><ShieldAlert size={48} color="var(--danger)" style={{ margin: '0 auto', marginBottom: '1rem' }} /><h2>Unauthorized</h2><p>Only Admins can access this area.</p></div>;

    const pendingUsers = users.filter(u => u.status === 'pending');
    const processedUsers = users.filter(u => u.status !== 'pending');

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', color: '#c2410c', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                <Settings size={28} /> System Settings
            </h1>

            <div className="grid-cols-2" style={{ gap: '2rem', marginBottom: '2rem' }}>
                {role === 'SUPER_ADMIN' && (
                    <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937' }}>
                            <Zap size={20} color="#f59e0b" /> Festival Year Management
                        </h2>

                        <form onSubmit={handleCreateYear} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                            <input type="text" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} value={newYearId} onChange={e => setNewYearId(e.target.value)} required placeholder="" />
                            <button type="submit" style={{ padding: '0.5rem 1rem', background: '#ea580c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600 }}>Start New Year</button>
                        </form>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '0.875rem' }}>
                                        <th style={{ padding: '0.75rem' }}>Year</th>
                                        <th style={{ padding: '0.75rem' }}>Status</th>
                                        <th style={{ padding: '0.75rem' }}>Lock Control</th>
                                        <th style={{ padding: '0.75rem' }}>Active Control</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {years.map(y => (
                                        <tr key={y.id} style={{ background: y.isActive ? '#fff7ed' : 'transparent', borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{y.id}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {y.isActive && <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>ACTIVE</span>}
                                                {y.isLocked && <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>LOCKED</span>}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <button onClick={() => handleToggleYearLock(y)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb', background: y.isLocked ? '#f3f4f6' : '#fee2e2', color: y.isLocked ? '#374151' : '#b91c1c', cursor: 'pointer' }}>
                                                    {y.isLocked ? <Unlock size={14} style={{ display: 'inline' }} /> : <Lock size={14} style={{ display: 'inline' }} />} {y.isLocked ? 'Unlock' : 'Lock Base'}
                                                </button>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {!y.isActive && (
                                                    <button onClick={() => handleSetActiveYear(y)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>
                                                        Set Active
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', gridColumn: role === 'ADMIN' ? '1 / -1' : 'auto' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937' }}>
                        <UserPlus size={20} color="#f59e0b" /> Pending Registration Approvals
                    </h2>

                    {pendingUsers.length === 0 ? (
                        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>No pending users to approve.</p>
                    ) : (
                        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#fef3c7', borderBottom: '2px solid #fde68a', color: '#92400e', fontSize: '0.875rem' }}>
                                        <th style={{ padding: '0.75rem' }}>User Info</th>
                                        <th style={{ padding: '0.75rem' }}>Role Request</th>
                                        <th style={{ padding: '0.75rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingUsers.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ fontWeight: 600 }}>{u.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>E: {u.email} | P: {u.phone}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#c2410c' }}>{u.role}</span>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {(role === 'SUPER_ADMIN' || role === 'ADMIN') ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleUpdateUserStatus(u.id, 'approved')} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <CheckCircle size={14} /> Approve
                                                        </button>
                                                        <button onClick={() => handleUpdateUserStatus(u.id, 'rejected')} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No Permission (Super Admin required)</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                        Processed Users
                    </h2>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563', fontSize: '0.875rem' }}>
                                    <th style={{ padding: '0.75rem' }}>User Info</th>
                                    <th style={{ padding: '0.75rem' }}>Role</th>
                                    <th style={{ padding: '0.75rem' }}>Status</th>
                                    <th style={{ padding: '0.75rem' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedUsers.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ fontWeight: 600 }}>{u.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{u.email}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>{u.role}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {u.status === 'approved'
                                                ? <span style={{ color: '#166534', background: '#dcfce7', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>APPROVED</span>
                                                : <span style={{ color: '#991b1b', background: '#fee2e2', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>REJECTED</span>}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {(role === 'SUPER_ADMIN' || role === 'ADMIN') ? (
                                                <button onClick={() => handleUpdateUserStatus(u.id, u.status === 'approved' ? 'rejected' : 'approved')} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                                                    {u.status === 'approved' ? 'Revoke Access' : 'Re-approve'}
                                                </button>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    );
};
