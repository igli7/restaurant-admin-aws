import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);

const apiClient = new ApiGatewayManagementApiClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.CONNECTION_URL,
});

export async function handler(event: any) {
  // fetch all connections from dynamodb
  console.log('event', event.body);
  let connections;
  try {
    const response = await ddbDocClient.send(
      new ScanCommand({
        TableName: process.env.CONNECTION_TBL,
      }),
    );
    connections = response.Items;
  } catch (err) {
    console.log(`Failed scanning table ${process.env.CONNECTION_TBL}`);
    console.log(err);
    throw err;
  }

  // broadcast new orders to each connection
  for (let connection of connections!) {
    const response = await apiClient.send(
      new PostToConnectionCommand({
        Data: event.body,
        ConnectionId: connection.connectionId,
      }),
    );
    console.log(`postToConnection response ${JSON.stringify(response)}`);
  }
}
