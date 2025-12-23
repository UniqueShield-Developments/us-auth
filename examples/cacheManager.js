const { CacheManager } = require("../index");

const crypto = require("crypto")
const path = require("path")
const fs = require("fs")

const encryptionKey = "NoL00king!" // you can skip encryption if this is not set

const cacheFolder = path.join(__dirname, "tokens")

fs.mkdirSync(cacheFolder)

function save(key, value) {
    const keyHash = crypto.createHash("sha256").update(key).digest("hex").substring(0, 8) + ".tok"
    fs.writeFileSync(path.join(cacheFolder, keyHash), value, "utf8")
}

function load(key) {
    const keyHash = crypto.createHash("sha256").update(key).digest("hex").substring(0, 8) + ".tok"
    return fs.readFileSync(path.join(cacheFolder, keyHash), "utf8")
}

const cacheManager = new CacheManager(save, load, encryptionKey) //this can be reused

module.exports = cacheManager