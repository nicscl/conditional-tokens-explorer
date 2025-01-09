import { FC, ReactElement } from 'react'

const SwapLayoutCard: FC = ({ children }): ReactElement => <>{children}</>
SwapLayoutCard.displayName = 'SwapLayoutCard'

const Layout: FC = ({ children }): ReactElement => <>{children}</>
Layout.displayName = 'Layout'

const SwapLayout = () => {
  const LayoutComponent: FC = ({ children }): ReactElement => <>{children}</>
  LayoutComponent.displayName = 'SwapLayout'
  return LayoutComponent
}

export { SwapLayout, Layout, SwapLayoutCard }
