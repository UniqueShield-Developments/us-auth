const fetch = require("node-fetch")
const { checkStatus, checkIfValid } = require("../common/util")
const { AuthEndpoints } = require("../common/constants.json")

class PlayfabTokenManager {
    constructor(msAuth) {
        this.msAuth = msAuth
        this.cacheSlot = "pfb"
    }

    async getCached() {
        const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey)
        return cached?.[this.cacheSlot] ?? null
    }

    async setCached(data) {
        const cached = (await this.msAuth.cacheManager.load(this.msAuth.cacheKey)) || {}
        cached[this.cacheSlot] = data
        await this.msAuth.cacheManager.save(this.msAuth.cacheKey, cached)
    }

    async getCachedAccessToken() {
        const cache = await this.getCached()
        if (!cache?.EntityToken) return { valid: false }

        const expiresOn = cache.EntityToken.TokenExpiration
        const valid = checkIfValid(expiresOn)

        return {
            valid,
            until: expiresOn,
            data: cache
        }
    }

    async getAccessToken(xsts) {
        const payload = {
            CreateAccount: true,
            EncryptedRequest: null,
            InfoRequestParameters: {
                GetCharacterInventories: false,
                GetCharacterList: false,
                GetPlayerProfile: true,
                GetPlayerStatistics: false,
                GetTitleData: false,
                GetUserAccountInfo: true,
                GetUserData: false,
                GetUserInventory: false,
                GetUserReadOnlyData: false,
                GetUserVirtualCurrency: false,
                PlayerStatisticNames: null,
                ProfileConstraints: null,
                TitleDataKeys: null,
                UserDataKeys: null,
                UserReadOnlyDataKeys: null
            },
            PlayerSecret: null,
            TitleId: "20CA2",
            XboxToken: `XBL3.0 x=${xsts.userHash};${xsts.XSTSToken}`
        }

        const ret = await fetch(AuthEndpoints.PlayfabLoginWithXbox, {
            method: "post",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(checkStatus)

        await this.setCached(ret.data)
        return ret.data
    }
}

module.exports = PlayfabTokenManager
