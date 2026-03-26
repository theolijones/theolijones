import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const cognitoClient = client;

export async function getUser(userPoolId: string, username: string) {
  return client.send(
    new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    })
  );
}

export async function listUsers(userPoolId: string, limit = 25) {
  return client.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: limit,
    })
  );
}
