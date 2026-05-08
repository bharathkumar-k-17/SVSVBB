import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-96 animate-in slide-in-from-bottom-5">
      <div className="bg-white/90 backdrop-blur-xl border border-orange-200 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-xl object-cover shadow-sm" />
          <div>
            <p className="font-bold text-gray-900 text-sm">Install App</p>
            <p className="text-xs text-gray-500 font-medium">Add to Home Screen</p>
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200 text-sm font-bold px-5 py-2 rounded-xl hover:scale-105 transition-transform"
        >
          Install
        </button>
      </div>
    </div>
  );
}
