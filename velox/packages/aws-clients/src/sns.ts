import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const client = new SNSClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const snsClient = client;

export async function publishMessage(topicArn: string, message: string, subject?: string) {
  return client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      Subject: subject,
    })
  );
}
