const LiveTokenManager = require("./managers/liveTokenManager")
const MsaTokenManager = require("./managers/msaTokenManager")
const XboxTokenManager = require("./managers/xboxTokenManager")
const PlayfabTokenManager = require("./managers/playfabTokenManager")
const MinecraftServicesTokenManager = require("./managers/minecraftServicesTokenManager")
const MinecraftBedrockTokenManager = require("./managers/minecraftBedrockTokenManager")
const crypto = require("crypto")

const { RelyingParties, titles, defaultMsaScopes, defaultLiveScopes } = require("./common/constants.json")


class MSAuth {
    constructor(cacheKey, cacheManager, options, onDeviceCode) {
        this.cacheKey = cacheKey
        this.cacheManager = cacheManager
        this.onDeviceCode = onDeviceCode

        const flow = options?.flow || "live"

        this.options = {
            flow,
            authTitle: titles.MinecraftNintendoSwitch,
            scopes:
                options?.scopes ??
                (flow === "msal" ? defaultMsaScopes : defaultLiveScopes),
            relyingParty: RelyingParties.XboxRelyingParty,
            forceRefresh: false,
            ...(options || {})
        }

        if (this.options.flow === "live") {
            this.msaTokenManager = new LiveTokenManager(
                this,
                this.options.authTitle,
                this.options.scopes
            )
            this.doTitleAuth = true
        } else if (this.options.flow === "msal") {
            this.msaTokenManager = new MsaTokenManager(
                this,
                {
                    auth: {
                        clientId: this.options.authTitle
                    }
                },
                this.options.scopes
            )
            this.doTitleAuth = false
        } else {
            throw new Error(`unknown flow ${this.options.flow}`)
        }

        const keyPair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" })
        this.xbl = new XboxTokenManager(keyPair, this)
        this.pfb = new PlayfabTokenManager(this)
        this.mcs = new MinecraftServicesTokenManager(this)
        this.mcb = new MinecraftBedrockTokenManager(this)
    }

    async getCachedToken() {
        return await this.cacheManager.load(this.cacheKey)
    }

    async cacheToken(token) {
        return await this.cacheManager.save(this.cacheKey, token)
    }

    async getMsaToken() {
        return await this.msaTokenManager.getToken()
    }

    async getXboxToken(
        relyingParty = this.options.relyingParty,
        forceRefresh = this.options.forceRefresh
    ) {
        const options = { ...this.options, relyingParty }

        const {
            xstsToken,
            userToken,
            deviceToken,
            titleToken
        } = await this.xbl.getCachedTokens(relyingParty)

        if (xstsToken.valid && !forceRefresh) {
            return xstsToken.data
        }

        const msaToken = await this.getMsaToken()

        const ut =
            userToken.token ??
            await this.xbl.getUserToken(msaToken, options.flow === "msal")

        const dt =
            deviceToken.token ??
            await this.xbl.getDeviceToken(options)

        const tt =
            titleToken.token ??
            (this.doTitleAuth
                ? await this.xbl.getTitleToken(msaToken, dt)
                : undefined)

        return await this.xbl.getXSTSToken(
            { userToken: ut, deviceToken: dt, titleToken: tt },
            options
        )
    }

    async getPlayfabLogin(forceRefresh = this.options.forceRefresh) {
        const cache = await this.pfb.getCachedAccessToken()

        if (cache.valid && !forceRefresh) {
            return cache.data
        }

        const xsts = await this.getXboxToken(RelyingParties.PlayfabRelyingParty, forceRefresh)

        return await this.pfb.getAccessToken(xsts)
    }

    async getMinecraftServicesToken(forceRefresh = this.options.forceRefresh) {
        const cache = await this.mcs.getCachedAccessToken()

        if (cache.valid && !forceRefresh) {
            return cache.data
        }

        const playfab = await this.getPlayfabLogin(forceRefresh)

        return await this.mcs.getAccessToken(playfab.SessionTicket)
    }

    async getMinecraftBedrockToken(clientPublicKey, forceRefresh = this.options.forceRefresh) {
        const cache = await this.mcb.getCachedAccessToken()

        if (cache.valid && !forceRefresh) {
            return cache.data
        }

        const xsts = await this.getXboxToken(RelyingParties.BedrockXSTSRelyingParty, forceRefresh)

        return await this.mcb.getAccessToken(clientPublicKey, xsts)
    }
}

module.exports = MSAuth
