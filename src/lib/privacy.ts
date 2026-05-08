export const normalizePhoneDigits = (value?: string | null, maxLength = 10) =>
  (value || '').replace(/\D/g, '').slice(0, maxLength);

export const maskPhoneNumber = (value?: string | null) => {
  const digits = normalizePhoneDigits(value || '', 15);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  const visible = digits.slice(-4);
  return `${'X'.repeat(Math.max(digits.length - 4, 0))}${visible}`;
};

export const toIndianE164 = (value?: string | null) => {
  const digits = normalizePhoneDigits(value || '', 10);
  return digits.length === 10 ? `+91${digits}` : digits;
};

export const buildWhatsAppUrl = (phone: string | undefined | null, message: string) => {
  const digits = normalizePhoneDigits(phone || '', 10);
  const target = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
};
