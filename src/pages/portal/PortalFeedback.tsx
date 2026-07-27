import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquareHeart, Star, Send } from 'lucide-react';
import { usePortalStore } from '../../store/portalStore';
import { supabase } from '../../lib/supabase';
import { createAdminNotification } from '../../lib/notifications';

export function PortalFeedback() {
  const { settings, questions, fetchQuestions } = usePortalStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
  });

  const [answers, setAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Name is required.');
      return;
    }
    
    // Check if rating is required based on questions? 
    // We'll just submit whatever is answered.
    
    setLoading(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        name: formData.name,
        message: formData.message || 'Feedback from QR Portal',
        rating: answers['rating'] || null, // fallback for legacy column
        answers: answers,
        status: 'Unread',
        created_at: Date.now()
      });

      if (error) throw error;
      
      createAdminNotification({
        actorName: formData.name || 'New feedback received from QR Portal',
        type: 'QR PORTAL · FEEDBACK',
        message: `${formData.name || 'New feedback received from QR Portal'} submitted new feedback.`
      }).catch(console.error);

      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Error submitting feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  if (!settings?.enable_feedback) return null;

  if (success) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquareHeart size={32} />
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">Thank You!</h2>
        <p className="text-gray-600 font-medium mb-6">Your feedback helps us improve and serve you better.</p>
        
        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 mb-8 inline-block text-left w-full max-w-sm">
            <p className="font-medium text-emerald-800 text-center" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
                "{settings.footer_quote || 'గణపతి బప్పా మోరయా!'}"
            </p>
        </div>

        <Link to="/portal" className="inline-block px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
            Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/portal" className="p-2 rounded-full hover:bg-orange-50 text-gray-500 hover:text-orange-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Feedback</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name *</label>
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                    placeholder="Your Full Name"
                />
            </div>
        </div>

        <div className="space-y-6 mt-8 pt-6 border-t border-gray-100">
            {questions.map((q) => (
                <div key={q.id} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <label className="block font-semibold text-gray-800 mb-3">{q.question}</label>
                    
                    {q.type === 'Rating' && (
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => handleAnswer(q.id, star)}
                                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                                >
                                    <Star 
                                        size={32} 
                                        className={answers[q.id] >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} 
                                    />
                                </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'Text' && (
                        <textarea
                            value={answers[q.id] || ''}
                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm resize-none"
                            placeholder="Type your answer here..."
                        />
                    )}

                    {q.type === 'Yes/No' && (
                        <div className="flex gap-4">
                            {['Yes', 'No'].map((opt) => (
                                <label key={opt} className={`flex items-center justify-center py-2 px-6 border-2 rounded-xl cursor-pointer transition-all ${answers[q.id] === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => handleAnswer(q.id, opt)} className="hidden" />
                                    <span className="font-bold text-sm">{opt}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            
            {questions.length === 0 && (
                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <label className="block font-semibold text-gray-800 mb-2">Message</label>
                    <textarea
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        rows={4}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm resize-none"
                        placeholder="Write your feedback here..."
                    />
                </div>
            )}
        </div>

        <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-lg text-white font-bold text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-70 mt-8"
        >
            {loading ? <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" /> : (
                <> <Send size={22} /> Submit Feedback </>
            )}
        </button>
      </form>
    </div>
  );
}
