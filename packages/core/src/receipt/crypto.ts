import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';

export type Ed25519KeyMaterial = {
  privateKeyPkcs8: string;
  publicKeySpki: string;
};

export function generateEd25519KeyMaterial(): Ed25519KeyMaterial {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPkcs8: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    publicKeySpki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

export function publicKeyFingerprintFromSpki(spkiBase64: string): string {
  const der = Buffer.from(spkiBase64, 'base64');
  return `sha256:${createHash('sha256').update(der).digest('hex')}`;
}

export function signCanonicalPayload(canonicalUtf8: string, privateKeyPkcs8Base64: string): string {
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyPkcs8Base64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = sign(null, Buffer.from(canonicalUtf8, 'utf8'), privateKey);
  return signature.toString('base64');
}

export function verifyCanonicalPayload(
  canonicalUtf8: string,
  signatureBase64: string,
  publicKeySpkiBase64: string,
): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeySpkiBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return verify(
      null,
      Buffer.from(canonicalUtf8, 'utf8'),
      publicKey,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}

export function exportPublicKeyPem(spkiBase64: string): string {
  const publicKey = createPublicKey({
    key: Buffer.from(spkiBase64, 'base64'),
    format: 'der',
    type: 'spki',
  });
  return publicKey.export({ format: 'pem', type: 'spki' }).toString();
}
