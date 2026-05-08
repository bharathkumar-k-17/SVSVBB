import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Edit2, Loader2, Keyboard, X } from 'lucide-react';

interface TeluguInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function TeluguInput({ value, onChange, label, placeholder, required }: TeluguInputProps) {
  const [mode, setMode] = useState<'type' | 'voice'>('type');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [livePreview, setLivePreview] = useState('');
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'idle' | 'ok' | 'fallback'>('idle');
  const recognitionRef = useRef<any>(null);
  const rawTextRef = useRef('');

  useEffect(() => {
    // Check for web speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'te-IN'; // Telugu (India)

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          const newRaw = (rawTextRef.current + ' ' + finalTranscript).trim();
          setRawText(newRaw);
          rawTextRef.current = newRaw;
        }
        setLivePreview(interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setLivePreview('');
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert("Voice input requires a secure connection (HTTPS). Please ensure you are using a secure site.");
      } else {
        alert("Voice input is not supported in this browser or permission was denied.");
      }
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setMode('voice');
      // Clear raw text before new session
      setRawText('');
      rawTextRef.current = '';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const translateToTelugu = async (text: string) => {
    if (!text) return '';
    try {
      const words = text.split(' ');
      const transliteratedWords = await Promise.all(words.map(async (word) => {
        if (/^[a-zA-Z]+$/.test(word)) {
          const rs = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=te-t-i0-und&num=1`);
          const data = await rs.json();
          if (data[0] === 'SUCCESS' && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
            return data[1][0][1][0];
          }
        }
        return word;
      }));
      return transliteratedWords.join(' ');
    } catch (e) {
      return text;
    }
  };

  // ── Debounced Real-time backend flow ──
  useEffect(() => {
    if (!rawText.trim()) {
      setLivePreview('');
      return;
    }

    const isInternal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    const timer = setTimeout(async () => {
      // If we are on a mobile device and trying to hit localhost, it's likely going to fail.
      // We skip the AI check if we know it's unreachable, going straight to fallback.
      if (!isInternal && window.location.hostname.match(/\d+\.\d+\.\d+\.\d+/)) {
         const fb = await translateToTelugu(rawText);
         setLivePreview(fb);
         return;
      }

      setIsProcessingPreview(true);
      try {
        const res = await fetch('http://localhost:3001/api/telugu-correct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText })
        });
        const data = await res.json();
        
        if (data && data.correctedText) {
          setLivePreview(data.correctedText);
        } else {
          // Fallback
          const fb = await translateToTelugu(rawText);
          setLivePreview(fb);
        }
      } catch (err) {
        console.error("Backend real-time fetch error", err);
        // Fallback
        const fb = await translateToTelugu(rawText);
        setLivePreview(fb);
      } finally {
        setIsProcessingPreview(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [rawText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawText(val);
    rawTextRef.current = val;
  };

  const processAiCorrection = async () => {
    const textToProcess = rawText;
    if (!textToProcess.trim()) return;

    setIsProcessing(true);
    setBackendStatus('idle');
    try {
      const isInternal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      // If accessed via IP on mobile, localhost will definitely fail. Fallback immediately.
      if (!isInternal && window.location.hostname.match(/\d+\.\d+\.\d+\.\d+/)) {
         throw new Error('Skipping localhost check on non-local origin');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // reduced to 3s timeout
      const res = await fetch('http://localhost:3001/api/telugu-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      const correctedText = data.correctedText?.trim();
      if (correctedText) {
        onChange(correctedText);
        setBackendStatus('ok');
        setRawText('');
        setLivePreview('');
        rawTextRef.current = '';
      } else {
        throw new Error('Empty backend response');
      }
    } catch (error) {
      // Silent fallback — no alert popup
      console.warn('Backend unavailable, using transliteration fallback:', error);
      setBackendStatus('fallback');
      const fallback = await translateToTelugu(textToProcess);
      onChange(fallback || textToProcess);
      setRawText('');
      setLivePreview('');
      rawTextRef.current = '';
    } finally {
      setIsProcessing(false);
      // Clear status after 3 seconds
      setTimeout(() => setBackendStatus('idle'), 3000);
    }
  };

  return (
    <div className="w-full space-y-2">
      {label && <label className="block text-sm font-semibold text-gray-700">{label}</label>}
      
      {/* If final value exists, show it normally, with an option to edit */}
      {value ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)} // Manual direct editing mode
            className="w-full px-4 py-2 bg-green-50/50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 transition-all font-bold text-gray-900 outline-none"
            required={required}
          />
          <button 
            type="button" 
            onClick={() => {
              setRawText(value);
              rawTextRef.current = value;
              setLivePreview(value);
              onChange('');
            }}
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-primary hover:bg-orange-50 transition-colors"
            title="Edit via AI Processor"
          >
            <Edit2 size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => {
              setRawText('');
              rawTextRef.current = '';
              setLivePreview('');
              onChange('');
            }}
            className="p-2 border border-red-200 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
            title="Clear Field"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3 border-2 border-primary/20 bg-orange-50/30 rounded-xl relative focus-within:border-primary/50 transition-colors">
          
          <div className="flex justify-between items-center mb-3">
             <div className="flex bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden text-xs sm:text-sm">
                <button 
                  type="button" 
                  onClick={() => { setMode('type'); if(isListening) toggleVoice(); }}
                  className={`px-4 py-2 flex items-center gap-2 ${mode === 'type' ? 'bg-primary text-white font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Keyboard size={16} /> Type
                </button>
                <button 
                  type="button" 
                  onClick={() => setMode('voice')}
                  className={`px-4 py-2 flex items-center gap-2 ${mode === 'voice' ? 'bg-primary text-white font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Mic size={16} /> Voice
                </button>
             </div>
             
             {mode === 'voice' && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />} 
                  {isListening ? 'Stop Mic' : 'Start Mic'}
                </button>
             )}
          </div>

          <div className="relative">
            {mode === 'type' ? (
               <input
                 type="text"
                 value={rawText}
                 onChange={handleInputChange}
                 autoFocus={!isListening}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      processAiCorrection();
                    }
                 }}
                 placeholder={placeholder || 'Type in English (e.g. chikondala)'}
                 className="w-full px-4 py-3 bg-white border border-transparent rounded-xl focus:outline-none text-base text-gray-800 shadow-inner"
               />
            ) : (
               <div 
                 onClick={toggleVoice}
                 className="w-full px-4 py-3 bg-white rounded-xl border border-transparent min-h-[50px] text-base text-gray-800 flex items-center cursor-pointer shadow-inner"
               >
                 {rawText || <span className="text-gray-400 italic">Tap "Start Mic" and speak...</span>}
               </div>
            )}
          </div>

          {backendStatus === 'fallback' && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
              <span>⚡</span> Using transliteration — AI server offline
            </div>
          )}
          {backendStatus === 'ok' && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
              <span>✅</span> AI corrected successfully
            </div>
          )}

          {(livePreview || rawText) && (
            <div className="mt-4 bg-white rounded-xl p-3 border border-orange-200 shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase font-black text-orange-500 tracking-widest mb-1 flex items-center gap-2">
                  <span>✨ PREVIEW</span>
                  {isProcessingPreview && <Loader2 size={12} className="animate-spin text-primary" />}
                </p>
                <p className="text-base font-bold text-gray-900 break-words leading-tight">{livePreview || rawText}</p>
              </div>
              <button
                type="button"
                onClick={processAiCorrection}
                disabled={isProcessing || isProcessingPreview || (!livePreview.trim() && !rawText.trim())}
                className="shrink-0 flex items-center justify-center gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black py-3 px-5 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 text-sm"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Confirm
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
