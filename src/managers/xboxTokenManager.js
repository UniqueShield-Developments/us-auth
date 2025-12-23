const crypto = require("crypto")
const fetch = require("node-fetch")
const { SmartBuffer } = require("smart-buffer")
const UUID = require("uuid-1345")
const { checkStatus, createHash, checkIfValid } = require("../common/util")
const { AuthEndpoints, xboxLiveErrors } = require("../common/constants.json")

const nextUUID = () =>
    UUID.v3({
        namespace: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
        name: Date.now().toString()
    })


class XboxTokenManager {
    constructor(ecKey, msAuth) {
        this.key = ecKey
        this.msAuth = msAuth
        this.cacheSlot = "xbl"
        this.jwk = {
            ...ecKey.publicKey.export({ format: "jwk" }),
            alg: "ES256",
            use: "sig"
        }
        this.headers = {
            "Cache-Control": "no-store, must-revalidate, no-cache",
            "x-xbl-contract-version": 1
        }
    }

    async getCached() {
        const cached = await this.msAuth.cacheManager.load(this.msAuth.cacheKey)
        return cached?.[this.cacheSlot] ?? {}
    }

    async setCachedPartial(partial) {
        const cached = (await this.msAuth.cacheManager.load(this.msAuth.cacheKey)) || {}
        cached[this.cacheSlot] = { ...(cached[this.cacheSlot] || {}), ...partial }
        await this.msAuth.cacheManager.save(this.msAuth.cacheKey, cached)
    }

    async getCachedTokens(relyingParty) {
        const cached = await this.getCached()
        const rpHash = createHash(relyingParty)

        return {
            deviceToken: cached.deviceToken && checkIfValid(cached.deviceToken.NotAfter)
                ? { valid: true, token: cached.deviceToken.Token }
                : { valid: false },

            userToken: cached.userToken && checkIfValid(cached.userToken.NotAfter)
                ? { valid: true, token: cached.userToken.Token }
                : { valid: false },

            titleToken: cached.titleToken && checkIfValid(cached.titleToken.NotAfter)
                ? { valid: true, token: cached.titleToken.Token }
                : { valid: false },

            xstsToken: cached[rpHash] && checkIfValid(cached[rpHash].expiresOn)
                ? { valid: true, data: cached[rpHash] }
                : { valid: false }
        }
    }

    checkTokenError(code, response) {
        if (code in xboxLiveErrors) throw new Error(xboxLiveErrors[code])
        throw new Error(`Xbox Live auth failed ${code} ${JSON.stringify(response)}`)
    }

    sign(url, authToken, payload) {
        const windowsTs =
            (BigInt((Date.now() / 1000) | 0) + 11644473600n) * 10000000n
        const path = new URL(url).pathname
        const size = 5 + 9 + 5 + path.length + 1 + authToken.length + 1 + payload.length + 1

        const buf = SmartBuffer.fromSize(size)
        buf.writeInt32BE(1)
        buf.writeUInt8(0)
        buf.writeBigUInt64BE(windowsTs)
        buf.writeUInt8(0)
        buf.writeStringNT("POST")
        buf.writeStringNT(path)
        buf.writeStringNT(authToken)
        buf.writeStringNT(payload)

        const sig = crypto.sign("SHA256", buf.toBuffer(), {
            key: this.key.privateKey,
            dsaEncoding: "ieee-p1363"
        })

        const header = SmartBuffer.fromSize(sig.length + 12)
        header.writeInt32BE(1)
        header.writeBigUInt64BE(windowsTs)
        header.writeBuffer(sig)

        return header.toBuffer()
    }

    async getUserToken(accessToken, azure) {
        const payload = {
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT",
            Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: `${azure ? "d=" : "t="}${accessToken}`
            }
        }

        const body = JSON.stringify(payload)
        const sig = this.sign(AuthEndpoints.XboxUserAuth, "", body).toString("base64")

        const ret = await fetch(AuthEndpoints.XboxUserAuth, {
            method: "post",
            headers: {
                ...this.headers,
                signature: sig,
                "Content-Type": "application/json",
                accept: "application/json",
                "x-xbl-contract-version": "2"
            },
            body
        }).then(checkStatus)

        await this.setCachedPartial({ userToken: ret })
        return ret.Token
    }

    async getDeviceToken(asDevice = {}) {
        const payload = {
            Properties: {
                AuthMethod: "ProofOfPossession",
                Id: `{${nextUUID()}}`,
                DeviceType: asDevice.deviceType || "Nintendo",
                SerialNumber: `{${nextUUID()}}`,
                Version: asDevice.deviceVersion || "0.0.0",
                ProofKey: this.jwk
            },
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT"
        }

        const body = JSON.stringify(payload)
        const sig = this.sign(AuthEndpoints.XboxDeviceAuth, "", body).toString("base64")

        const ret = await fetch(AuthEndpoints.XboxDeviceAuth, {
            method: "post",
            headers: { ...this.headers, Signature: sig },
            body
        }).then(checkStatus)

        await this.setCachedPartial({ deviceToken: ret })
        return ret.Token
    }

    async getTitleToken(msaToken, deviceToken) {
        const payload = {
            Properties: {
                AuthMethod: "RPS",
                DeviceToken: deviceToken,
                RpsTicket: "t=" + msaToken,
                SiteName: "user.auth.xboxlive.com",
                ProofKey: this.jwk
            },
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT"
        }

        const body = JSON.stringify(payload)
        const sig = this.sign(AuthEndpoints.XboxTitleAuth, "", body).toString("base64")

        const ret = await fetch(AuthEndpoints.XboxTitleAuth, {
            method: "post",
            headers: { ...this.headers, Signature: sig },
            body
        }).then(checkStatus)

        await this.setCachedPartial({ titleToken: ret })
        return ret.Token
    }

    async getXSTSToken(tokens, options = {}) {
        const payload = {
            RelyingParty: options.relyingParty,
            TokenType: "JWT",
            Properties: {
                UserTokens: [tokens.userToken],
                DeviceToken: tokens.deviceToken,
                TitleToken: tokens.titleToken,
                OptionalDisplayClaims: options.optionalDisplayClaims,
                ProofKey: this.jwk,
                SandboxId: "RETAIL"
            }
        }

        const body = JSON.stringify(payload)
        const sig = this.sign(AuthEndpoints.XstsAuthorize, "", body).toString("base64")

        const req = await fetch(AuthEndpoints.XstsAuthorize, {
            method: "post",
            headers: { ...this.headers, Signature: sig },
            body
        })

        const ret = await req.json()
        if (!req.ok) this.checkTokenError(ret.XErr, ret)

        const xsts = {
            userXUID: ret.DisplayClaims.xui[0].xid || null,
            userHash: ret.DisplayClaims.xui[0].uhs,
            XSTSToken: ret.Token,
            expiresOn: ret.NotAfter
        }

        await this.setCachedPartial({ [createHash(options.relyingParty)]: xsts })
        return xsts
    }
}

module.exports = XboxTokenManager
