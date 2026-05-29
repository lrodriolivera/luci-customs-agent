const { CognitoJwtVerifier } = require('aws-jwt-verify');
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  ChangePasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const REGION = process.env.COGNITO_REGION || 'eu-west-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

let accessTokenVerifier = null;
let idTokenVerifier = null;
let cognitoClient = null;

function getVerifier() {
  if (!accessTokenVerifier) {
    accessTokenVerifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      clientId: CLIENT_ID,
      tokenUse: 'access',
    });
  }
  return accessTokenVerifier;
}

function getIdVerifier() {
  if (!idTokenVerifier) {
    idTokenVerifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      clientId: CLIENT_ID,
      tokenUse: 'id',
    });
  }
  return idTokenVerifier;
}

function getClient() {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
  }
  return cognitoClient;
}

async function verifyAccessToken(token) {
  return getVerifier().verify(token);
}

async function verifyIdToken(token) {
  return getIdVerifier().verify(token);
}

async function adminGetUser(username) {
  const cmd = new AdminGetUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });
  return getClient().send(cmd);
}

async function adminUpdateAttributes(username, attributes) {
  const userAttributes = Object.entries(attributes).map(([Name, Value]) => ({
    Name,
    Value: String(Value),
  }));

  const cmd = new AdminUpdateUserAttributesCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
    UserAttributes: userAttributes,
  });
  return getClient().send(cmd);
}

async function adminDisableUser(username) {
  const cmd = new AdminDisableUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });
  return getClient().send(cmd);
}

async function adminEnableUser(username) {
  const cmd = new AdminEnableUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  });
  return getClient().send(cmd);
}

async function adminCreateUser(email, givenName, familyName, apellido2, temporaryPassword) {
  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' },
    { Name: 'given_name', Value: givenName },
    { Name: 'family_name', Value: familyName },
  ];
  if (apellido2) {
    userAttributes.push({ Name: 'custom:apellido2', Value: apellido2 });
  }

  const cmd = new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: userAttributes,
    TemporaryPassword: temporaryPassword,
    DesiredDeliveryMediums: ['EMAIL'],
  });
  return getClient().send(cmd);
}

async function changePassword(accessToken, previousPassword, proposedPassword) {
  const cmd = new ChangePasswordCommand({
    AccessToken: accessToken,
    PreviousPassword: previousPassword,
    ProposedPassword: proposedPassword,
  });
  return getClient().send(cmd);
}

function isConfigured() {
  return !!(USER_POOL_ID && CLIENT_ID);
}

module.exports = {
  verifyAccessToken,
  verifyIdToken,
  adminGetUser,
  adminUpdateAttributes,
  adminDisableUser,
  adminEnableUser,
  adminCreateUser,
  changePassword,
  isConfigured,
};
