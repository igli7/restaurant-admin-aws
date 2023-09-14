import {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const cognito = new CognitoIdentityServiceProvider();

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  console.log(`event = ${JSON.stringify(event)}`);
  console.log(`context = ${JSON.stringify(context)}`);
  console.log(`process.env = ${JSON.stringify(process.env)}`);

  const accessToken =
    event.queryStringParameters?.accessToken || event.headers?.Authorization;

  if (!accessToken) {
    return {
      statusCode: 401,
      body: 'Unauthorized',
    };
  }

  let restaurantId: string | undefined;

  try {
    // Validate the access token with Cognito
    const user = await cognito.getUser({ AccessToken: accessToken }).promise();

    // Extract the restaurant_id from the user's attributes
    const restaurantIdAttribute = user.UserAttributes?.find(
      (attr) => attr.Name === 'custom:restaurant_id',
    );
    restaurantId = restaurantIdAttribute?.Value;
  } catch (err) {
    console.log('Invalid access token:', err);
    return {
      statusCode: 401,
      body: 'Unauthorized',
    };
  }

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.CONNECTIONS_TBL,
        Item: {
          restaurantId: restaurantId,
          connectionId: event.requestContext.connectionId,
        },
      }),
    );
  } catch (err) {
    console.log(err);
    throw err;
  }

  return {
    statusCode: 200,
  };
}
