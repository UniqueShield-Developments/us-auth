const auth = require("../index")
const cacheManager = require("./cacheManager")

// these are the default options
const options = { authTitle: auth.constants.titles.MinecraftNintendoSwitch, scopes: auth.constants.defaultLiveScopes, flow: "live" }

const flow = new auth.MSAuth("username", cacheManager, options, (code) => {
    console.log(code.userVerificationUrl)
})

flow.getXboxToken().then((xbl) => {
    console.log("Got user XUID:", xbl.userXUID)
})
