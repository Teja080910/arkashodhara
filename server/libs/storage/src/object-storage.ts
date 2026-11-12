import { Client } from 'minio';

export interface StorageOptions {
  endpoint: string;
  presignEndpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
  publicBaseUrl?: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
  publicUrl?: string;
  expiresAt: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export class ObjectStorage {
  readonly bucket: string;
  private readonly client: Client;
  private readonly presignClient: Client;
  private readonly publicBaseUrl?: string;
  private readonly ttl: number;

  constructor(private readonly options: StorageOptions) {
    this.client = buildClient(options.endpoint, options);
    this.presignClient = options.presignEndpoint
      ? buildClient(options.presignEndpoint, options)
      : this.client;
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl;
    this.ttl = options.signedUrlTtlSeconds;
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) await this.client.makeBucket(this.bucket, this.options.region);
  }

  async presignUpload(objectKey: string, contentType?: string, ttlSeconds?: number): Promise<PresignedUpload> {
    const ttl = ttlSeconds ?? this.ttl;
    const uploadUrl = await this.presignClient.presignedPutObject(this.bucket, objectKey, ttl);
    return {
      uploadUrl,
      objectKey,
      publicUrl: this.publicBaseUrl ? this.publicUrl(objectKey) : undefined,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      method: 'PUT',
      headers: contentType ? { 'Content-Type': contentType } : {},
    };
  }

  async presignDownload(objectKey: string, ttlSeconds?: number): Promise<string> {
    return this.presignClient.presignedGetObject(this.bucket, objectKey, ttlSeconds ?? this.ttl);
  }

  publicUrl(objectKey: string): string | undefined {
    if (!this.publicBaseUrl) return undefined;
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  async statObject(objectKey: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const stat = await this.client.statObject(this.bucket, objectKey);
      return { size: stat.size, contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  async listObjects(prefix: string): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    return new Promise((resolve, reject) => {
      const results: Array<{ key: string; size: number; lastModified: Date }> = [];
      const stream = this.client.listObjectsV2(this.bucket, prefix, true);
      stream.on('data', (item) => {
        if (!item.name) return;
        results.push({ key: item.name, size: item.size, lastModified: item.lastModified ?? new Date() });
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(results));
    });
  }
}

function buildClient(endpoint: string, options: StorageOptions): Client {
  const url = new URL(endpoint);
  return new Client({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    useSSL: url.protocol === 'https:',
    accessKey: options.accessKey,
    secretKey: options.secretKey,
    region: options.region,
    pathStyle: options.forcePathStyle,
  });
}

export function objectKeyFor(ownerId: string, fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-120);
  const stamp = Date.now().toString(36);
  return `${ownerId}/${stamp}-${safe || 'file'}`;
}
