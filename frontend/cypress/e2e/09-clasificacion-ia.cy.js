describe('09 - Clasificacion IA de mercancias', () => {
  beforeEach(() => {
    cy.login()
  })

  it('Navega al clasificador IA', () => {
    cy.visit('/classification')
    cy.wait(2000)
    cy.captureStep('09-01-clasificador-ia')
  })

  it('Clasifica una mercancia con IA', () => {
    cy.visit('/classification')
    cy.wait(2000)

    // Buscar campo de descripcion
    cy.get('textarea, input[type="text"]').first().clear().type('Cafe verde sin tostar ni descafeinar, en grano, procedente de Colombia')
    cy.captureStep('09-02-descripcion-mercancia')

    // Buscar boton de clasificar
    cy.get('body').then(($body) => {
      if ($body.text().includes('Clasificar') || $body.text().includes('Buscar')) {
        cy.contains(/Clasificar|Buscar|Analizar/).first().click({ force: true })
        cy.wait(10000) // Esperar respuesta IA
        cy.captureStep('09-03-resultado-clasificacion')
      }
    })
  })
})
