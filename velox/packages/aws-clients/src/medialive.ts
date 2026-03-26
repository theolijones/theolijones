import {
  MediaLiveClient,
  CreateChannelCommand,
  CreateInputCommand,
  DeleteChannelCommand,
  DeleteInputCommand,
  DescribeChannelCommand,
  StartChannelCommand,
  StopChannelCommand,
  type CreateChannelCommandInput,
  type CreateInputCommandInput,
} from '@aws-sdk/client-medialive';

const client = new MediaLiveClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const mediaLiveClient = client;

export async function createChannel(params: CreateChannelCommandInput) {
  return client.send(new CreateChannelCommand(params));
}

export async function createInput(params: CreateInputCommandInput) {
  return client.send(new CreateInputCommand(params));
}

export async function describeChannel(channelId: string) {
  return client.send(new DescribeChannelCommand({ ChannelId: channelId }));
}

export async function startChannel(channelId: string) {
  return client.send(new StartChannelCommand({ ChannelId: channelId }));
}

export async function stopChannel(channelId: string) {
  return client.send(new StopChannelCommand({ ChannelId: channelId }));
}

export async function deleteChannel(channelId: string) {
  return client.send(new DeleteChannelCommand({ ChannelId: channelId }));
}

export async function deleteInput(inputId: string) {
  return client.send(new DeleteInputCommand({ InputId: inputId }));
}
