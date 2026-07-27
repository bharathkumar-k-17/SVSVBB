import jsPDF from 'jspdf';
import type {
  AppUser,
  Devotee,
  DevoteeCollectionStatus,
  DevoteeSummary,
  FestivalSettings,
  Payment,
  VipEntry,
  VipListRow,
} from '../types';

export const APP_NAME = 'Sree Vara Sidhi Vinayaka Baktha Bhrundam';

export const toRoleLabel = (role: AppUser['role']) => {
  if (role === 'superadmin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  return 'Volunteer';
};

export const nowIso = () => new Date().toISOString();

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: undefined,
  }).format(new Date(value));
};

export const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const parseMembers = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');

export const transliterationMap: Array<[RegExp, string]> = [
  [/ksha/g, 'క్ష'],
  [/shra/g, 'శ్ర'],
  [/aa/g, 'ఆ'],
  [/ee/g, 'ఈ'],
  [/oo/g, 'ఊ'],
  [/ai/g, 'ఐ'],
  [/au/g, 'ఔ'],
  [/a/g, 'అ'],
  [/i/g, 'ఇ'],
  [/u/g, 'ఉ'],
  [/e/g, 'ఎ'],
  [/o/g, 'ఒ'],
  [/ka/g, 'క'],
  [/kha/g, 'ఖ'],
  [/ga/g, 'గ'],
  [/gha/g, 'ఘ'],
  [/cha/g, 'చ'],
  [/ja/g, 'జ'],
  [/ta/g, 'ట'],
  [/tha/g, 'త'],
  [/da/g, 'ద'],
  [/dha/g, 'ధ'],
  [/na/g, 'న'],
  [/pa/g, 'ప'],
  [/pha/g, 'ఫ'],
  [/ba/g, 'బ'],
  [/bha/g, 'భ'],
  [/ma/g, 'మ'],
  [/ya/g, 'య'],
  [/ra/g, 'ర'],
  [/la/g, 'ల'],
  [/va/g, 'వ'],
  [/sa/g, 'స'],
  [/sha/g, 'శ'],
  [/ha/g, 'హ'],
  [/ganesha/g, 'గణేశ'],
  [/vinayaka/g, 'వినాయక'],
  [/lakshmi/g, 'లక్ష్మి'],
  [/shiva|siva/g, 'శివ'],
  [/rama/g, 'రామ'],
];

export const transliterateToTelugu = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  let output = normalized;
  transliterationMap.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
};

export const normalizeText = (value?: string) =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export const buildUpiLink = ({
  upiId,
  appName,
  amount,
}: {
  upiId: string;
  appName: string;
  amount: number;
}) => `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(appName)}&am=${amount}&cu=INR`;

export const getDevoteeSummary = (
  devotee: Devotee,
  payments: Payment[],
): DevoteeSummary => {
  const paidAmount = payments
    .filter((payment) => payment.devoteeId === devotee.id && payment.status === 'success')
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);

  const pendingAmount = Math.max(Number(devotee.totalAmount || 0) - paidAmount, 0);

  let status: DevoteeCollectionStatus = 'Unpaid';
  if (paidAmount >= devotee.totalAmount && devotee.totalAmount > 0) {
    status = 'Paid';
  } else if (paidAmount > 0) {
    status = 'Partial';
  }

  return {
    ...devotee,
    paidAmount,
    pendingAmount,
    status,
    isVip: Number(devotee.totalAmount || 0) >= 1000,
  };
};

export const getDashboardStats = (devotees: Devotee[], payments: Payment[]) => {
  const summaries = devotees.map((devotee) => getDevoteeSummary(devotee, payments));
  const totalCollection = payments
    .filter((payment) => payment.status === 'success')
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const pendingAmount = summaries.reduce((total, devotee) => total + devotee.pendingAmount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayCollection = payments
    .filter((payment) => payment.status === 'success' && payment.date.slice(0, 10) === today)
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);

  return {
    totalDevotees: devotees.length,
    totalCollection,
    pendingAmount,
    todayCollection,
  };
};

export const getVolunteerCollectionStats = (devotees: Devotee[], payments: Payment[]) => {
  const today = new Date().toISOString().slice(0, 10);
  const summaryMap = new Map<string, { volunteerId: string; volunteerName: string; devotees: number; totalCollection: number; todayCollection: number }>();

  devotees.forEach((devotee) => {
    const current = summaryMap.get(devotee.addedBy) || {
      volunteerId: devotee.addedBy,
      volunteerName: devotee.addedByName,
      devotees: 0,
      totalCollection: 0,
      todayCollection: 0,
    };

    current.devotees += 1;

    payments
      .filter((payment) => payment.devoteeId === devotee.id && payment.status === 'success')
      .forEach((payment) => {
        current.totalCollection += payment.amount;
        if (payment.date.slice(0, 10) === today) {
          current.todayCollection += payment.amount;
        }
      });

    summaryMap.set(devotee.addedBy, current);
  });

  return [...summaryMap.values()].sort((a, b) => b.totalCollection - a.totalCollection);
};

export const getMergedVipRows = (
  manualEntries: VipEntry[],
  devotees: Devotee[],
  payments: Payment[],
): VipListRow[] => {
  const manualRows = [...manualEntries]
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      id: entry.id,
      gotram: entry.gotram,
      members: entry.members,
      source: entry.source,
      order: entry.order,
      devoteeId: entry.devoteeId,
    }));

  const autoRows = devotees
    .map((devotee) => getDevoteeSummary(devotee, payments))
    .filter((devotee) => devotee.isVip && devotee.gotram)
    .map((devotee, index) => ({
      id: `auto-${devotee.id}`,
      gotram: devotee.gotram?.trim() || 'N/A',
      members: parseMembers(devotee.familyMembers || ''),
      source: 'Chanda' as const,
      order: manualRows.length + index + 1,
      devoteeId: devotee.id,
    }));

  const deduped = [...manualRows, ...autoRows].filter((row, index, rows) => {
    const key = `${normalizeText(row.gotram)}|${normalizeText(row.members)}`;
    return rows.findIndex((item) => `${normalizeText(item.gotram)}|${normalizeText(item.members)}` === key) === index;
  });

  return deduped.map((row, index) => ({ ...row, order: index + 1 }));
};

export const getDefaultFestivalSettings = (): FestivalSettings => ({
  id: 'festival',
  appName: APP_NAME,
  festivalYear: new Date().getFullYear(),
  upiId: '',
  logoUrl: '',
  updatedAt: nowIso(),
});

export const buildReceiptText = ({
  devoteeName,
  phone,
  totalAmount,
  paidAmount,
  paymentMode,
  status,
  receiptNo,
  donation,
}: {
  devoteeName: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  paymentMode: string;
  status: string;
  receiptNo: string;
  donation?: string;
}) =>
  [
    APP_NAME,
    `Receipt No: ${receiptNo}`,
    `Devotee: ${devoteeName}`,
    `Phone: ${phone}`,
    `Total Amount: ${formatCurrency(totalAmount)}`,
    `Paid Amount: ${formatCurrency(paidAmount)}`,
    `Donation: ${donation || '-'}`,
    `Payment Mode: ${paymentMode}`,
    `Status: ${status}`,
    `Generated On: ${formatDateTime(nowIso())}`,
  ].join('\n');

export const createReceiptPdfBlob = ({
  receiptNo,
  devoteeName,
  phone,
  totalAmount,
  paidAmount,
  paymentMode,
  status,
  donation,
}: {
  receiptNo: string;
  devoteeName: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  paymentMode: string;
  status: string;
  donation?: string;
}) => {
  const doc = new jsPDF();
  const lines = [
    APP_NAME,
    '',
    `Receipt No: ${receiptNo}`,
    `Devotee Name: ${devoteeName}`,
    `Phone: ${phone}`,
    `Total Amount: ${formatCurrency(totalAmount)}`,
    `Paid Amount: ${formatCurrency(paidAmount)}`,
    `Donation: ${donation || '-'}`,
    `Payment Mode: ${paymentMode}`,
    `Status: ${status}`,
    `Generated On: ${formatDateTime(nowIso())}`,
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(APP_NAME, 20, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(lines.slice(2), 20, 40);

  return doc.output('blob');
};

export const downloadPdfBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const openWhatsappShare = (text: string) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
};

export const openSmsShare = (phone: string, text: string) => {
  window.open(`sms:${phone}?body=${encodeURIComponent(text)}`, '_self');
};

export const csvEscape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const printHtml = (title: string, html: string) => {
  const popup = window.open('', '_blank', 'width=1200,height=900');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Georgia, 'Times New Roman', serif; padding: 24px; color: #111827; }
          h1 { margin: 0 0 16px; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #111; padding: 8px 10px; text-align: left; font-size: 14px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
};

export const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
