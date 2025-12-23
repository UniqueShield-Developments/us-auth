const fetch = require("node-fetch")
const { checkStatus, checkIfValid } = require("../common/util")
const { AuthEndpoints } = require("../common/constants.json")
const uuid = require("uuid-1345")

class MinecraftServicesTokenManager {
    constructor(msAuth) {
        this.msAuth = msAuth
        this.cacheSlot = "mcs"
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
        if (!cache?.expiresOn) return { valid: false }

        const expiresOn = cache.expiresOn
        const valid = checkIfValid(expiresOn)

        return {
            valid,
            until: expiresOn,
            data: cache
        }
    }

    async getAccessToken(sessionTicket) {
        const payload = {
            device: {
                applicationType: "MinecraftPE", gameVersion: "1.20.62",
                id: uuid.v4(), memory: String(8 * 1024 * 1024 * 1024),
                platform: "Windows10", playFabTitleId: "20CA2",
                storePlatform: "uwp.store", type: "Windows10"
            },
            user: { token: sessionTicket, tokenType: "PlayFab" }
        }

        const ret = await fetch(AuthEndpoints.MinecraftSessisonStart, {
            method: "post",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(checkStatus)

        const token = {
            token: ret.result.authorizationHeader,
            expiresOn: ret.result.validUntil,
            treatments: ret.result.treatments,
            configurations: ret.result.configurations,
            treatmentContext: ret.result.treatmentContext
        }

        await this.setCached(token)
        return token
    }
}

module.exports = MinecraftServicesTokenManager
