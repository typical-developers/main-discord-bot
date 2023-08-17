export interface Universe {
    universeId: number | null
}

export interface AgeRecommendation {
    ageRecommendationDetails: {
        summary: {
            ageRecommendation: {
                displayName: string
                minimumAe: number
            }
        }
        descriptorUsages: {
            name: string
            followsComplianceApi: boolean
            descriptor: {
                name: string
                displayName: string
                complianceApiSupported: boolean
                iconUrl: string
            }
            descriptorDimensionUsages: []
            contains: boolean
        }[]
    }
    contentLanuage: string
}

export interface Badge {
    id: number
    name: string
    description: string
    imageUrl: string
}

export type Badges = Badge[];

export interface User {
    description: string
    created: string
    isBanned: boolean
    externalAppDisplayName: string | null
    hasVerifiedBadge: boolean
    id: number
    name: string
    displayName: string
}