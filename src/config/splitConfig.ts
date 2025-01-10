// Configuration file for quick split mode
import { NetworkIds } from 'util/types'

export interface QuickSplitConfig {
  conditionId: string
  tokenAddress: string
  outcomes: string[]
  description: string
}

export const quickSplitConfigs: Record<NetworkIds, QuickSplitConfig[]> = {
  [NetworkIds.MAINNET]: [],
  [NetworkIds.RINKEBY]: [],
  [NetworkIds.GANACHE]: [],
  [NetworkIds.XDAI]: [
    {
      conditionId: '0x88853266a44451ff9fc0b8ccdfbb7f61cb1897a27ba8e0136317ff8d99e163db',
      tokenAddress: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
      outcomes: ['Yes', 'No'],
      description: 'Newtokw Gnosis Chain',
    },
  ],
} 