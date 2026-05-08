import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Badge, Button, Input, Modal } from './ui';
import { APP_NAME, buildUpiLink, formatCurrency } from '../lib/utils';

interface UpiPaymentModalProps {
  open: boolean;
  amount: number;
  upiId: string;
  onClose: () => void;
  onConfirm: (transactionId: string) => Promise<void> | void;
}

export const UpiPaymentModal = ({ open, amount, upiId, onClose, onConfirm }: UpiPaymentModalProps) => {
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const upiUrl = useMemo(
    () =>
      buildUpiLink({
        upiId,
        appName: APP_NAME,
        amount,
      }),
    [amount, upiId],
  );

  const handleConfirm = async () => {
    if (!transactionId.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(transactionId.trim());
      setTransactionId('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="UPI Payment"
      description="Generate a QR dynamically from the current UPI ID and save the transfer as pending until approval."
      onClose={() => {
        setTransactionId('');
        onClose();
      }}
    >
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4">
          <QRCodeSVG value={upiUrl} size={180} className="mx-auto rounded-2xl bg-white p-3" />
          <p className="mt-4 text-center text-xs text-stone-500">No uploaded QR image is used here. This QR is generated live.</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-orange-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="vip">Pending Approval</Badge>
              <span className="text-sm text-stone-500">Admin approval will convert the payment status from pending to success.</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm text-stone-700">
              <div className="flex items-center justify-between gap-4">
                <dt>UPI ID</dt>
                <dd className="font-semibold">{upiId || 'Configure in settings'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Amount</dt>
                <dd className="font-semibold">{formatCurrency(amount)}</dd>
              </div>
            </dl>
          </div>

          <Input label="Transaction ID" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="" />

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleConfirm} disabled={!upiId || !transactionId.trim() || submitting}>
              {submitting ? 'Saving...' : 'I Paid'}
            </Button>
            <Button type="button" tone="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
