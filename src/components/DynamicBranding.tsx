import { useEffect } from 'react';
import { useGlobalLogo } from '../hooks/useGlobalLogo';

export function DynamicBranding() {
  const logoSrc = useGlobalLogo();

  useEffect(() => {
    if (!logoSrc) return;

    // 1. Update Favicon & Apple Touch Icon
    const updateIcon = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    };

    updateIcon('icon', logoSrc);
    updateIcon('apple-touch-icon', logoSrc);
    updateIcon('shortcut icon', logoSrc);

    // 2. Generate Dynamic Manifest
    const generateManifest = async () => {
      const manifest = {
        name: 'SVSVBB Ganesh Festival',
        short_name: 'SVSVBB',
        description: 'Private Ganesh Festival Management System',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: logoSrc,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: logoSrc,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      };

      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], { type: 'application/manifest+json' });
      const manifestURL = URL.createObjectURL(blob);

      let manifestLink = document.querySelector(`link[rel="manifest"]`);
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.setAttribute('rel', 'manifest');
        document.head.appendChild(manifestLink);
      }
      manifestLink.setAttribute('href', manifestURL);
      
      // Cache the logo in service worker cache for offline PWA functionality
      if ('caches' in window) {
        try {
          const cache = await caches.open('supabase-data-cache');
          await cache.add(logoSrc);
        } catch (e) {
          console.warn('Failed to cache logo:', e);
        }
      }
    };

    generateManifest();

  }, [logoSrc]);

  return null;
}
