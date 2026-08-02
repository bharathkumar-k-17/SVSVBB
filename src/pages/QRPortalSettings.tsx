import { useEffect, useState } from 'react';
import { usePortalStore } from '../store/portalStore';
import { QRCodeSVG } from 'qrcode.react';
import { Save, Plus, Trash2, Edit2, Check, X, QrCode, Download, Link as LinkIcon, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { FeedbackQuestionType, FeedbackQuestion } from '../types';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSettings, useFeedbackQuestions } from '../hooks/queries';
import { useGlobalLogo } from '../hooks/useGlobalLogo';

export function QRPortalSettings() {
  const queryClient = useQueryClient();
  const logoSrc = useGlobalLogo();
  const { data: settings, isLoading: isSettingsLoading } = usePortalSettings();
  const { data: questions = [], isLoading: isQuestionsLoading } = useFeedbackQuestions();
  const isLoading = isSettingsLoading || isQuestionsLoading;
  
  const { updateSettings, addQuestion, updateQuestion, deleteQuestion } = usePortalStore();

  const [activeTab, setActiveTab] = useState<'general' | 'services' | 'feedback' | 'qr'>('general');

  // Form state for settings
  const [formData, setFormData] = useState<any>({});
  
  // Form state for new question
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<FeedbackQuestion>>({ type: 'Rating', options: [], is_active: true });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionData, setEditingQuestionData] = useState<Partial<FeedbackQuestion>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    await updateSettings(formData);
    queryClient.invalidateQueries({ queryKey: ['portalSettings'] });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleToggle = (name: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question) {
      toast.error('Question text is required');
      return;
    }
    const success = await addQuestion({
      question: newQuestion.question,
      type: newQuestion.type as FeedbackQuestionType,
      options: newQuestion.options || [],
      order: questions.length + 1,
      is_active: newQuestion.is_active ?? true,
    });
    if (success) {
      setIsAddingQuestion(false);
      setNewQuestion({ type: 'Rating', options: [], is_active: true });
      queryClient.invalidateQueries({ queryKey: ['feedbackQuestions'] });
    }
  };

  const handleSaveEditQuestion = async () => {
    if (editingQuestionId && editingQuestionData) {
      const success = await updateQuestion(editingQuestionId, editingQuestionData);
      if (success) {
        setEditingQuestionId(null);
        setEditingQuestionData({});
        queryClient.invalidateQueries({ queryKey: ['feedbackQuestions'] });
      }
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      const success = await deleteQuestion(id);
      if (success) {
         queryClient.invalidateQueries({ queryKey: ['feedbackQuestions'] });
      }
    }
  };

  const portalUrl = `${window.location.origin}/portal`;

  const downloadQR = () => {
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "svsvbb-portal-qr.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } else {
        // Fallback since QRCodeSVG renders an SVG, not canvas.
        // We can draw it to a canvas.
        const svg = document.getElementById("qr-svg");
        if(svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                const pngFile = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = "svsvbb-portal-qr.png";
                downloadLink.href = `${pngFile}`;
                downloadLink.click();
            };
            img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
        }
    }
  };

  if (isLoading && !settings) return <div className="p-8 flex justify-center items-center"><RefreshCw className="animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-orange-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <QrCode className="text-orange-500" /> Public QR Portal Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">Configure the public facing portal for devotees.</p>
        </div>
        <div className="flex gap-3">
            <a href={portalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-xl font-medium hover:bg-orange-200 transition-colors">
                <ExternalLink size={18} /> Preview Portal
            </a>
            <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
            >
            <Save size={18} /> Save Changes
            </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {[
          { id: 'general', label: 'General Info' },
          { id: 'services', label: 'Services Toggles' },
          { id: 'feedback', label: 'Feedback Questions' },
          { id: 'qr', label: 'QR Code' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100">
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-800 border-b pb-2">Basic Info</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portal Name</label>
                <input type="text" name="portal_name" value={formData.portal_name || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Committee Name</label>
                <input type="text" name="committee_name" value={formData.committee_name || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                <textarea name="welcome_message" value={formData.welcome_message || ''} onChange={handleChange} rows={2} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Footer Quote</label>
                <input type="text" name="footer_quote" value={formData.footer_quote || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temple Image URL</label>
                <input type="text" name="temple_image_url" value={formData.temple_image_url || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image URL</label>
                <input type="text" name="banner_image_url" value={formData.banner_image_url || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-800 border-b pb-2">Contact & Social</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="text" name="phone_number" value={formData.phone_number || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input type="text" name="whatsapp_number" value={formData.whatsapp_number || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps URL</label>
                <input type="text" name="google_maps_url" value={formData.google_maps_url || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL</label>
                <input type="text" name="youtube_url" value={formData.youtube_url || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-6 max-w-lg">
            <h3 className="font-bold text-lg text-gray-800 border-b pb-2">Enable / Disable Public Services</h3>
            <p className="text-sm text-gray-500">Toggle these switches to immediately show or hide services on the public QR portal.</p>
            
            {[
              { id: 'enable_chanda', label: 'Chanda Registration', desc: 'Allow devotees to register chanda and pay via UPI.' },
              { id: 'enable_receipt', label: 'Receipt Download', desc: 'Allow devotees to search and download their receipts.' },
              { id: 'enable_pooja', label: 'Pooja Booking', desc: 'Allow devotees to book available pooja slots.' },
              { id: 'enable_feedback', label: 'Feedback', desc: 'Allow devotees to submit feedback.' }
            ].map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="font-semibold text-gray-800">{service.label}</p>
                  <p className="text-xs text-gray-500">{service.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(service.id)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData[service.id] ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData[service.id] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-gray-800">Dynamic Feedback Questions</h3>
              <button onClick={() => setIsAddingQuestion(!isAddingQuestion)} className="flex items-center gap-1 text-sm bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-medium hover:bg-orange-200">
                <Plus size={16} /> Add Question
              </button>
            </div>

            {isAddingQuestion && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-4">
                <h4 className="font-bold text-sm text-orange-800">New Question</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Question Text</label>
                    <input type="text" value={newQuestion.question || ''} onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})} className="w-full border-gray-300 rounded-lg p-2 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select value={newQuestion.type} onChange={(e) => setNewQuestion({...newQuestion, type: e.target.value as any})} className="w-full border-gray-300 rounded-lg p-2 outline-none">
                      <option value="Rating">Rating (1-5 Stars)</option>
                      <option value="Text">Text (Paragraph)</option>
                      <option value="Yes/No">Yes / No</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsAddingQuestion(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={handleAddQuestion} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600">Save Question</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  {editingQuestionId === q.id ? (
                    <div className="flex-1 flex items-center gap-4">
                      <input type="text" value={editingQuestionData.question || ''} onChange={(e) => setEditingQuestionData({...editingQuestionData, question: e.target.value})} className="flex-1 border-gray-300 rounded p-1 outline-none border" />
                      <select value={editingQuestionData.type} onChange={(e) => setEditingQuestionData({...editingQuestionData, type: e.target.value as any})} className="border-gray-300 rounded p-1 outline-none border">
                        <option value="Rating">Rating</option>
                        <option value="Text">Text</option>
                        <option value="Yes/No">Yes/No</option>
                      </select>
                      <button onClick={handleSaveEditQuestion} className="text-green-600 p-1 hover:bg-green-50 rounded"><Check size={18} /></button>
                      <button onClick={() => setEditingQuestionId(null)} className="text-gray-500 p-1 hover:bg-gray-50 rounded"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-semibold text-gray-800">{q.question}</p>
                        <p className="text-xs text-gray-500 mt-1">Type: <span className="font-medium bg-gray-100 px-2 py-0.5 rounded">{q.type}</span> | Active: {q.is_active ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingQuestionId(q.id); setEditingQuestionData(q); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => deleteQuestion(q.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {questions.length === 0 && <p className="text-center text-gray-500 py-8">No feedback questions added yet.</p>}
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            <h3 className="font-bold text-xl text-gray-800">Scan to Open Portal</h3>
            <div className="p-4 bg-white border-4 border-orange-100 rounded-2xl shadow-lg">
                <QRCodeSVG id="qr-svg" value={portalUrl} size={256} fgColor="#111827" bgColor="#ffffff" level="Q" imageSettings={{ src: logoSrc, x: undefined, y: undefined, height: 40, width: 40, excavate: true }} />
            </div>
            <p className="text-gray-500 text-sm font-medium break-all">{portalUrl}</p>
            <div className="flex gap-4">
              <button onClick={downloadQR} className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors">
                <Download size={18} /> Download Poster
              </button>
              <button onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Link copied!'); }} className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                <LinkIcon size={18} /> Copy Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
