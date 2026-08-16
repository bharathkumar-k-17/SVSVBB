import { Link } from 'react-router-dom';
import { usePortalStore } from '../../store/portalStore';
import { HeartHandshake, Download, CalendarDays, MessageSquareHeart, ChevronRight } from 'lucide-react';

export function PortalHome() {
  const { settings } = usePortalStore();

  if (!settings) return null;

  const services = [
    {
      id: 'enable_chanda', // assuming this maps to the setting in DB
      to: '/portal/qr-chanda',
      title: 'QR Chanda Registration',
      desc: 'Submit Chanda payment via QR',
      icon: HeartHandshake,
      color: 'from-orange-500 to-red-500',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    {
      id: 'enable_receipt',
      to: '/portal/receipt',
      title: 'Receipt Download',
      desc: 'Download your donation receipt',
      icon: Download,
      color: 'from-blue-500 to-cyan-500',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      id: 'enable_pooja',
      to: '/portal/pooja',
      title: 'Book Pooja',
      desc: 'Reserve a slot for family pooja',
      icon: CalendarDays,
      color: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    {
      id: 'enable_feedback',
      to: '/portal/feedback',
      title: 'Feedback',
      desc: 'Share your valuable experience',
      icon: MessageSquareHeart,
      color: 'from-emerald-500 to-teal-500',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    }
  ];

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Banner & Welcome */}
      <div className="text-center space-y-4 pt-2">
        {settings.banner_image_url && (
          <div className="w-full h-40 rounded-2xl overflow-hidden shadow-lg border-2 border-white mb-4">
            <img src={settings.banner_image_url} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}
        <h2 className="text-2xl font-black text-gray-800">
          {settings.portal_name}
        </h2>
        {settings.welcome_message && (
          <p className="text-gray-600 font-medium leading-relaxed px-4">
            {settings.welcome_message}
          </p>
        )}
      </div>

      <div className="w-12 h-1 bg-orange-400 mx-auto rounded-full" />

      {/* Services Grid */}
      <div className="grid grid-cols-1 gap-4 mt-6">
        {services.map((svc) => {
          if (!settings[svc.id as keyof typeof settings]) return null;

          return (
            <Link
              key={svc.to}
              to={svc.to}
              className="group relative bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm hover:shadow-xl hover:bg-white transition-all duration-300 flex items-center gap-4 overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${svc.color} opacity-5 rounded-bl-full group-hover:opacity-10 transition-opacity`} />

              <div className={`flex-shrink-0 w-14 h-14 ${svc.iconBg} ${svc.iconColor} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                <svc.icon size={28} />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-colors">
                  {svc.title}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{svc.desc}</p>
              </div>

              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                <ChevronRight size={18} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
