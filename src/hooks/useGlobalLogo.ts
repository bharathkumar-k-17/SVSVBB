import { useAppSettings } from './queries';

export const useGlobalLogo = () => {
  const { data } = useAppSettings();
  return data?.logo_url || '/logo.jpg';
};
