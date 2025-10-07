export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(amount);
}

export function shortCode(): string {
  // Generate 8-10 character base36 code
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return (timestamp + random).toUpperCase();
}

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function cn(
  ...classes: (string | undefined | null | boolean)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function isValidImageType(type: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(type);
}

export function isValidReceiptType(type: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
    type,
  );
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
