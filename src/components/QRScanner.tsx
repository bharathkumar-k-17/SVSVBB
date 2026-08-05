import { useEffect, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { X, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // We add a slight delay to ensure the DOM element is fully mounted
    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'reader',
        {
          qrbox: { width: 250, height: 250 },
          fps: 10,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
        },
        false
      );

      const onScanSuccess = (decodedText: string) => {
        scanner.clear();
        try {
          const url = new URL(decodedText);
          const validDomains = ['svsvbb.vercel.app', window.location.hostname];
          
          if (!validDomains.some(d => url.hostname.includes(d)) && !url.hostname.includes('localhost')) {
             throw new Error('Invalid Domain');
          }
          
          // Extract the path (e.g. /portal/receipt/123)
          const path = url.pathname + url.search + url.hash;
          onClose();
          navigate(path);
        } catch (err) {
          toast.error("Invalid QR Code. Please scan a valid SVSVBB QR Code.", { duration: 4000 });
          setError("Invalid QR Code. Please scan a valid SVSVBB QR Code.");
          // Restart scanner after a short delay so they can try again
          setTimeout(() => {
            setError('');
            scanner.render(onScanSuccess, onScanFailure);
          }, 3000);
        }
      };

      const onScanFailure = (error: string) => {
        // Ignored, happens every frame it doesn't find a QR
      };

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(console.error);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [navigate, onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <QrCode size={20} />
            </div>
            <h3 className="font-bold text-gray-800">Scan QR Code</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 relative">
           {error && (
             <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[90%] z-50 bg-red-100 text-red-700 text-sm font-bold p-3 rounded-xl shadow-lg border border-red-200 text-center animate-in slide-in-from-top-2">
               {error}
             </div>
           )}
           <div id="reader" className="w-full bg-black rounded-2xl overflow-hidden shadow-inner border-4 border-gray-100"></div>
           <p className="text-center text-xs text-gray-500 font-medium mt-6 uppercase tracking-wider">
             Position the QR code within the frame
           </p>
        </div>
      </div>
    </div>
  );
}
