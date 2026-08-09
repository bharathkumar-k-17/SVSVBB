export const normalizePhoneDigits = (value?: string | null, maxLength?: number) => {
  const digits = (value || '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};

export const maskPhoneNumber = (value?: string | null) => {
  const digits = normalizePhoneDigits(value, 15);
  if (!digits) return '';
  const visible = digits.slice(-4);
  return `XXXXXX${visible}`;
};

export const getWhatsAppNumber = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  
  if (!digits) return '';

  const last10 = digits.slice(-10);
  
  if (last10.length === 10) {
    return `91${last10}`;
  }
  
  return '';
};
