import { getWhatsAppNumber } from './privacy';
import { format } from 'date-fns';
import { hydrateTemplate, DEFAULT_CHANDA_CONFIRMATION } from './templates';

export const shareReceiptWhatsApp = (devotee: any, receiptUrl: string, template?: string) => {
  const targetPhone = getWhatsAppNumber(devotee.phone);
  if (!targetPhone) {
    alert("Invalid or missing phone number for WhatsApp sharing.");
    return;
  }

  const dateValue = devotee.date || devotee.createdAt;
  const formattedDate = dateValue ? format(new Date(dateValue), 'dd MMM yyyy') : new Date().toLocaleDateString('en-IN');
  const amount = devotee.totalAmount || devotee.paidAmount || 0;

  const payload = {
    name: devotee.name || '',
    receiptNo: devotee.receiptNo || '',
    date: formattedDate,
    amount: amount,
    receiptLink: receiptUrl,
    festivalYear: new Date().getFullYear().toString(),
  };

  const text = hydrateTemplate(DEFAULT_CHANDA_CONFIRMATION, payload);

  let encodedText = encodeURIComponent(text);
  if (receiptUrl) {
    encodedText = encodedText.replace(encodeURIComponent(receiptUrl), receiptUrl);
  }

  const waLink = `https://wa.me/${targetPhone}?text=${encodedText}`;
  window.open(waLink, '_blank');
};

export const openWhatsAppChat = (phone: string | undefined | null, message: string) => {
  const targetPhone = getWhatsAppNumber(phone);
  if (!targetPhone) {
    alert("Invalid or missing phone number for WhatsApp.");
    return;
  }
  const waLink = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
  window.open(waLink, '_blank');
};
