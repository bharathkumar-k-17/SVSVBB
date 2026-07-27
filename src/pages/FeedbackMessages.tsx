import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MessageSquareHeart, 
  Search, 
  Eye, 
  Trash2, 
  Download, 
  FileText,
  Star,
  Loader2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useFeedbackMessages } from '../hooks/queries';

interface Feedback {
  id: string;
  name: string;
  phone?: string;
  message: string;
  rating: number;
  answers: Record<string, any>;
  status: string;
  created_at: number;
}

export function FeedbackMessages() {
  const queryClient = useQueryClient();
  const { data: feedbacks = [], isLoading: loading } = useFeedbackMessages();
  const [search, setSearch] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    try {
      const { error } = await supabase.from('feedback').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['feedbackMessages'] });
      toast.success('Feedback deleted successfully');
      if (selectedFeedback?.id === id) setSelectedFeedback(null);
    } catch (err) {
      toast.error('Failed to delete feedback');
    }
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Date', 'Rating', 'Message'];
    const rows = feedbacks.map(f => [
      `"${f.name || ''}"`,
      `"${format(f.created_at, 'dd MMM yyyy, HH:mm')}"`,
      f.rating || 'N/A',
      `"${f.message?.replace(/"/g, '""') || ''}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Feedback_Messages_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const downloadPDF = () => {
    // Generate a simple printable view and print it as PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Cannot generate PDF.');
      return;
    }

    let html = `
      <html>
        <head>
          <title>Feedback Messages</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>Feedback Messages - ${format(new Date(), 'dd MMM yyyy')}</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Rating</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
    `;

    feedbacks.forEach(f => {
      html += `
        <tr>
          <td>${format(f.created_at, 'dd MMM yyyy')}</td>
          <td>${f.name}</td>
          <td>${f.rating || '-'}</td>
          <td>${f.message || '-'}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredFeedbacks = feedbacks.filter(f => 
    f.name?.toLowerCase().includes(search.toLowerCase()) || 
    f.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <MessageSquareHeart className="text-emerald-500" size={32} />
            Feedback Messages
          </h1>
          <p className="text-gray-500 font-medium mt-1">Review and manage portal feedback</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={downloadCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-700 font-bold hover:bg-gray-50 transition-colors"
          >
            <FileText size={18} /> CSV
          </button>
          <button 
            onClick={downloadPDF}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm text-emerald-700 font-bold hover:bg-emerald-100 transition-colors"
          >
            <Download size={18} /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Message Preview</th>
                <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No feedback messages found.
                  </td>
                </tr>
              ) : (
                filteredFeedbacks.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                      {format(item.created_at, 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.rating ? (
                        <div className="flex text-yellow-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={14} className={i < item.rating ? 'fill-current' : 'text-gray-200'} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 truncate max-w-[300px]">
                        {item.message || <span className="italic text-gray-400">No message</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedFeedback(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for viewing feedback */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setSelectedFeedback(null)}>
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <MessageSquareHeart className="text-emerald-500" />
                Feedback Details
              </h3>
              <button onClick={() => setSelectedFeedback(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">From</p>
                  <p className="text-xl font-black text-gray-900">{selectedFeedback.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-bold text-gray-600">{format(selectedFeedback.created_at, 'dd MMM yyyy, HH:mm')}</p>
                </div>
              </div>

              {selectedFeedback.rating && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Rating</p>
                  <div className="flex text-yellow-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={20} className={i < selectedFeedback.rating ? 'fill-current' : 'text-gray-200'} />
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(selectedFeedback.answers || {}).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Survey Answers</p>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                    {Object.entries(selectedFeedback.answers).map(([qId, ans]) => (
                      <div key={qId}>
                        <span className="text-xs text-gray-500 font-medium block">Question ID: {qId}</span>
                        <span className="text-sm font-bold text-gray-800">{String(ans)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message</p>
                <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedFeedback.message || <span className="italic text-gray-500">No message provided.</span>}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button 
                onClick={() => handleDelete(selectedFeedback.id)}
                className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors"
              >
                Delete
              </button>
              <button 
                onClick={() => setSelectedFeedback(null)}
                className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
