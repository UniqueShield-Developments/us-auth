const fetch = require("node-fetch")
const { checkStatus, checkIfValid } = require("../common/util")
const { AuthEndpoints } = require("../common/constants.json")

class MinecraftBedrockTokenManager {
    constructor(msAuth) {
        this.msAuth = msAuth
        this.cacheSlot = "mcb"
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

    async getAccessToken(clientPublicKey, xsts) {


        const ret = await fetch(AuthEndpoints.BedrockAuth, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MCPE/UWP',
                Authorization: `XBL3.0 x=${xsts.userHash};${xsts.XSTSToken}`
            },
            body: JSON.stringify({ identityPublicKey: clientPublicKey })
        }).then(checkStatus)

        const jwt = ret.chain[0]
        const [header, payload, signature] = jwt.split('.').map(k => Buffer.from(k, 'base64')) // eslint-disable-line

        const body = JSON.parse(String(payload))
        const expiresOn = new Date(body.exp * 1000).toISOString()

        const token = {
            chain: ret.chain,
            expiresOn
        }

        await this.setCached(token)
        return token
    }
}

module.exports = MinecraftBedrockTokenManager
