import { Aws, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  NodejsFunction,
  NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

import * as path from 'path';

import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { WebsocketApi } from './websocket-api';

export interface WebsocketApiStackProps extends StackProps {
  readonly stageName: string;
}

export class WebsocketApiStack extends Stack {
  readonly websocketApiUrl: string;

  constructor(scope: Construct, id: string, props: WebsocketApiStackProps) {
    super(scope, id, props);

    const connectionsTbl = new Table(this, 'ConnectionsTbl', {
      partitionKey: { name: 'connectionId', type: AttributeType.STRING },
      readCapacity: 2,
      writeCapacity: 1,
      timeToLiveAttribute: 'ttl',
    });

    const commonFnProps: NodejsFunctionProps = {
      bundling: { minify: true, sourceMap: true, target: 'es2019' },
      handler: 'handler',
      logRetention: RetentionDays.THREE_DAYS,
    };

    const connectFn = new NodejsFunction(this, 'ConnectFn', {
      ...commonFnProps,
      entry: path.resolve(__dirname, 'websocket-handlers', 'connect.ts'),
      environment: {
        CONNECTIONS_TBL: connectionsTbl.tableName,
      },
    });

    const disconnectFn = new NodejsFunction(this, 'DisconnectFn', {
      ...commonFnProps,
      entry: path.resolve(__dirname, 'websocket-handlers', 'disconnect.ts'),
      environment: {
        CONNECTIONS_TBL: connectionsTbl.tableName,
      },
    });

    const websocketApi = new WebsocketApi(this, 'OrderWebsocketApi', {
      apiName: 'order-api',
      apiDescription: 'Web Socket API for incoming orders',
      stageName: props.stageName,
      connectFn,
      disconnectFn,
      connectionsTbl,
    });

    const CONNECTION_URL = `https://${websocketApi.api.ref}.execute-api.${Aws.REGION}.amazonaws.com/${props.stageName}`;

    const orderHandlerFn = new NodejsFunction(this, 'orderHandlerFn', {
      ...commonFnProps,
      entry: path.resolve(__dirname, 'websocket-handlers', 'order-handler.ts'),
      environment: {
        CONNECTION_TBL: connectionsTbl.tableName,
        CONNECTION_URL: CONNECTION_URL,
      },
    });

    orderHandlerFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApi.api.ref}/*`,
        ],
      }),
    );

    // Expose the Lambda function via API Gateway
    const orderHandlerApi = new LambdaRestApi(this, 'OrderHandlerAPI', {
      handler: orderHandlerFn,
    });

    connectionsTbl.grantReadData(orderHandlerFn);

    new CfnOutput(this, 'WebsocketConnectionUrl', { value: CONNECTION_URL });

    this.websocketApiUrl = `${websocketApi.api.attrApiEndpoint}/${props.stageName}`;
    new CfnOutput(this, 'websocketUrl', {
      value: this.websocketApiUrl,
    });

    new CfnOutput(this, 'orderHandlerApi', {
      value: orderHandlerApi.url,
    });
  }
}
