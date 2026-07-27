export const normalizePhoneDigits = (value?: string | null, maxLength?: number) => {
  const digits = (value || '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};

export const maskPhoneNumber = (value?: string | null) => {
  const digits = normalizePhoneDigits(value, 15);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  const visible = digits.slice(-4);
  return `${'X'.repeat(Math.max(digits.length - 4, 0))}${visible}`;
};

export const getWhatsAppNumber = (phone?: string | null): string => {
  const digits = (phone || '').replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  
  // Return empty string if invalid length
  return '';
};

export const buildWhatsAppUrl = (phone: string | undefined | null, message: string) => {
  const target = getWhatsAppNumber(phone);
  if (!target) return '';
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
};
