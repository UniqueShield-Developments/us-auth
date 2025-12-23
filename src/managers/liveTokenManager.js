const fetch = require("node-fetch")
const { checkStatus } = require("../common/util")

class LiveTokenManager {
    constructor(msAuth, clientId, scopes) {
        this.msAuth = msAuth
        this.clientId = clientId
        this.scopes = scopes
        this.cacheSlot = "live"
        this.polling = false
    }

    async getCached() {
        const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey)
        return cached?.[this.cacheSlot] ?? null
    }

    async setCached(data) {
        const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey) || {}
        cached[this.cacheSlot] = data
        return this.msAuth.cacheManager.save(this.msAuth.cacheKey, cached)
    }

    async verifyTokens() {
        const cached = await this.getCached()
        if (!cached || !cached.token) return false

        const expiresAt = cached.token.obtainedOn + cached.token.expires_in * 1000
        if (expiresAt - Date.now() > 1000) return true

        try {
            await this.refreshTokens()
            return true
        } catch {
            return false
        }
    }

    async refreshTokens() {
        const cached = await this.getCached()
        if (!cached?.token?.refresh_token) {
            throw new Error("missing refresh token")
        }

        const token = await fetch("https://login.live.com/oauth20_token.srf", {
            method: "post",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: this.clientId,
                scope: this.scopes,
                grant_type: "refresh_token",
                refresh_token: cached.token.refresh_token
            }).toString()
        }).then(checkStatus)

        await this.setCached({
            token: {
                ...token,
                obtainedOn: Date.now()
            }
        })

        return token
    }

    async authDeviceCode() {
        const device = await fetch("https://login.live.com/oauth20_connect.srf", {
            method: "post",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: this.clientId,
                scope: this.scopes,
                response_type: "device_code"
            }).toString()
        }).then(checkStatus)

        if (this.msAuth.onDeviceCode) {
            const userVerificationUrl = device.verification_uri + "?otc=" + device.user_code
            this.msAuth.onDeviceCode({
                message: `To sign in, visit ${userVerificationUrl}`,
                userVerificationUrl,
                ...device
            })
        }

        const expireAt = Date.now() + device.expires_in * 1000
        this.polling = true

        while (this.polling && Date.now() < expireAt) {
            await new Promise(r => setTimeout(r, device.interval * 1000))

            const token = await fetch("https://login.live.com/oauth20_token.srf", {
                method: "post",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                    device_code: device.device_code
                }).toString()
            }).then(checkStatus).catch(e => {
                if (e.message.includes("authorization_pending")) return null
                throw e
            })

            if (!token) continue

            console.log("[live] User signed in")

            await this.setCached({
                token: {
                    ...token,
                    obtainedOn: Date.now()
                }
            })

            this.polling = false
            return token.access_token
        }

        this.polling = false
        throw new Error("device code expired")
    }

    async getToken() {
        const cached = await this.getCached()

        if (cached?.token) {
            const expiresAt = cached.token.obtainedOn + cached.token.expires_in * 1000
            if (expiresAt - Date.now() > 1000) {
                return cached.token.access_token
            }
        }

        const refreshed = await this.verifyTokens()
        if (refreshed) {
            const updated = await this.getCached()
            return updated.token.access_token
        }

        return await this.authDeviceCode()
    }
}

module.exports = LiveTokenManager
