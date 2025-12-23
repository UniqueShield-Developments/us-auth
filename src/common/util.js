const crypto = require("crypto")

function checkStatus(res) {
    if (res.ok) return res.json()
    return res.text().then(t => {
        throw Error(`${res.status} ${res.statusText} ${t}`)
    })
}

function createHash(value) {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8)
}

function checkIfValid(expires) {
    return new Date(expires) - Date.now() > 1000
}

module.exports = {
    checkStatus,
    createHash,
    checkIfValid
}
