import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

export class CryptoService {
  private keyCache: Buffer | null = null;

  constructor(private readonly secret: string) {
    if (!secret || secret.length < 16) throw new Error('APP_SECRET missing or too short');
  }

  private key(): Buffer {
    if (!this.keyCache) this.keyCache = scryptSync(this.secret, 'env-manager.v1', 32);
    return this.keyCache;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
  }

  decrypt(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Unsupported encrypted value format');
    const iv = Buffer.from(parts[1]!, 'base64url');
    const tag = Buffer.from(parts[2]!, 'base64url');
    const data = Buffer.from(parts[3]!, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newApiToken(): string {
  return `em_${randomBytes(24).toString('base64url')}`;
}
