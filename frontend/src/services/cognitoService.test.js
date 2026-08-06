import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  signUp,
  confirmSignUp,
  resendConfirmation,
  signIn,
  completeNewPassword,
  signOut,
  forgotPassword,
  confirmForgotPassword,
  changePassword,
  getSession,
  getAccessToken,
  getIdToken,
  isConfigured,
} from './cognitoService'

// Mock the Cognito library
vi.mock('amazon-cognito-identity-js', () => {
  const mockUserPool = {
    signUp: vi.fn(),
    getCurrentUser: vi.fn(),
  }

  const mockCognitoUser = {
    confirmRegistration: vi.fn(),
    resendConfirmationCode: vi.fn(),
    authenticateUser: vi.fn(),
    completeNewPasswordChallenge: vi.fn(),
    signOut: vi.fn(),
    forgotPassword: vi.fn(),
    confirmPassword: vi.fn(),
    getSession: vi.fn(),
    changePassword: vi.fn(),
  }

  class CognitoUserPool {
    constructor() {
      return mockUserPool
    }
  }

  class CognitoUser {
    constructor() {
      return mockCognitoUser
    }
  }

  class AuthenticationDetails {
    constructor() {}
  }

  class CognitoUserAttribute {
    constructor(data) {
      this.Name = data.Name
      this.Value = data.Value
    }
  }

  return {
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
    CognitoUserAttribute,
    __mockUserPool: mockUserPool,
    __mockCognitoUser: mockCognitoUser,
  }
})

// Mock config with values
vi.mock('./cognitoConfig', () => ({
  POOL_ID: 'test-pool-id',
  CLIENT_ID: 'test-client-id',
}))

describe('cognitoService', () => {
  let mockUserPool, mockCognitoUser

  beforeEach(async () => {
    vi.clearAllMocks()
    const cognitoMock = await import('amazon-cognito-identity-js')
    mockUserPool = cognitoMock.__mockUserPool
    mockCognitoUser = cognitoMock.__mockCognitoUser
  })

  describe('signUp', () => {
    it('should sign up with all attributes including apellido2', async () => {
      const mockResult = { user: { username: 'test@example.com' } }
      mockUserPool.signUp.mockImplementation((email, password, attributes, validationData, callback) => {
        callback(null, mockResult)
      })

      const result = await signUp(
        'test@example.com',
        'password123',
        'John',
        'Doe',
        'Smith',
        'ACME Corp'
      )

      expect(result).toEqual(mockResult)
      expect(mockUserPool.signUp).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        expect.arrayContaining([
          expect.objectContaining({ Name: 'email', Value: 'test@example.com' }),
          expect.objectContaining({ Name: 'given_name', Value: 'John' }),
          expect.objectContaining({ Name: 'family_name', Value: 'Doe' }),
          expect.objectContaining({ Name: 'custom:apellido2', Value: 'Smith' }),
          expect.objectContaining({ Name: 'custom:companyName', Value: 'ACME Corp' }),
        ]),
        null,
        expect.any(Function)
      )
    })

    it('should sign up without apellido2 when not provided', async () => {
      const mockResult = { user: { username: 'test@example.com' } }
      mockUserPool.signUp.mockImplementation((email, password, attributes, validationData, callback) => {
        callback(null, mockResult)
      })

      await signUp(
        'test@example.com',
        'password123',
        'John',
        'Doe',
        null,
        'ACME Corp'
      )

      const attributes = mockUserPool.signUp.mock.calls[0][2]
      const hasApellido2 = attributes.some(attr => attr.Name === 'custom:apellido2')
      expect(hasApellido2).toBe(false)
    })

    it('should reject on error', async () => {
      const mockError = new Error('SignUp failed')
      mockUserPool.signUp.mockImplementation((email, password, attributes, validationData, callback) => {
        callback(mockError, null)
      })

      await expect(
        signUp('test@example.com', 'password123', 'John', 'Doe', null, 'ACME Corp')
      ).rejects.toThrow('SignUp failed')
    })
  })

  describe('confirmSignUp', () => {
    it('should confirm registration successfully', async () => {
      const mockResult = 'SUCCESS'
      mockCognitoUser.confirmRegistration.mockImplementation((code, forceAliasCreation, callback) => {
        callback(null, mockResult)
      })

      const result = await confirmSignUp('test@example.com', '123456')

      expect(result).toEqual(mockResult)
      expect(mockCognitoUser.confirmRegistration).toHaveBeenCalledWith('123456', true, expect.any(Function))
    })

    it('should reject on error', async () => {
      const mockError = new Error('Invalid code')
      mockCognitoUser.confirmRegistration.mockImplementation((code, forceAliasCreation, callback) => {
        callback(mockError, null)
      })

      await expect(confirmSignUp('test@example.com', '123456')).rejects.toThrow('Invalid code')
    })
  })

  describe('resendConfirmation', () => {
    it('should resend confirmation code successfully', async () => {
      const mockResult = { CodeDeliveryDetails: { Destination: 't***@example.com' } }
      mockCognitoUser.resendConfirmationCode.mockImplementation((callback) => {
        callback(null, mockResult)
      })

      const result = await resendConfirmation('test@example.com')

      expect(result).toEqual(mockResult)
      expect(mockCognitoUser.resendConfirmationCode).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should reject on error', async () => {
      const mockError = new Error('Rate limit exceeded')
      mockCognitoUser.resendConfirmationCode.mockImplementation((callback) => {
        callback(mockError, null)
      })

      await expect(resendConfirmation('test@example.com')).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockSession = { isValid: () => true }
      mockCognitoUser.authenticateUser.mockImplementation((authDetails, callbacks) => {
        callbacks.onSuccess(mockSession)
      })

      const result = await signIn('test@example.com', 'password123')

      expect(result).toEqual(mockSession)
      expect(mockCognitoUser.authenticateUser).toHaveBeenCalled()
    })

    it('should reject on authentication failure', async () => {
      const mockError = new Error('Incorrect username or password')
      mockCognitoUser.authenticateUser.mockImplementation((authDetails, callbacks) => {
        callbacks.onFailure(mockError)
      })

      await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow('Incorrect username or password')
    })

    it('should reject with NewPasswordRequiredException when password change required', async () => {
      const mockUserAttributes = { email: 'test@example.com' }
      mockCognitoUser.authenticateUser.mockImplementation((authDetails, callbacks) => {
        callbacks.newPasswordRequired(mockUserAttributes)
      })

      try {
        await signIn('test@example.com', 'temppassword')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err.message).toBe('New password required')
        expect(err.code).toBe('NewPasswordRequiredException')
        expect(err.cognitoUser).toBeDefined()
        expect(err.userAttributes).toEqual(mockUserAttributes)
      }
    })
  })

  describe('completeNewPassword', () => {
    it('should complete new password challenge successfully', async () => {
      const mockSession = { isValid: () => true }
      mockCognitoUser.completeNewPasswordChallenge.mockImplementation((newPassword, requiredAttributes, callbacks) => {
        callbacks.onSuccess(mockSession)
      })

      const result = await completeNewPassword(mockCognitoUser, 'newpassword123')

      expect(result).toEqual(mockSession)
      expect(mockCognitoUser.completeNewPasswordChallenge).toHaveBeenCalledWith(
        'newpassword123',
        {},
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onFailure: expect.any(Function),
        })
      )
    })

    it('should reject on failure', async () => {
      const mockError = new Error('Password does not meet requirements')
      mockCognitoUser.completeNewPasswordChallenge.mockImplementation((newPassword, requiredAttributes, callbacks) => {
        callbacks.onFailure(mockError)
      })

      await expect(completeNewPassword(mockCognitoUser, 'weak')).rejects.toThrow('Password does not meet requirements')
    })
  })

  describe('signOut', () => {
    it('should sign out when user exists', () => {
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)

      signOut()

      expect(mockUserPool.getCurrentUser).toHaveBeenCalled()
      expect(mockCognitoUser.signOut).toHaveBeenCalled()
    })

    it('should not throw when no user is logged in', () => {
      mockUserPool.getCurrentUser.mockReturnValue(null)

      expect(() => signOut()).not.toThrow()
      expect(mockUserPool.getCurrentUser).toHaveBeenCalled()
      expect(mockCognitoUser.signOut).not.toHaveBeenCalled()
    })
  })

  describe('forgotPassword', () => {
    it('should initiate forgot password successfully', async () => {
      const mockData = { CodeDeliveryDetails: { Destination: 't***@example.com' } }
      mockCognitoUser.forgotPassword.mockImplementation((callbacks) => {
        callbacks.onSuccess(mockData)
      })

      const result = await forgotPassword('test@example.com')

      expect(result).toEqual(mockData)
      expect(mockCognitoUser.forgotPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onFailure: expect.any(Function),
        })
      )
    })

    it('should reject on error', async () => {
      const mockError = new Error('User not found')
      mockCognitoUser.forgotPassword.mockImplementation((callbacks) => {
        callbacks.onFailure(mockError)
      })

      await expect(forgotPassword('nonexistent@example.com')).rejects.toThrow('User not found')
    })
  })

  describe('confirmForgotPassword', () => {
    it('should confirm password reset successfully', async () => {
      mockCognitoUser.confirmPassword.mockImplementation((code, newPassword, callbacks) => {
        callbacks.onSuccess()
      })

      await expect(
        confirmForgotPassword('test@example.com', '123456', 'newpassword123')
      ).resolves.toBeUndefined()

      expect(mockCognitoUser.confirmPassword).toHaveBeenCalledWith(
        '123456',
        'newpassword123',
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onFailure: expect.any(Function),
        })
      )
    })

    it('should reject on error', async () => {
      const mockError = new Error('Invalid verification code')
      mockCognitoUser.confirmPassword.mockImplementation((code, newPassword, callbacks) => {
        callbacks.onFailure(mockError)
      })

      await expect(
        confirmForgotPassword('test@example.com', 'wrong', 'newpassword123')
      ).rejects.toThrow('Invalid verification code')
    })
  })

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockResult = 'SUCCESS'
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null)
      })
      mockCognitoUser.changePassword.mockImplementation((oldPassword, newPassword, callback) => {
        callback(null, mockResult)
      })

      const result = await changePassword('oldpassword', 'newpassword123')

      expect(result).toEqual(mockResult)
      expect(mockCognitoUser.getSession).toHaveBeenCalled()
      expect(mockCognitoUser.changePassword).toHaveBeenCalledWith(
        'oldpassword',
        'newpassword123',
        expect.any(Function)
      )
    })

    it('should reject when no user session exists', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(null)

      await expect(changePassword('oldpassword', 'newpassword123')).rejects.toThrow('No user session')
    })

    it('should reject when getSession fails', async () => {
      const mockError = new Error('Session expired')
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(mockError)
      })

      await expect(changePassword('oldpassword', 'newpassword123')).rejects.toThrow('Session expired')
      expect(mockCognitoUser.changePassword).not.toHaveBeenCalled()
    })

    it('should reject when changePassword fails', async () => {
      const mockError = new Error('Incorrect old password')
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null)
      })
      mockCognitoUser.changePassword.mockImplementation((oldPassword, newPassword, callback) => {
        callback(mockError, null)
      })

      await expect(changePassword('wrongold', 'newpassword123')).rejects.toThrow('Incorrect old password')
    })
  })

  describe('getSession', () => {
    it('should get valid session successfully', async () => {
      const mockSession = { isValid: () => true }
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null, mockSession)
      })

      const result = await getSession()

      expect(result).toEqual(mockSession)
      expect(mockCognitoUser.getSession).toHaveBeenCalled()
    })

    it('should reject when no user session exists', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(null)

      await expect(getSession()).rejects.toThrow('No user session')
    })

    it('should reject when getSession returns error', async () => {
      const mockError = new Error('Session error')
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(mockError, null)
      })

      await expect(getSession()).rejects.toThrow('Session error')
    })

    it('should reject when session is null', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null, null)
      })

      await expect(getSession()).rejects.toThrow('Session invalid')
    })

    it('should reject when session is invalid', async () => {
      const mockSession = { isValid: () => false }
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null, mockSession)
      })

      await expect(getSession()).rejects.toThrow('Session invalid')
    })
  })

  describe('getAccessToken', () => {
    it('should get access token successfully', async () => {
      const mockToken = 'mock-access-token'
      const mockSession = {
        isValid: () => true,
        getAccessToken: () => ({ getJwtToken: () => mockToken }),
      }
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null, mockSession)
      })

      const result = await getAccessToken()

      expect(result).toBe(mockToken)
    })

    it('should reject when session retrieval fails', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(null)

      await expect(getAccessToken()).rejects.toThrow('No user session')
    })
  })

  describe('getIdToken', () => {
    it('should get ID token successfully', async () => {
      const mockToken = 'mock-id-token'
      const mockSession = {
        isValid: () => true,
        getIdToken: () => ({ getJwtToken: () => mockToken }),
      }
      mockUserPool.getCurrentUser.mockReturnValue(mockCognitoUser)
      mockCognitoUser.getSession.mockImplementation((callback) => {
        callback(null, mockSession)
      })

      const result = await getIdToken()

      expect(result).toBe(mockToken)
    })

    it('should reject when session retrieval fails', async () => {
      mockUserPool.getCurrentUser.mockReturnValue(null)

      await expect(getIdToken()).rejects.toThrow('No user session')
    })
  })

  describe('isConfigured', () => {
    it('should return true when both POOL_ID and CLIENT_ID are configured', () => {
      const result = isConfigured()

      expect(result).toBe(true)
    })
  })
})

// Separate test for isConfigured with missing config
describe('cognitoService - unconfigured', () => {
  it('should return false when POOL_ID is missing', async () => {
    vi.resetModules()
    vi.doMock('./cognitoConfig', () => ({
      POOL_ID: null,
      CLIENT_ID: 'test-client-id',
    }))

    const service = await import('./cognitoService')
    expect(service.isConfigured()).toBe(false)
  })

  it('should return false when CLIENT_ID is missing', async () => {
    vi.resetModules()
    vi.doMock('./cognitoConfig', () => ({
      POOL_ID: 'test-pool-id',
      CLIENT_ID: null,
    }))

    const service = await import('./cognitoService')
    expect(service.isConfigured()).toBe(false)
  })

  it('should return false when both are missing', async () => {
    vi.resetModules()
    vi.doMock('./cognitoConfig', () => ({
      POOL_ID: undefined,
      CLIENT_ID: undefined,
    }))

    const service = await import('./cognitoService')
    expect(service.isConfigured()).toBe(false)
  })
})
