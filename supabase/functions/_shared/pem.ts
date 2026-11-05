const derLength = (length: number) => {
  if (length < 128) return [length];
  const bytes = [];
  while (length > 0) { bytes.unshift(length & 255); length >>>= 8; }
  return [0x80 | bytes.length, ...bytes];
};

// GitHub downloads PKCS#1 RSA keys; WebCrypto imports PKCS#8 private keys.
export const pkcs1ToPkcs8 = (pkcs1: Uint8Array) => {
  const algorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const content = [0x02, 0x01, 0x00, ...algorithm, ...octet];
  return new Uint8Array([0x30, ...derLength(content.length), ...content]);
};
