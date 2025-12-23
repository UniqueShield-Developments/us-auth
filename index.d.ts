export const constants: {
    RelyingParties: {
        PCXSTSRelyingParty: string
        BedrockXSTSRelyingParty: string
        PlayfabRelyingParty: string
        XboxAuthRelyingParty: string
        XboxRelyingParty: string
        BedrockRealmsRelyingParty: string
    }

    AuthEndpoints: {
        XboxUserAuth: string
        XboxDeviceAuth: string
        XboxTitleAuth: string
        XstsAuthorize: string
        PlayfabLoginWithXbox: string
        MinecraftSessisonStart: string
        BedrockAuth: string
    }

    titles: {
        MinecraftNintendoSwitch: string
        MinecraftPlaystation: string
        MinecraftAndroid: string
        MinecraftJava: string
        MinecraftIOS: string
        XboxAppIOS: string
        XboxGamepassIOS: string
    }

    defaultLiveScopes: string[]
    defaultMsaScopes: string[]

    xboxLiveErrors: Record<string, string>
}

export interface LiveToken {
    token_type: 'bearer'
    expires_in: number
    scope: string
    access_token: string
    refresh_token: string
    user_id: string
    obtainedOn: number
}

export interface XboxToken {
    userXUID?: string
    userHash: string
    XSTSToken: string
    expiresOn: string
}

export interface PlayfabToken {
    SessionTicket: string
    PlayFabId: string
    NewlyCreated: boolean
    SettingsForUser: {
        NeedsAttribution: boolean
        GatherDeviceInfo: boolean
        GatherFocusInfo: boolean
    }
    LastLoginTime: string
    InfoResultPayload: {
        AccountInfo: {
            PlayFabId: string
            Created: string
            TitleInfo: {
                Origination: string
                Created: string
                LastLogin: string
                FirstLogin: string
                isBanned: boolean
                TitlePlayerAccount: {
                    Id: string
                    Type: string
                    TypeString: string
                }
            }
            PrivateInfo: Record<string, unknown>
            XboxInfo: {
                XboxUserId: string
                XboxUserSandbox: string
            }
        }
        UserInventory: unknown[]
        UserDataVersion: number
        UserReadOnlyDataVersion: number
        CharacterInventories: unknown[]
        PlayerProfile: {
            PublisherId: string
            TitleId: string
            PlayerId: string
        }
    }
    EntityToken: {
        EntityToken: string
        TokenExpiration: string
        Entity: {
            Id: string
            Type: string
            TypeString: string
        }
    }
    TreatmentAssignment: {
        Variants: unknown[]
        Variables: unknown[]
    }
}

export interface MinecraftBedrockToken {
    chain: string[]
    expiresOn: string
}

export interface MinecraftServicesToken {
    token: string
    expiresOn: string
    treatments: string[]
    configurations: {
        minecraft: {
            id: string
            parameters: Record<string, string>
        }
    }
    treatmentContext: string
}

export interface MSAuthOptions {
    flow?: 'live' | 'msal'
    authTitle?: string
    scopes?: string[]
    relyingParty?: string
    forceRefresh?: boolean
}

export class CacheManager {
    constructor(
        save: (key: string, value: string) => Promise<void>,
        load: (key: string) => Promise<string | null>,
        encryptionKey?: string | Buffer
    )

    save(key: string, value: unknown): Promise<void>
    load<T = unknown>(key: string): Promise<T | null>
}

export class MSAuth {
    constructor(
        cacheKey: string,
        cacheManager: CacheManager,
        options?: MSAuthOptions,
        onDeviceCode?: (data: unknown) => void
    )

    getMsaToken(): Promise<LiveToken>

    getXboxToken(
        relyingParty?: string,
        forceRefresh?: boolean
    ): Promise<XboxToken>

    getPlayfabLogin(forceRefresh?: boolean): Promise<PlayfabToken>

    getMinecraftServicesToken(
        forceRefresh?: boolean
    ): Promise<MinecraftServicesToken>

    getMinecraftBedrockToken(
        clientPublicKey: Buffer,
        forceRefresh?: boolean
    ): Promise<MinecraftBedrockToken>
}
