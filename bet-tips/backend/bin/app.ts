#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { BetTipsStack } from "../lib/bet-tips-stack";

const app = new cdk.App();

new BetTipsStack(app, "BetTipsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-2",
  },
});
