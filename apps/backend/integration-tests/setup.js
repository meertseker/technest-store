const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// The test runner listens on process.env.PORT when set, which would clash with
// a dev server using the same .env (e.g. 9001). An empty value makes it pick a
// free port, and dotenv never overrides a variable that already exists.
process.env.PORT = ""
