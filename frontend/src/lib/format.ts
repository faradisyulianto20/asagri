export function formatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.startsWith("62")) {
    const rest = digits.slice(2);
    const groups = [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)].filter(Boolean);
    return `+62 ${groups.join("-")}`;
  }
  return `+${digits}`;
}
