import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Receipt } from '../../components/Receipt';
import { usePortalStore } from '../../store/portalStore';
import { normalizePhoneDigits } from '../../lib/privacy';

export function PortalReceipt() {
  const { settings } = usePortalStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [receiptNo, setReceiptNo] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receiptData, setReceiptData] = useState<any>(null);

  useEffect(() => {
    const fetchById = async () => {
      if (!id) return;
      
      setLoading(true);
      setError('');
      
      try {
        const { data, error: rpcError } = await supabase.rpc('lookup_receipt_by_id', {
          receipt_id: id
        });

        if (rpcError) throw rpcError;
        
        if (!data || Object.keys(data).length === 0 || !data.receipt_no) {
          setError('Receipt Not Found or invalid link.');
        } else {
          setReceiptData({
            receiptNo: data.receipt_no,
            name: data.name,
            phone: data.phone_masked,
            totalAmount: data.total_amount,
            paidAmount: data.paid_amount,
            pendingAmount: data.total_amount - data.paid_amount,
            paymentStatus: data.payment_status,
            donationItem: data.donation_item,
            createdAt: data.created_at,
            year: settings?.festival_year || new Date().getFullYear(),
          });
        }
      } catch (err: any) {
        console.error(err);
        setError('Error loading receipt. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchById();
  }, [id, settings]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptNo.trim() || !phone.trim()) {
      setError('Please enter both Receipt Number and Phone Number.');
      return;
    }

    setLoading(true);
    setError('');
    setReceiptData(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('lookup_receipt', {
        receipt_no: receiptNo.trim().toUpperCase(),
        phone_number: normalizePhoneDigits(phone)
      });

      if (rpcError) throw rpcError;
      
      if (!data || Object.keys(data).length === 0 || !data.receipt_no) {
        setError('Receipt Not Found. Please check the details and try again.');
      } else {
        // Map snake_case to camelCase for the Receipt component
        setReceiptData({
          receiptNo: data.receipt_no,
          name: data.name,
          phone: data.phone_masked,
          totalAmount: data.total_amount,
          paidAmount: data.paid_amount,
          pendingAmount: data.total_amount - data.paid_amount,
          paymentStatus: data.payment_status,
          donationItem: data.donation_item,
          createdAt: data.created_at,
          year: settings?.festival_year || new Date().getFullYear(),
        });
      }
    } catch (err: any) {
      console.error(err);
      setError('Error searching for receipt. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (!settings?.enable_receipt) return null;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/portal" className="p-2 rounded-full hover:bg-orange-50 text-gray-500 hover:text-orange-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Download Receipt</h2>
      </div>

      {!receiptData ? (
        <form onSubmit={handleSearch} className="space-y-6">
          <p className="text-sm text-gray-600 font-medium text-center">
            Enter your receipt number and registered phone number to download your receipt.
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Receipt Number</label>
            <input
              type="text"
              required
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value.toUpperCase())}
              placeholder="e.g. G240915001"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm font-mono tracking-wider"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
              maxLength={10}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100 text-center animate-in fade-in zoom-in-95">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-lg text-white font-bold text-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-70"
          >
            {loading ? <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" /> : (
              <> <Search size={22} /> Search Receipt </>
            )}
          </button>
        </form>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 text-lg">Your Receipt</h3>
            <button
              onClick={() => { 
                if (id) {
                  navigate('/portal/receipt');
                } else {
                  setReceiptData(null); 
                  setReceiptNo(''); 
                  setPhone(''); 
                }
              }}
              className="text-sm font-bold text-blue-600 hover:text-blue-800"
            >
              Search Another
            </button>
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="min-w-[800px] scale-75 origin-top-left md:scale-100">
                <Receipt data={receiptData} currentYear={settings?.festival_year} isBlank={false} isPortal={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
