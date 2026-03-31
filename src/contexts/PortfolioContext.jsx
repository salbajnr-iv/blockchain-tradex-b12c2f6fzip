import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getPortfolio, getHoldings } from '@/lib/api/portfolio'
import { supabase } from '@/lib/supabaseClient'

const PortfolioContext = createContext(null)

export function PortfolioProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [portfolio, setPortfolio] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchPortfolioData = useCallback(async () => {
    if (!isAuthenticated) {
      setPortfolio(null)
      setHoldings([])
      return
    }
    try {
      setIsLoading(true)
      const p = await getPortfolio()
      setPortfolio(p)
      const h = await getHoldings(p.id)
      setHoldings(h)
    } catch (err) {
      console.error('Portfolio fetch error:', err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchPortfolioData()
  }, [fetchPortfolioData, user?.id])

  // Realtime: refetch when portfolio or holdings change in DB
  useEffect(() => {
    if (!portfolio?.id) return

    const portfolioChannel = supabase
      .channel(`realtime:portfolio:${portfolio.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'portfolios',
        filter: `id=eq.${portfolio.id}`,
      }, () => fetchPortfolioData())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'holdings',
        filter: `portfolio_id=eq.${portfolio.id}`,
      }, () => fetchPortfolioData())
      .subscribe()

    return () => supabase.removeChannel(portfolioChannel)
  }, [portfolio?.id, fetchPortfolioData])

  const holdingsMap = holdings.reduce((acc, h) => {
    acc[h.symbol] = h
    return acc
  }, {})

  return (
    <PortfolioContext.Provider value={{
      portfolio,
      portfolioId: portfolio?.id ?? null,
      cashBalance: portfolio?.cash_balance ?? 0,
      holdings,
      holdingsMap,
      isLoading,
      refetch: fetchPortfolioData,
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export const usePortfolio = () => {
  const context = useContext(PortfolioContext)
  if (!context) throw new Error('usePortfolio must be used within a PortfolioProvider')
  return context
}
