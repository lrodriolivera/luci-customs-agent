export const handler = async (event) => {
  const { userAttributes } = event.request;

  event.response = {
    claimsAndScopesOverrideDetails: {
      accessTokenGeneration: {
        claimsToAddOrOverride: {
          tenantId: userAttributes['custom:tenantId'] || '',
          role: userAttributes['custom:role'] || 'admin',
        },
      },
      idTokenGeneration: {
        claimsToAddOrOverride: {
          tenantId: userAttributes['custom:tenantId'] || '',
          role: userAttributes['custom:role'] || 'admin',
        },
      },
    },
  };

  return event;
};
