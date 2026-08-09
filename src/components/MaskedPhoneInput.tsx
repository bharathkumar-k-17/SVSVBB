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
  const digits = normalizePhoneDigits(value, 10);

  const pushDigits = (next: string) => {
    onChange(normalizePhoneDigits(next, 10));
  };

  const getDisplayValue = (raw: string) => {
    if (!raw) return '';
    if (raw.length <= 4) return raw;
    const numXs = raw.length - 4;
    return 'X'.repeat(numXs) + raw.slice(numXs);
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
      if (digits.length < 10) {
        pushDigits(`${digits}${key}`);
      }
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
      maxLength={10}
      autoComplete="off"
      value={getDisplayValue(digits)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={(event) => {
        const nativeEvent = event.nativeEvent as InputEvent;
        const inputType = nativeEvent.inputType;
        const data = nativeEvent.data;

        if (inputType === 'insertText' && data) {
          const newDigits = data.replace(/\D/g, '');
          if (newDigits && digits.length < 10) {
            pushDigits(digits + newDigits);
          }
        } else if (inputType === 'deleteContentBackward') {
          pushDigits(digits.slice(0, -1));
        } else {
          // Fallback for autofill or pasted content that bypasses handlePaste
          const val = event.target.value;
          if (!val.includes('X')) {
            pushDigits(val);
          } else if (val.length > getDisplayValue(digits).length) {
            const diff = val.length - getDisplayValue(digits).length;
            const added = val.slice(-diff).replace(/\D/g, '');
            if (added && digits.length < 10) {
              pushDigits(digits + added);
            }
          }
        }
      }}
      className={className}
      placeholder=""
    />
  );
}
