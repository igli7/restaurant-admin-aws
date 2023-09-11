import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class AuthenticationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the Cognito User Pool with custom attribute restaurant_id
    const userPool = new cognito.UserPool(this, 'RestaurantAdminPool', {
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      customAttributes: {
        restaurant_id: new cognito.StringAttribute({ mutable: true }),
        restaurant_name: new cognito.StringAttribute({ mutable: true }),
      },
    });

    // Define the Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(
      this,
      'RestaurantAdminClient',
      {
        userPool,
        generateSecret: false,
      },
    );
  }
}
