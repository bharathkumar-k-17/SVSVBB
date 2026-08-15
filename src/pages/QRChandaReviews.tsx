import { useState } from 'react';
import { usePendingQRChandaRequests, useQRChandaHistory } from '../hooks/queries';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Check, X, Eye, Phone, MessageCircle, AlertCircle, Clock } from 'lucide-react';

export function QRChandaReviews() {
  const { appUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');

  const { data: pendingRequests, isLoading: isLoadingPending, refetch: refetchPending } = usePendingQRChandaRequests();
  const { data: historyRequests, isLoading: isLoadingHistory, refetch: refetchHistory } = useQRChandaHistory();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);

  const handleViewProof = async (path: string) => {
    try {
      // 1. We must use createSignedUrl because payment-proofs is a private bucket
      const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 60); // 1 hour expiry

      if (error) throw error;

      if (data?.signedUrl) {
        setProofUrl(data.signedUrl);
        setShowProofModal(true);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load payment proof');
    }
  };

  const processRequest = async (id: string, action: 'ACCEPT' | 'REJECT', reason?: string) => {
    if (!appUser) return;
    setProcessingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('review-qr-chanda', {
        body: {
          request_id: id,
          action,
          rejection_reason: reason,
          reviewer_id: appUser.id || appUser.email, // Edge function uses reviewer_id
          reviewer_name: appUser.name,
          reviewer_phone: appUser.phone
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      alert(`Request ${action.toLowerCase()}ed successfully!`);
      setShowRejectModal(null);
      setRejectReason('');
      refetchPending();
      refetchHistory();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to process: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const renderPendingCard = (req: any) => (
    <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-lg text-gray-900">{req.name}</h3>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            {req.payment_mode}
          </span>
        </div>
        <div className="text-sm text-gray-600 mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-gray-400" />
            <span className="font-mono">{req.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <span>{new Date(req.created_at).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-black text-gray-900">₹{req.paid_amount}</span>
          {req.pending_amount > 0 && <span className="text-sm text-red-500 font-medium">(Pending: ₹{req.pending_amount})</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full md:w-auto">
        {req.payment_mode === 'UPI' && req.payment_proof_path && (
          <button
            onClick={() => handleViewProof(req.payment_proof_path)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors font-semibold"
          >
            <Eye size={16} /> View Proof
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={processingId === req.id}
            onClick={() => processRequest(req.id, 'ACCEPT')}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors font-bold disabled:opacity-50"
          >
            {processingId === req.id ? '...' : <><Check size={18} /> Accept</>}
          </button>
          <button
            disabled={processingId === req.id}
            onClick={() => setShowRejectModal(req.id)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors font-bold disabled:opacity-50"
          >
            <X size={18} /> Reject
          </button>
        </div>

        {/* WhatsApp & Call */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`tel:${req.phone}`}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
          >
            <Phone size={14} /> Call
          </a>
          <a
            href={`https://wa.me/91${req.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366]/20 transition-colors font-semibold"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );

  const renderHistoryCard = (req: any) => (
    <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-lg text-gray-900">{req.name}</h3>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${req.status === 'ACCEPTED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {req.status}
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div><span className="font-semibold">Amount:</span> ₹{req.paid_amount} ({req.payment_mode})</div>
          {req.reference_number && <div><span className="font-semibold">Receipt No:</span> {req.reference_number}</div>}
          <div><span className="font-semibold">Reviewed By:</span> {req.reviewed_by_name}</div>
          <div><span className="font-semibold">Reviewed At:</span> {new Date(req.reviewed_at).toLocaleString()}</div>
          {req.status === 'REJECTED' && req.rejection_reason && (
            <div className="text-red-600"><span className="font-semibold">Reason:</span> {req.rejection_reason}</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <Check className="text-blue-500" size={32} />
          QR Chanda Reviews
        </h1>
        <p className="text-gray-500 mt-2">Review and approve Chanda entries submitted through the public QR portal.</p>
      </div>

      <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1 mb-6 inline-flex">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'PENDING' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          Pending Review {(pendingRequests?.length || 0) > 0 && `(${pendingRequests?.length})`}
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          Review History
        </button>
      </div>

      {activeTab === 'PENDING' && (
        <div className="space-y-4">
          {isLoadingPending ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : pendingRequests?.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <Check size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900">All Caught Up!</h3>
              <p className="text-gray-500 mt-2">There are no pending Chanda requests to review.</p>
            </div>
          ) : (
            pendingRequests?.map(renderPendingCard)
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
          ) : historyRequests?.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No review history found.</div>
          ) : (
            historyRequests?.map(renderHistoryCard)
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Request</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejecting this payment. The user will not be added to the Devotees list.</p>
            <textarea
              className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none mb-4"
              rows={3}
              placeholder="E.g., Payment not received in bank..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => processRequest(showRejectModal, 'REJECT', rejectReason)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Modal */}
      {showProofModal && proofUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 flex-col">
          <button
            onClick={() => setShowProofModal(false)}
            className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/40 text-white"
          >
            <X size={24} />
          </button>
          <img src={proofUrl} alt="Payment Proof" className="max-w-full max-h-[80vh] rounded-xl object-contain mb-4" />
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-white text-gray-900 rounded-full font-bold hover:bg-gray-100"
          >
            Open in New Tab
          </a>
        </div>
      )}
    </div>
  );
}
