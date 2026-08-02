import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { usePortalStore } from '../../store/portalStore';
import { MapPin, Phone, MessageCircle, RefreshCw } from 'lucide-react';
import { useGlobalLogo } from '../../hooks/useGlobalLogo';

export function PortalLayout() {
  const { settings, isLoading, fetchSettings } = usePortalStore();
  const logoSrc = useGlobalLogo();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <RefreshCw className="animate-spin text-orange-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex flex-col font-sans relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-orange-100 px-4 py-4 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full border-2 border-orange-200 p-1 mb-2 shadow-sm bg-white overflow-hidden">
            {settings.temple_image_url ? (
                <img src={settings.temple_image_url} alt="Temple" className="w-full h-full object-cover rounded-full" />
            ) : (
                <img src={logoSrc} alt="SVBB Logo" className="w-full h-full object-cover rounded-full" />
            )}
        </div>
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-500">
          {settings.committee_name}
        </h1>
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mt-1">Since 2008</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white/90 backdrop-blur-md border-t border-orange-100 pt-8 pb-10 px-6 text-center z-10 mt-auto">
        <p className="font-bold text-orange-600 text-lg mb-4" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
          {settings.footer_quote || 'గణపతి బప్పా మోరయా!'}
        </p>
        
        <div className="flex flex-col items-center gap-3 text-sm text-gray-600 mb-6">
          {settings.address && (
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-orange-500" />
              <span>{settings.address}</span>
            </div>
          )}
          <div className="flex gap-4">
            {settings.phone_number && (
              <a href={`tel:${settings.phone_number}`} className="flex items-center gap-1.5 text-gray-700 hover:text-orange-600">
                <Phone size={14} className="text-orange-500" /> Call
              </a>
            )}
            {settings.whatsapp_number && (
              <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-700 hover:text-green-600">
                <MessageCircle size={14} className="text-green-500" /> WhatsApp
              </a>
            )}
          </div>
          {settings.google_maps_url && (
            <a href={settings.google_maps_url} target="_blank" rel="noreferrer" className="mt-2 inline-block px-4 py-1.5 bg-orange-100 text-orange-700 font-medium rounded-full hover:bg-orange-200 transition">
              Open in Google Maps
            </a>
          )}
        </div>

        <div className="w-16 h-1 bg-gradient-to-r from-transparent via-orange-300 to-transparent mx-auto mb-4" />
        
        <p className="text-xs text-gray-400 font-medium">&copy; {new Date().getFullYear()} {settings.committee_name}. All rights reserved.</p>
        <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mt-1">Powered by SVSVBB</p>
      </footer>
    </div>
  );
}
