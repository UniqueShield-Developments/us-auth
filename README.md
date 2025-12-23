# us-auth

Microsoft, Xbox, PlayFab, and Minecraft auth for Node.js.  
Built for Bedrock and service token flows.

Repo  
https://github.com/UniqueShield-Developments/us-auth

---

## install

```bash
npm install us-auth
````

---

## cache manager example

```js
const { CacheManager } = require("../index")

const crypto = require("crypto")
const path = require("path")
const fs = require("fs")

const encryptionKey = "NoL00king!"

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

const cacheManager = new CacheManager(save, load, encryptionKey)

module.exports = cacheManager
```

---

## auth flow example

```js
const auth = require("../index")
const cacheManager = require("./cacheManager")

const options = {
    authTitle: auth.constants.titles.MinecraftNintendoSwitch,
    scopes: auth.constants.defaultLiveScopes,
    flow: "live"
}

const flow = new auth.MSAuth("username", cacheManager, options, (code) => {
    console.log(code.userVerificationUrl)
})

flow.getXboxToken().then((xbl) => {
    console.log("Got user XUID:", xbl.userXUID)
})
```

---

## features

* Microsoft Live login
* Xbox XSTS tokens
* PlayFab auth
* Minecraft Services token
* Minecraft Bedrock token
* Pluggable encrypted cache

---

## license

MIT
