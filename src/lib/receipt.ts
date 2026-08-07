export function getDynamicReceiptPrefix(): string {
  const currentYear = new Date().getFullYear();
  const yy = currentYear.toString().slice(-2);
  return `G${yy}-`;
}

export function generateReceiptNo(counter: number): string {
  const prefix = getDynamicReceiptPrefix();
  return `${prefix}${counter.toString().padStart(3, '0')}`;
}
