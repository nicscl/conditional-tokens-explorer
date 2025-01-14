import { NetworkIds } from 'util/types'

export interface SpotMarketConfig {
  conditionId: string
  tokenAddress: string // WXDAI address
  currencyPositions: {
    yes: string
    no: string
  }
  wrappedPositions: {
    yes: string
    no: string
  }
  companyToken: {
    address: string // FAOT address
  }
  description: string
}

export const spotMarketConfigs: { [networkId in NetworkIds]?: SpotMarketConfig[] } = {
  [NetworkIds.XDAI]: [
    {
      conditionId: '0x88853266a44451ff9fc0b8ccdfbb7f61cb1897a27ba8e0136317ff8d99e163db',
      tokenAddress: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
      currencyPositions: {
        yes: '0xfe0db6706f454cf243baafd54e8234e675536fa2210226f44d52aa6bee70f2d0',
        no: '0xb1e9b3f2b9b813669a81089ee9458ca9453b84f7228cce31e9404de3c33c216e'
      },
      wrappedPositions: {
        yes: '0x1234567890123456789012345678901234567890', // Replace with actual wrapped token addresses
        no: '0x0987654321098765432109876543210987654321'
      },
      companyToken: {
        address: '0x81f41228357d9F17fA04bCF712905543127bE821' // FAOT token address
      },
      description: 'Currency Token (WXDAI) YES/NO Positions'
    }
  ]
} 