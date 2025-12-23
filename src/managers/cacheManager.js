const crypto = require("crypto")

class CacheManager {
    constructor(save, load, encryptionKey) {
        this.saveRaw = save
        this.loadRaw = load
        this.encryptionEnabled = !!encryptionKey
        this.key = this.encryptionEnabled
            ? Buffer.isBuffer(encryptionKey)
                ? encryptionKey
                : crypto.createHash("sha256").update(encryptionKey).digest()
            : null
    }

    async save(key, value) {
        if (!this.encryptionEnabled) {
            return this.saveRaw(key, JSON.stringify(value))
        }

        const iv = crypto.randomBytes(16)
        const cipher = crypto.createCipheriv("aes-256-cbc", this.key, iv)
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(value), "utf8"),
            cipher.final()
        ])
        const payload = Buffer.concat([iv, encrypted]).toString("base64")
        return this.saveRaw(key, payload)
    }

    async load(key) {
        try {
            const payload = await this.loadRaw(key)
            if (!payload) return null

            if (!this.encryptionEnabled) {
                return JSON.parse(payload)
            }

            const buffer = Buffer.from(payload, "base64")
            if (buffer.length < 17) return null

            const iv = buffer.subarray(0, 16)
            const data = buffer.subarray(16)
            const decipher = crypto.createDecipheriv("aes-256-cbc", this.key, iv)
            const decrypted = Buffer.concat([
                decipher.update(data),
                decipher.final()
            ]).toString("utf8")

            return JSON.parse(decrypted)
        } catch {
            return null
        }
    }
}

module.exports = CacheManager
