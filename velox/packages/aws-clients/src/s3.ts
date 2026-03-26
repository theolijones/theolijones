import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const s3Client = client;

export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function putObject(params: PutObjectCommandInput) {
  return client.send(new PutObjectCommand(params));
}

export async function getObject(params: GetObjectCommandInput) {
  return client.send(new GetObjectCommand(params));
}

export async function deleteObject(bucket: string, key: string) {
  return client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function listObjects(bucket: string, prefix: string) {
  return client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );
}
