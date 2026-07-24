const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const createUuidV7 = (now = Date.now()): string => {
  const timestamp = now.toString(16).padStart(12, "0");
  const random = randomBytes(10);
  const randomHex = toHex(random);

  return [
    timestamp.slice(0, 8),
    timestamp.slice(8, 12),
    "7" + randomHex.slice(0, 3),
    (8 + (random[2] & 0x03)).toString(16) + randomHex.slice(4, 7),
    randomHex.slice(7)
  ].join("-");
};
