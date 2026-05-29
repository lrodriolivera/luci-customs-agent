const BACKEND_URL = process.env.BACKEND_URL || 'https://aduanas.strixai.es';
const REGISTER_SYNC_SECRET = process.env.REGISTER_SYNC_SECRET;

export const handler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const { userAttributes } = event.request;
  const payload = {
    cognitoSub: userAttributes.sub,
    email: userAttributes.email,
    givenName: userAttributes.given_name || '',
    familyName: userAttributes.family_name || '',
    apellido2: userAttributes['custom:apellido2'] || '',
    companyName: userAttributes['custom:companyName'] || '',
  };

  const response = await fetch(`${BACKEND_URL}/api/auth/register-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Register-Sync-Secret': REGISTER_SYNC_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('register-sync failed:', response.status, errorText);
    throw new Error(`register-sync failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('register-sync success:', data);

  return event;
};
