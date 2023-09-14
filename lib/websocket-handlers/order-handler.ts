import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DeleteItemCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

console.log(' process.env.AWS_REGION', process.env.AWS_REGION);

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);

const apiClient = new ApiGatewayManagementApiClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.CONNECTION_URL,
});

export async function handler(event: any) {
  console.log('event', event.body);

  // Assuming restaurant_id is in the event.body, extract it
  const body = JSON.parse(event.body);
  const restaurantId = body.restaurant_id;

  console.log('body', body);
  console.log('restaurantId', restaurantId);

  if (!restaurantId) {
    return { statusCode: 400, body: 'restaurant_id not provided' };
  }

  // Fetch connections associated with the given restaurantId from DynamoDB
  let connections;
  try {
    const response = await ddbDocClient.send(
      new QueryCommand({
        TableName: process.env.CONNECTION_TBL,
        KeyConditionExpression: 'restaurantId = :restaurantId',
        ExpressionAttributeValues: {
          ':restaurantId': restaurantId,
        },
      }),
    );
    connections = response.Items;
  } catch (err) {
    console.log(`Failed querying table ${process.env.CONNECTION_TBL}`);
    console.log(err);
    throw err;
  }

  console.log('connections', connections);

  console.log('apiClient', apiClient);

  // Broadcast the message to the fetched connections
  for (let connection of connections!) {
    try {
      const response = await apiClient.send(
        new PostToConnectionCommand({
          Data: event.body,
          ConnectionId: connection.connectionId,
        }),
      );

      console.log(`postToConnection response ${JSON.stringify(response)}`);
    } catch (error) {
      if (error.$metadata && error.$metadata.httpStatusCode === 410) {
        console.error(
          `Connection ${connection.connectionId} is stale. Removing from database.`,
        );
        // Logic to remove the connection from DynamoDB goes here.
        try {
          const deleteCommand = new DeleteItemCommand({
            TableName: process.env.CONNECTION_TBL,
            Key: {
              restaurantId: {
                S: restaurantId,
              },
              connectionId: {
                S: connection.connectionId,
              },
            },
          });

          await ddbDocClient.send(deleteCommand);
          console.log(
            `Successfully deleted connection ${connection.connectionId} from DynamoDB.`,
          );
        } catch (error) {
          console.error(
            `Failed to delete connection ${connection.connectionId} from DynamoDB:`,
            error,
          );
        }
      } else {
        console.error(
          `Failed to send message to connection ${connection.connectionId}:`,
          error,
        );
      }
    }
  }

  return { statusCode: 200, body: 'Data sent to Admin front-end.' };
}
