import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  type StartTranscriptionJobCommandInput,
} from '@aws-sdk/client-transcribe';

const client = new TranscribeClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const transcribeClient = client;

export async function startTranscriptionJob(params: StartTranscriptionJobCommandInput) {
  return client.send(new StartTranscriptionJobCommand(params));
}

export async function getTranscriptionJob(jobName: string) {
  return client.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
}
