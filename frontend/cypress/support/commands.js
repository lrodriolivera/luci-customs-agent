// Login via API (mas rapido, evita rate limiting en UI)
Cypress.Commands.add('login', (email = 'test@luci.es', password = 'test123') => {
  cy.session([email, password], () => {
    cy.request({
      method: 'POST',
      url: 'https://aduanas.strixai.es/api/auth/login',
      body: { email, password },
      failOnStatusCode: false,
    }).then((resp) => {
      if (resp.status === 200 && resp.body.token) {
        window.localStorage.setItem('token', resp.body.token)
        window.localStorage.setItem('user', JSON.stringify(resp.body.user))
      } else if (resp.status === 200 && resp.body.accessToken) {
        window.localStorage.setItem('token', resp.body.accessToken)
        window.localStorage.setItem('user', JSON.stringify(resp.body.user))
      } else {
        // Fallback: login via UI
        cy.visit('/login')
        cy.get('input[id="email"]').clear().type(email)
        cy.get('input[id="password"]').clear().type(password)
        cy.get('button[type="submit"]').click()
        cy.url().should('not.include', '/login', { timeout: 15000 })
      }
    })
  })
})

// Esperar a que cargue la pagina
Cypress.Commands.add('waitForLoad', () => {
  cy.get('.animate-pulse', { timeout: 10000 }).should('not.exist')
})

// Screenshot con nombre descriptivo
Cypress.Commands.add('captureStep', (name) => {
  cy.wait(500)
  cy.screenshot(name, { capture: 'viewport' })
})
