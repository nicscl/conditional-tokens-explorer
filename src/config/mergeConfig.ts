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
          positionId: '0xdaf5c3a4694b339c59f8f531be87a1820a8e334c83d5b5bdcd61e2b8074b08a7',
          wrap: {
            tokenName: 'Hello',
            tokenSymbol: 'WM',
            wrappedCollateralTokenAddress: '0x64ab9162ec35730d28aa1c67ea42634614977c2b'
          }
        }
      },
      description: 'Currency Token (WXDAI) YES/NO Positions'
    }
  ]
} 