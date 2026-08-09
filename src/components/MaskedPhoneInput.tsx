import type { ClipboardEvent, KeyboardEvent } from 'react';
import { normalizePhoneDigits } from '../lib/privacy';

type MaskedPhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
};

export function MaskedPhoneInput({
  value,
  onChange,
  className,
  required,
  id,
  name,
  disabled,
}: MaskedPhoneInputProps) {
  const digits = normalizePhoneDigits(value);

  const pushDigits = (next: string) => {
    onChange(normalizePhoneDigits(next));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const { key, ctrlKey, metaKey } = event;

    if (ctrlKey || metaKey || ['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
      return;
    }

    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      pushDigits(digits.slice(0, -1));
      return;
    }

    if (/^\d$/.test(key)) {
      event.preventDefault();
      pushDigits(`${digits}${key}`);
      return;
    }

    event.preventDefault();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    pushDigits(event.clipboardData.getData('text'));
  };

  return (
    <input
      id={id}
      name={name}
      type="tel"
      required={required}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      value={digits}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={(event) => pushDigits(event.target.value)}
      className={className}
      placeholder=""
    />
  );
}
