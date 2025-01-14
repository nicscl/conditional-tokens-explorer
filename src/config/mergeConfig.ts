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
            tokenSymbol: 'WXDAI_Y',
            wrappedCollateralTokenAddress: '0x0be6c1fe39625742e143d6ea6d7cb79bf54c163b'
          }
        },
        no: {
          positionId: '0xb1e9b3f2b9b813669a81089ee9458ca9453b84f7228cce31e9404de3c33c216e',
          wrap: {
            tokenName: 'Wrapped ERC-1155',
            tokenSymbol: 'WXDAI_N',
            wrappedCollateralTokenAddress: '0xca1b610382b8754b4ead5a40ceed77b7b318aa75'
          }
        }
      },
      companyPositions: {
        yes: {
          positionId: '0x2ebc7de49d8ec2aca79a2b9121d2a8a15cded64a34354cfc7ed3dd57e254a90a',
          wrap: {
            tokenName: 'FAOT_Y0001',
            tokenSymbol: 'FAOT_Y0001',
            wrappedCollateralTokenAddress: '0xbdb45c49fa8b792d33839281ca6a493b371b5df5'
          }
        },
        no: {
          positionId: '0x506953f395ad09099f1e17c78dce0bb461bba439718ac90656e084eb03faceb5',
          wrap: {
            tokenName: 'FAOT_N0001',
            tokenSymbol: 'FAOT_N0001',
            wrappedCollateralTokenAddress: '0x26ad330dbcaefea13ce050f5e630accaf486ea75'
          }
        }
      },
      description: 'Currency and Company Token Positions'
    }
  ]
} 