/** Lock keys that serialise concurrent trade workflows (Locking Module; Redis in production). */
export const tradeApplicationLockKey = (id: string) => `trade_application:${id}`
export const tradeCustomerLockKey = (customerId: string) => `trade_application:customer:${customerId}`

/** Wait up to 5 s for the lock; it expires after 30 s if a process dies holding it. */
export const TRADE_LOCK_OPTIONS = { timeout: 5, ttl: 30 }
