import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'
import { POOL_ID, CLIENT_ID } from './cognitoConfig'

const poolData = { UserPoolId: POOL_ID, ClientId: CLIENT_ID }
let userPool = null

function getPool() {
  if (!userPool) {
    userPool = new CognitoUserPool(poolData)
  }
  return userPool
}

function getCognitoUser(email) {
  return new CognitoUser({ Username: email, Pool: getPool() })
}

export function signUp(email, password, givenName, familyName, apellido2, companyName) {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'given_name', Value: givenName }),
      new CognitoUserAttribute({ Name: 'family_name', Value: familyName }),
      new CognitoUserAttribute({ Name: 'custom:companyName', Value: companyName }),
    ]
    if (apellido2) {
      attributes.push(new CognitoUserAttribute({ Name: 'custom:apellido2', Value: apellido2 }))
    }

    getPool().signUp(email, password, attributes, null, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCognitoUser(email)
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export function resendConfirmation(email) {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCognitoUser(email)
    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({ Username: email, Password: password })
    const cognitoUser = getCognitoUser(email)

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: (userAttributes) => {
        const err = new Error('New password required')
        err.code = 'NewPasswordRequiredException'
        err.cognitoUser = cognitoUser
        err.userAttributes = userAttributes
        reject(err)
      },
    })
  })
}

export function completeNewPassword(cognitoUser, newPassword) {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    })
  })
}

const SIGN_OUT_TIMEOUT_MS = 5000

/**
 * Cierra la sesión revocando los tokens en Cognito.
 *
 * En amazon-cognito-identity-js 6.3.22, signOut() sin callback solo llama a
 * cleanClientData() (borra el almacenamiento local, el refresh token sigue
 * válido en el servidor). Con callback hace getSession -> revokeTokens
 * (RevokeToken sobre el refresh token) -> cleanClientData -> callback(err).
 * Si getSession falla, el callback se invoca SIN limpiar: por eso, ante error
 * o falta de respuesta, se limpia el estado local con signOut() sin callback.
 * Nunca rechaza: resuelve { revoked } para que el logout local siempre termine.
 */
export function signOut() {
  return new Promise((resolve) => {
    let cognitoUser
    try {
      cognitoUser = getPool().getCurrentUser()
    } catch (_) {
      return resolve({ revoked: false })
    }
    if (!cognitoUser) return resolve({ revoked: false })

    let terminado = false
    const terminar = (revoked) => {
      if (terminado) return
      terminado = true
      clearTimeout(temporizador)
      if (!revoked) {
        try { cognitoUser.signOut() } catch (_) { /* nada más que limpiar */ }
      }
      resolve({ revoked })
    }
    const temporizador = setTimeout(() => terminar(false), SIGN_OUT_TIMEOUT_MS)

    try {
      cognitoUser.signOut((err) => terminar(!err))
    } catch (_) {
      terminar(false)
    }
  })
}

export function forgotPassword(email) {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCognitoUser(email)
    cognitoUser.forgotPassword({
      onSuccess: (data) => resolve(data),
      onFailure: (err) => reject(err),
    })
  })
}

export function confirmForgotPassword(email, code, newPassword) {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCognitoUser(email)
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    })
  })
}

export function changePassword(oldPassword, newPassword) {
  return new Promise((resolve, reject) => {
    const cognitoUser = getPool().getCurrentUser()
    if (!cognitoUser) return reject(new Error('No user session'))

    cognitoUser.getSession((err) => {
      if (err) return reject(err)
      cognitoUser.changePassword(oldPassword, newPassword, (err2, result) => {
        if (err2) return reject(err2)
        resolve(result)
      })
    })
  })
}

export function getSession() {
  return new Promise((resolve, reject) => {
    const cognitoUser = getPool().getCurrentUser()
    if (!cognitoUser) return reject(new Error('No user session'))

    cognitoUser.getSession((err, session) => {
      if (err) return reject(err)
      if (!session || !session.isValid()) return reject(new Error('Session invalid'))
      resolve(session)
    })
  })
}

export function getAccessToken() {
  return getSession().then(session => session.getAccessToken().getJwtToken())
}

export function getIdToken() {
  return getSession().then(session => session.getIdToken().getJwtToken())
}

export function isConfigured() {
  return !!(POOL_ID && CLIENT_ID)
}
