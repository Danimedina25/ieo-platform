import "dotenv/config";
export function selectTestDatabase() {
  const target = process.env.TEST_DATABASE_URL;
  if (!target) throw new Error("TEST_DATABASE_URL es obligatoria.");
  const testUrl = new URL(target);
  const current = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  if (testUrl.protocol !== "mysql:" || !/^\/[a-zA-Z0-9_]+_test$/.test(testUrl.pathname)) throw new Error("Las pruebas requieren una base MySQL dedicada con sufijo _test.");
  if (current && current.host === testUrl.host && current.pathname === testUrl.pathname && process.env.IEO_TEST_DATABASE_ACTIVE !== "true") throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
  process.env.DATABASE_URL = target;
  process.env.IEO_TEST_DATABASE_ACTIVE = "true";
}
