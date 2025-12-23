const msal = require("@azure/msal-node")

class MsaTokenManager {
    constructor(msAuth, msalConfig, scopes) {
        this.msAuth = msAuth
        this.scopes = scopes
        this.clientId = msalConfig.auth.clientId
        this.cacheSlot = "msa"
        this.forceRefresh = false

        const beforeCacheAccess = async ctx => {
            const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey)
            ctx.tokenCache.deserialize(JSON.stringify(cached?.[this.cacheSlot] || {}))
        }

        const afterCacheAccess = async ctx => {
            if (!ctx.cacheHasChanged) return
            const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey) || {}
            cached[this.cacheSlot] = JSON.parse(ctx.tokenCache.serialize())
            await this.msAuth.cacheManager.save(this.msAuth.cacheKey, cached)
        }

        msalConfig.cache = {
            cachePlugin: { beforeCacheAccess, afterCacheAccess }
        }

        this.msalApp = new msal.PublicClientApplication(msalConfig)
    }

    async getCached() {
        const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey)
        return cached?.[this.cacheSlot] || {}
    }

    async getAccessToken() {
        const cached = await this.getCached()
        const tokens = cached.AccessToken
        if (!tokens) return

        const token = Object.values(tokens).find(t => t.client_id === this.clientId)
        if (!token) return

        const expiresAt = token.expires_on * 1000
        const until = expiresAt - Date.now()
        return {
            valid: until > 1000,
            until,
            token: token.secret
        }
    }

    async getRefreshToken() {
        const cached = await this.getCached()
        const tokens = cached.RefreshToken
        if (!tokens) return

        const token = Object.values(tokens).find(t => t.client_id === this.clientId)
        if (!token) return

        return { token: token.secret }
    }

    async refreshTokens() {
        const rt = await this.getRefreshToken()
        if (!rt) throw new Error("missing refresh token")

        return await this.msalApp.acquireTokenByRefreshToken({
            refreshToken: rt.token,
            scopes: this.scopes
        })
    }

    async verifyTokens() {
        if (this.forceRefresh) {
            try { await this.refreshTokens() } catch { }
        }

        const at = await this.getAccessToken()
        const rt = await this.getRefreshToken()
        if (!at || !rt) return false

        if (at.valid) return true

        try {
            await this.refreshTokens()
            return true
        } catch {
            return false
        }
    }

    async authDeviceCode() {
        const response = await this.msalApp.acquireTokenByDeviceCode({
            scopes: this.scopes,
            deviceCodeCallback: data => {
                if (this.msAuth.onDeviceCode) {
                    this.msAuth.onDeviceCode(data)
                }
            }
        })
        console.log("[msal] User signed in")

        const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey) || {}
        cached[this.cacheSlot] = cached[this.cacheSlot] || {}
        cached[this.cacheSlot].Account = cached[this.cacheSlot].Account || {}
        cached[this.cacheSlot].Account[""] = response.account
        await this.msAuth.cacheManager.save(this.msAuth.cacheKey, cached)

        return response
    }

    async getToken() {
        const at = await this.getAccessToken()
        if (at?.valid) return at.token

        if (await this.verifyTokens()) {
            const refreshed = await this.getAccessToken()
            if (refreshed?.token) return refreshed.token
        }

        const result = await this.authDeviceCode()
        return result.accessToken
    }
}

module.exports = MsaTokenManager
