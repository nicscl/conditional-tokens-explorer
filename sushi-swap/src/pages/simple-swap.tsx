import type { NextPage } from 'next'
import { useActiveWeb3React } from 'app/services/web3'
import SwapAssetPanel from 'app/features/trident/swap/SwapAssetPanel'
import { Field } from 'app/state/swap/actions'
import { useDerivedSwapInfo, useSwapState } from 'app/state/swap/hooks'
import Web3Connect from 'app/components/Web3Connect'
import Button from 'app/components/Button'

const SimpleSwap: NextPage = () => {
  const { account } = useActiveWeb3React()
  const { currencies, inputError: swapInputError } = useDerivedSwapInfo()
  const { independentField, typedValue } = useSwapState()

  return (
    <div className="flex flex-col gap-3 p-2 md:p-4 pt-4 rounded-[24px] bg-dark-800">
      <SwapAssetPanel
        header={() => null}
        spendFromWallet={true}
        currency={currencies[Field.INPUT]}
        value={independentField === Field.INPUT ? typedValue : ''}
        onChange={() => {}}
        onSelect={() => {}}
      />
      <div className="z-0 flex justify-center -mt-6 -mb-6">
        <div role="button" className="p-1.5 rounded-full bg-dark-800 border shadow-md border-dark-700 hover:border-dark-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="14" className="text-high-emphesis hover:text-white">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
        </div>
      </div>
      <SwapAssetPanel
        header={() => null}
        spendFromWallet={true}
        currency={currencies[Field.OUTPUT]}
        value={independentField === Field.OUTPUT ? typedValue : ''}
        onChange={() => {}}
        onSelect={() => {}}
      />
      {!account ? (
        <Web3Connect className="w-full" />
      ) : (
        <Button disabled={!!swapInputError} color="blue" className="w-full">
          {swapInputError || 'Swap'}
        </Button>
      )}
    </div>
  )
}

export default SimpleSwap
