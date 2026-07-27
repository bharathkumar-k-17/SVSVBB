import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useVIPGotrams } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import {
  Crown, Plus, Trash2, Edit2, Save, X,
  ChevronUp, ChevronDown, CheckCircle
} from 'lucide-react';

import { TeluguInput } from '../components/TeluguInput';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EditState {
  id: string;
  gotram: string;
  familyMembersStr: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function VIPGotram() {
  const { currentYear } = useAppStore();
  const { appUser } = useAuthStore();
  const { data: vipGotramsData, isLoading, refetch } = useVIPGotrams(currentYear);
  const vipGotrams = vipGotramsData || [];

  // ── Form state ──
  const [gotramInput, setGotramInput] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast] = useState('');

  // ── Edit state ──
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Toast helper ──
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Resolve members array ──
  const resolveMembers = (): string[] => {
    return membersInput.split(',').map(s => s.trim()).filter(Boolean);
  };

  // ── Check duplicate gotram ──
  const isDuplicate = (_gotram: string, _excludeId?: string): boolean => false;

  // ── Save (Manual Add) ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const members = resolveMembers();
    if (!gotramInput.trim()) return;
    if (isDuplicate(gotramInput)) {
      showToast('⚠️ This Gotram is already in the VIP list!');
      return;
    }
    setFormLoading(true);
    try {
      const nextOrder = vipGotrams.length > 0
        ? Math.max(...vipGotrams.map(v => v.order)) + 1
        : 1;

      const { error } = await supabase
        .from('vip_gotrams')
        .insert({
          gotram: gotramInput.trim(),
          family_members: members,
          order: nextOrder,
          source: 'Manual',
          year: currentYear,
          created_at: Date.now(),
        });

      if (error) throw error;

      setGotramInput('');
      setMembersInput('');
      showToast('✅ VIP Gotram saved successfully!');
      refetch();
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Failed to save: ${err.message || 'Check connection.'}`);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this VIP Gotram entry?')) return;
    try {
      const { error } = await supabase
        .from('vip_gotrams')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('🗑️ Entry deleted.');
      refetch();
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Delete failed: ${err.message || 'Unknown error'}`);
    }
  };

  // ── Start Edit ──
  const startEdit = (vip: any) => {
    setEditState({ id: vip.id, gotram: vip.gotram, familyMembersStr: (vip.familyMembers || []).join(', ') });
  };

  // ── Save Edit ──
  const saveEdit = async () => {
    if (!editState) return;
    if (!editState.gotram.trim()) return;
    if (isDuplicate(editState.gotram, editState.id)) {
      showToast('⚠️ Duplicate Gotram name!');
      return;
    }
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('vip_gotrams')
        .update({
          gotram: editState.gotram.trim(),
          family_members: editState.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean),
        })
        .eq('id', editState.id);

      if (error) throw error;

      setEditState(null);
      showToast('✅ Entry updated!');
      refetch();
    } catch (err: any) {
      showToast(`❌ Update failed: ${err.message || 'Unknown error'}`);
    } finally {
      setEditLoading(false);
    }
  };

  // ── Reorder ──
  const moveRow = async (idx: number, direction: 'up' | 'down') => {
    const list = [...vipGotrams];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    const a = list[idx];
    const b = list[swapIdx];

    try {
      await Promise.all([
        supabase.from('vip_gotrams').update({ order: b.order }).eq('id', a.id),
        supabase.from('vip_gotrams').update({ order: a.order }).eq('id', b.id),
      ]);
      refetch();
    } catch (err) {
      console.error('Reorder failed:', err);
      showToast('❌ Reorder failed.');
    }
  };

  const isVolunteer = appUser?.role === 'volunteer';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce-in text-sm font-semibold">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-100 p-3 rounded-full">
            <Crown className="text-yellow-600 h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              VIP Gothram Management
            </h1>

          </div>
        </div>

      </div>

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Entries', value: vipGotrams.length, color: 'yellow' },
          { label: 'Manual', value: vipGotrams.filter(v => v.source === 'Manual').length, color: 'blue' },
          { label: 'From Chanda', value: vipGotrams.filter(v => v.source === 'Chanda').length, color: 'green' }
        ].map(stat => (
          <div
            key={stat.label}
            className={`bg-white rounded-2xl p-4 border shadow-sm text-center border-${stat.color}-200`}
          >
            <div className={`text-3xl font-black text-${stat.color}-600`}>{stat.value}</div>
            <div className="text-xs text-gray-500 font-semibold mt-1 uppercase tracking-wide">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── Manual Entry Form ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 p-6 h-fit lg:col-span-1">
          <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
            <Plus className="text-yellow-600" size={20} /> Manual Add
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Gotram Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Gotram Name
              </label>
              <TeluguInput
                value={gotramInput}
                onChange={(val) => setGotramInput(val)}
                placeholder=""
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Family Members (Comma separated)
              </label>
              <TeluguInput
                value={membersInput}
                onChange={(val) => setMembersInput(val)}
                placeholder="name1, name2, name3..."
              />
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {formLoading
                ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                : <><Save size={18} /> Save Entry</>
              }
            </button>
          </form>
        </div>

        {/* ─── VIP List Table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100 bg-yellow-50/40 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Crown size={18} className="text-yellow-500" /> VIP Gothram List
            </h3>
            <span className="text-xs text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full font-bold">
              {vipGotrams.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide w-14">S.No</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Gotram</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Members</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wide w-20">Source</th>
                  {!isVolunteer && <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wide w-36">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoading ? (
                  <tr><td colSpan={isVolunteer ? 4 : 5} className="px-6 py-8 text-center text-gray-500">Loading VIP Gotrams...</td></tr>
                ) : vipGotrams.map((vip, idx) => (
                  <tr key={vip.id} className="hover:bg-yellow-50/30 transition-colors group">

                    {/* S.No */}
                    <td className="px-3 py-3 text-sm text-gray-500 font-black w-14">
                      {idx + 1}
                    </td>

                    {/* Gotram (editable inline) */}
                    <td className="px-3 py-3 text-sm font-bold text-yellow-800 min-w-[120px]">
                      {editState?.id === vip.id ? (
                        <TeluguInput
                          value={editState?.gotram || ''}
                          onChange={(val) => setEditState(prev => prev ? { ...prev, gotram: val } : null)}
                          placeholder=""
                          required
                        />
                      ) : (
                        vip.gotram
                      )}
                    </td>

                    {/* Members (editable inline) */}
                    <td className="px-3 py-3 min-w-[160px]">
                      {editState?.id === vip.id ? (
                        <div className="space-y-1.5">
                           <TeluguInput
                             value={editState?.familyMembersStr || ''}
                             onChange={(val) => setEditState(prev => prev ? { ...prev, familyMembersStr: val } : null)}
                             placeholder="name1, name2, name3..."
                           />
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(vip.familyMembers || []).map((m: string, mi: number) => (
                            <span key={mi} className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-xs text-gray-700">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Source badge */}
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        vip.source === 'Chanda'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {vip.source ?? 'Manual'}
                      </span>
                    </td>

                    {/* Actions */}
                    {!isVolunteer && (
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {editState?.id === vip.id ? (
                            <>
                              <button
                                onClick={saveEdit}
                                disabled={editLoading}
                                title="Save"
                                className="p-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                              >
                                {editLoading
                                  ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white block" />
                                  : <CheckCircle size={14} />
                                }
                              </button>
                              <button
                                onClick={() => setEditState(null)}
                                title="Cancel"
                                className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(vip)}
                                title="Edit"
                                className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(vip.id)}
                                title="Delete"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                onClick={() => moveRow(idx, 'up')}
                                disabled={idx === 0}
                                title="Move Up"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => moveRow(idx, 'down')}
                                disabled={idx === vipGotrams.length - 1}
                                title="Move Down"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {!isLoading && vipGotrams.length === 0 && (
                  <tr>
                    <td colSpan={isVolunteer ? 4 : 5} className="px-6 py-16 text-center">
                      <Crown className="h-12 w-12 text-yellow-300 mx-auto mb-3" />
                      <p className="text-gray-400 font-medium">No VIP Gotrams recorded.</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Add manually or entries auto-appear from Chanda (≥ ₹1000).
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>


    </div>
  );
}
