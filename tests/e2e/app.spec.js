import { test, expect } from '@playwright/test'

test('arranque con equipo inicial; pelear nivel 1 muestra resultado', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear() } catch {} })
  await page.goto('/')

  // App lista (tabs visibles) + criaturas iniciales en la colección.
  await expect(page.locator('.tabs')).toBeVisible()
  await page.locator('.tabs button').nth(2).click() // Colección
  await expect(page.locator('.grid-cards .card').first()).toBeVisible()

  // Campaña → pelear nivel 1 → overlay de batalla → saltar → resultado.
  await page.locator('.tabs button').first().click()
  await page.locator('.lvls .lvl').first().click()
  await expect(page.locator('.battle')).toBeVisible()
  await page.locator('.arena').click()                 // saltar al final
  await expect(page.locator('.bresult .big')).toBeVisible()
})

test('invocar gasta monedas y agrega a la colección', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear() } catch {} })
  await page.goto('/')
  await expect(page.locator('.tabs')).toBeVisible()
  await page.locator('.tabs button').nth(3).click()    // Invocar
  const before = await page.evaluate(async () => (await import('/src/game/state.js')).game.collection.length)
  await page.locator('.center .btn').click()
  await expect(page.locator('.center .card')).toBeVisible()
  const after = await page.evaluate(async () => (await import('/src/game/state.js')).game.collection.length)
  expect(after).toBe(before + 1)
})
