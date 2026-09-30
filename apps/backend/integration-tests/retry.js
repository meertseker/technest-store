// The integration runner restores a DB snapshot before every test by killing
// all connections and running CREATE DATABASE ... TEMPLATE. Under memory
// pressure that admin connection sometimes resets ("read ECONNRESET"), which
// is environmental. Retry such a test once more; the error is still logged.
jest.retryTimes(2, { logErrorsBeforeRetry: true })
