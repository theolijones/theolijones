import {
  MediaPackageClient,
  CreateChannelCommand,
  CreateOriginEndpointCommand,
  DeleteChannelCommand,
  DeleteOriginEndpointCommand,
  DescribeChannelCommand,
  ListOriginEndpointsCommand,
  type CreateChannelCommandInput,
  type CreateOriginEndpointCommandInput,
} from '@aws-sdk/client-mediapackage';

const client = new MediaPackageClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const mediaPackageClient = client;

export async function createPackageChannel(params: CreateChannelCommandInput) {
  return client.send(new CreateChannelCommand(params));
}

export async function createOriginEndpoint(params: CreateOriginEndpointCommandInput) {
  return client.send(new CreateOriginEndpointCommand(params));
}

export async function describePackageChannel(channelId: string) {
  return client.send(new DescribeChannelCommand({ Id: channelId }));
}

export async function listOriginEndpoints(channelId: string) {
  return client.send(new ListOriginEndpointsCommand({ ChannelId: channelId }));
}

export async function deletePackageChannel(channelId: string) {
  return client.send(new DeleteChannelCommand({ Id: channelId }));
}

export async function deleteOriginEndpoint(endpointId: string) {
  return client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
}
