#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { WebsocketApiStack } from '../lib/websocket-api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new WebsocketApiStack(app, 'websocket-order-api', {
  env,
  stackName: 'websocket-order-api',
  stageName: 'v1',
});
