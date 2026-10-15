function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

export function decodeBytes(hex: string): string | null {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!data || /^0+$/.test(data)) return null;
  try {
    if (data.length === 64) {
      const bytes = hexToBytes(data);
      const end = bytes.indexOf(0);
      const text = new TextDecoder().decode(end === -1 ? bytes : bytes.subarray(0, end)).trim();
      return text || null;
    }
    if (data.length < 128) return null;
    const offset = Number(BigInt(`0x${data.slice(0, 64)}`));
    const lengthStart = offset * 2;
    if (lengthStart + 64 > data.length) return null;
    const length = Number(BigInt(`0x${data.slice(lengthStart, lengthStart + 64)}`));
    if (!Number.isFinite(length) || length < 0 || length > 256) return null;
    const start = lengthStart + 64;
    const text = new TextDecoder().decode(hexToBytes(data.slice(start, start + length * 2))).replace(/\0/g, "").trim();
    return text || null;
  } catch {
    return null;
  }
}

export function decodeUint(hex: string): bigint | null {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!data || /^0*$/.test(data)) return 0n;
  try {
    return BigInt(`0x${data.slice(0, 64)}`);
  } catch {
    return null;
  }
}
