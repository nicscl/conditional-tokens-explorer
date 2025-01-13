// Configuration file for quick merge mode
import { NetworkIds } from 'util/types'

export interface WrapConfig {
  tokenName: string
  tokenSymbol: string
  wrappedCollateralTokenAddress: string
}

export interface QuickMergeConfig {
  conditionId: string
  tokenAddress: string
  currencyPositions: {
    yes: {
      positionId: string
      wrap: WrapConfig
    }
    no: {
      positionId: string
      wrap: WrapConfig
    }
  }
  companyPositions?: {
    yes: {
      positionId: string
      wrap: WrapConfig
    }
    no: {
      positionId: string
      wrap: WrapConfig
    }
  }
  description: string
}

export const quickMergeConfigs: { [networkId in NetworkIds]?: QuickMergeConfig[] } = {
  [NetworkIds.XDAI]: [
    {
      conditionId: '0x88853266a44451ff9fc0b8ccdfbb7f61cb1897a27ba8e0136317ff8d99e163db',
      tokenAddress: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
      currencyPositions: {
        yes: {
          positionId: '0xfe0db6706f454cf243baafd54e8234e675536fa2210226f44d52aa6bee70f2d0',
          wrap: {
            tokenName: 'Wrapped ERC-1155',
            tokenSymbol: 'FUTA_Y',
            wrappedCollateralTokenAddress: '0x38eeff6a964ac441b900deb6bf25c85be85a32a0'
          }
        },
        no: {
          positionId: '0xb1e9b3f2b9b813669a81089ee9458ca9453b84f7228cce31e9404de3c33c216e',
          wrap: {
            tokenName: 'Wrapped ERC-1155',
            tokenSymbol: 'FUTA_N',
            wrappedCollateralTokenAddress: '0xb7a36a41a66c87ca12d08823740df71888d8d97a'
          }
        }
      },
      description: 'Currency Token (WXDAI) YES/NO Positions'
    }
  ]
} 