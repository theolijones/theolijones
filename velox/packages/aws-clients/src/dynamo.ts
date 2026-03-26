import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  type GetCommandInput,
  type PutCommandInput,
  type UpdateCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export async function getItem(params: GetCommandInput) {
  return dynamoDb.send(new GetCommand(params));
}

export async function putItem(params: PutCommandInput) {
  return dynamoDb.send(new PutCommand(params));
}

export async function updateItem(params: UpdateCommandInput) {
  return dynamoDb.send(new UpdateCommand(params));
}

export async function deleteItem(params: DeleteCommandInput) {
  return dynamoDb.send(new DeleteCommand(params));
}

export async function queryItems(params: QueryCommandInput) {
  return dynamoDb.send(new QueryCommand(params));
}

export async function scanItems(params: ScanCommandInput) {
  return dynamoDb.send(new ScanCommand(params));
}
