import fs from "fs"
import os from "os"
import path from "path"
import { Readable } from "stream"
import { retrieveStoredFile } from "../stored-file"

const MB = 1024 * 1024

/** A 20 MB object that is produced 1 MB at a time, counting what was pulled. */
function bigObject() {
  const state = { pulled: 0, destroyed: false }
  const stream = new Readable({
    read() {
      if (state.pulled >= 20) return this.push(null)
      state.pulled++
      this.push(Buffer.alloc(MB))
    },
    destroy(err, cb) {
      state.destroyed = true
      cb(err)
    },
  })
  return { stream, state }
}

function fileModule(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    retrieveFile: jest.fn(async (id: string) => ({ id, url: `https://files.example/${id}` })),
    getDownloadStream: jest.fn(async () => bigObject().stream),
    getAsBuffer: jest.fn(async () => Buffer.alloc(20 * MB)),
    ...overrides,
  }
}

describe("retrieveStoredFile", () => {
  it("proves the object exists by opening it, without downloading it", async () => {
    const { stream, state } = bigObject()
    const files = fileModule({ getDownloadStream: jest.fn(async () => stream) })

    await expect(retrieveStoredFile(files, "photo.jpg")).resolves.toEqual({
      id: "photo.jpg",
      url: "https://files.example/photo.jpg",
    })
    expect(files.getDownloadStream).toHaveBeenCalledWith("photo.jpg")
    expect(files.getAsBuffer).not.toHaveBeenCalled()
    expect(state.destroyed).toBe(true)
    // At most what the stream buffers ahead (highWaterMark), never the whole 20 MB.
    expect(state.pulled).toBeLessThanOrEqual(2)
  })

  it("fails when the object is missing (the storage answers 404)", async () => {
    const missing = Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" })
    const files = fileModule({ getDownloadStream: jest.fn(async () => Promise.reject(missing)) })
    await expect(retrieveStoredFile(files, "gone.jpg")).rejects.toThrow("does not exist")
  })

  it("fails when the file is not known at all", async () => {
    const files = fileModule({ retrieveFile: jest.fn(async () => Promise.reject(new Error("not found"))) })
    await expect(retrieveStoredFile(files, "nope.jpg")).rejects.toThrow("not found")
    expect(files.getDownloadStream).not.toHaveBeenCalled()
  })

  it("fails for a missing local file whose stream only errors once opened", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stored-file-"))
    const files = fileModule({
      getDownloadStream: jest.fn(async (id: string) => fs.createReadStream(path.join(dir, id))),
    })
    await expect(retrieveStoredFile(files, "missing.jpg")).rejects.toThrow(/ENOENT/)
  })

  it("accepts an empty object and a real local file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stored-file-"))
    fs.writeFileSync(path.join(dir, "a.jpg"), Buffer.alloc(3 * MB, 1))
    const local = fileModule({
      getDownloadStream: jest.fn(async (id: string) => fs.createReadStream(path.join(dir, id))),
    })
    await expect(retrieveStoredFile(local, "a.jpg")).resolves.toMatchObject({ id: "a.jpg" })

    const empty = fileModule({ getDownloadStream: jest.fn(async () => Readable.from([])) })
    await expect(retrieveStoredFile(empty, "empty.jpg")).resolves.toMatchObject({ id: "empty.jpg" })
  })

  it("gives up on a storage stream that never answers, and closes it", async () => {
    let destroyed = false
    const silent = new Readable({
      read() {},
      destroy(err, cb) {
        destroyed = true
        cb(err)
      },
    })
    const files = fileModule({ getDownloadStream: jest.fn(async () => silent) })
    await expect(retrieveStoredFile(files, "stalled.jpg", { timeoutMs: 50 })).rejects.toThrow(/did not answer/i)
    expect(destroyed).toBe(true)
  })
})
