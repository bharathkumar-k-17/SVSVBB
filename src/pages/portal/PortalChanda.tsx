import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePortalStore } from '../../store/portalStore';
import { ChandaEntry } from '../ChandaEntry';

export function PortalChanda() {
  const { settings } = usePortalStore();

  if (!settings?.enable_chanda) return null;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/portal" className="p-2 rounded-full hover:bg-orange-50 text-gray-500 hover:text-orange-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Chanda Registration</h2>
      </div>

      <div className="portal-chanda-wrapper">
        <ChandaEntry isPortal={true} />
      </div>
    </div>
  );
}
