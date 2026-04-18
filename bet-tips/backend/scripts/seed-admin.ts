import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const tableName = process.env.USERS_TABLE;

if (!email || !password || !tableName) {
  console.error("Set ADMIN_EMAIL, ADMIN_PASSWORD, and USERS_TABLE env vars.");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const run = async (): Promise<void> => {
  const now = new Date().toISOString();
  const user = {
    userId: randomUUID(),
    role: "admin" as const,
    email: email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: user }));
  console.log(`Created admin user ${user.email} (${user.userId}).`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
