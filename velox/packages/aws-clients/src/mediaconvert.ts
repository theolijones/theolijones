import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  type CreateJobCommandInput,
} from '@aws-sdk/client-mediaconvert';

const client = new MediaConvertClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  endpoint: process.env.MEDIACONVERT_ENDPOINT,
});

export const mediaConvertClient = client;

export async function createTranscodeJob(params: CreateJobCommandInput) {
  return client.send(new CreateJobCommand(params));
}

export async function getTranscodeJob(jobId: string) {
  return client.send(new GetJobCommand({ Id: jobId }));
}
