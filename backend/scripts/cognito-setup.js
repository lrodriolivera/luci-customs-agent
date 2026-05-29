/**
 * Cognito User Pool Setup Script
 * Creates the User Pool, App Clients, and configures all settings.
 * Run: node scripts/cognito-setup.js
 * Requires: AWS credentials with cognito-idp:* permissions
 */
const {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const REGION = 'eu-west-1';
const SES_REGION = 'us-east-1';
const AWS_ACCOUNT_ID = '367509577730';
const SES_SOURCE_ARN = `arn:aws:ses:${SES_REGION}:${AWS_ACCOUNT_ID}:identity/strixai.es`;
const FROM_EMAIL = 'noreply@strixai.es';
const POOL_NAME = 'luci-customs-pool';

const client = new CognitoIdentityProviderClient({ region: REGION });

async function createUserPool() {
  console.log('Creating Cognito User Pool...');

  const cmd = new CreateUserPoolCommand({
    PoolName: POOL_NAME,
    Policies: {
      PasswordPolicy: {
        MinimumLength: 8,
        RequireUppercase: true,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: true,
        TemporaryPasswordValidityDays: 7,
      },
    },
    AutoVerifiedAttributes: ['email'],
    UsernameAttributes: ['email'],
    UsernameConfiguration: { CaseSensitive: false },
    MfaConfiguration: 'OFF',
    EmailConfiguration: {
      SourceArn: SES_SOURCE_ARN,
      EmailSendingAccount: 'DEVELOPER',
      From: `LUCI <${FROM_EMAIL}>`,
    },
    VerificationMessageTemplate: {
      DefaultEmailOption: 'CONFIRM_WITH_CODE',
    },
    Schema: [
      { Name: 'email', AttributeDataType: 'String', Required: true, Mutable: true },
      { Name: 'given_name', AttributeDataType: 'String', Required: true, Mutable: true },
      { Name: 'family_name', AttributeDataType: 'String', Required: true, Mutable: true },
      {
        Name: 'apellido2',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true,
        StringAttributeConstraints: { MinLength: '0', MaxLength: '100' },
      },
      {
        Name: 'tenantId',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true,
        StringAttributeConstraints: { MinLength: '0', MaxLength: '50' },
      },
      {
        Name: 'role',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true,
        StringAttributeConstraints: { MinLength: '0', MaxLength: '20' },
      },
      {
        Name: 'companyName',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true,
        StringAttributeConstraints: { MinLength: '0', MaxLength: '200' },
      },
    ],
    AccountRecoverySetting: {
      RecoveryMechanisms: [
        { Priority: 1, Name: 'verified_email' },
      ],
    },
    AdminCreateUserConfig: {
      AllowAdminCreateUserOnly: false,
    },
    UserAttributeUpdateSettings: {
      AttributesRequireVerificationBeforeUpdate: ['email'],
    },
  });

  const response = await client.send(cmd);
  const poolId = response.UserPool.Id;
  console.log(`User Pool created: ${poolId}`);
  return poolId;
}

async function createAppClient(poolId, clientName) {
  console.log(`Creating App Client: ${clientName}...`);

  const cmd = new CreateUserPoolClientCommand({
    UserPoolId: poolId,
    ClientName: clientName,
    GenerateSecret: false,
    ExplicitAuthFlows: [
      'ALLOW_USER_SRP_AUTH',
      'ALLOW_USER_PASSWORD_AUTH',
      'ALLOW_REFRESH_TOKEN_AUTH',
    ],
    PreventUserExistenceErrors: 'ENABLED',
    AccessTokenValidity: 1,        // 1 hour
    IdTokenValidity: 1,            // 1 hour
    RefreshTokenValidity: 30,      // 30 days
    TokenValidityUnits: {
      AccessToken: 'hours',
      IdToken: 'hours',
      RefreshToken: 'days',
    },
    ReadAttributes: [
      'email', 'given_name', 'family_name', 'email_verified',
      'custom:apellido2', 'custom:tenantId', 'custom:role', 'custom:companyName',
    ],
    WriteAttributes: [
      'email', 'given_name', 'family_name',
      'custom:apellido2', 'custom:companyName',
    ],
  });

  const response = await client.send(cmd);
  const clientId = response.UserPoolClient.ClientId;
  console.log(`  Client ID: ${clientId}`);
  return clientId;
}

async function main() {
  try {
    const poolId = await createUserPool();
    const webClientId = await createAppClient(poolId, 'luci-web');
    const mobileClientId = await createAppClient(poolId, 'luci-mobile');

    console.log('\n========================================');
    console.log('COGNITO SETUP COMPLETE');
    console.log('========================================');
    console.log(`Region:           ${REGION}`);
    console.log(`User Pool ID:     ${poolId}`);
    console.log(`Web Client ID:    ${webClientId}`);
    console.log(`Mobile Client ID: ${mobileClientId}`);
    console.log('\nAdd to backend .env:');
    console.log(`  COGNITO_USER_POOL_ID=${poolId}`);
    console.log(`  COGNITO_CLIENT_ID=${webClientId}`);
    console.log(`  COGNITO_REGION=${REGION}`);
    console.log(`  AUTH_MODE=dual`);
    console.log('\nAdd to frontend .env.production:');
    console.log(`  VITE_COGNITO_USER_POOL_ID=${poolId}`);
    console.log(`  VITE_COGNITO_CLIENT_ID=${webClientId}`);
    console.log('\nNext steps:');
    console.log('  1. Deploy Lambda triggers (custom-message, post-confirmation, pre-token)');
    console.log('  2. Attach Lambda triggers to User Pool via AWS Console or CLI');
    console.log('  3. Generate REGISTER_SYNC_SECRET and set in Lambda + backend .env');
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

main();
