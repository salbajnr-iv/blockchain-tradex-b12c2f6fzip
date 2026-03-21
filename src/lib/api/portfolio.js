import { supabase } from '@/lib/supabaseClient'

export const getPortfolio = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) throw error
  return data
}

export const getHoldings = async (portfolioId) => {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .gt('amount', 0)
    .order('symbol')

  if (error) throw error
  return data ?? []
}

export const upsertHolding = async (portfolioId, { symbol, name, quantity, price, isBuy }) => {
  const { data: existing } = await supabase
    .from('holdings')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('symbol', symbol)
    .maybeSingle()

  if (isBuy) {
    if (existing) {
      const newAmount = existing.amount + quantity
      const newAvgCost = ((existing.amount * existing.average_cost) + (quantity * price)) / newAmount
      const { data, error } = await supabase
        .from('holdings')
        .update({
          amount: newAmount,
          average_cost: newAvgCost,
          current_price: price,
          current_value: newAmount * price,
          gain_loss: (newAmount * price) - (newAmount * newAvgCost),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('holdings')
        .insert({
          portfolio_id: portfolioId,
          symbol,
          name,
          amount: quantity,
          average_cost: price,
          current_price: price,
          current_value: quantity * price,
          gain_loss: 0,
        })
        .select()
        .single()
      if (error) throw error
      return data
    }
  } else {
    if (!existing || existing.amount < quantity) {
      throw new Error('Insufficient holdings to sell')
    }
    const newAmount = existing.amount - quantity
    if (newAmount < 0.000001) {
      const { error } = await supabase.from('holdings').delete().eq('id', existing.id)
      if (error) throw error
      return null
    } else {
      const { data, error } = await supabase
        .from('holdings')
        .update({
          amount: newAmount,
          current_price: price,
          current_value: newAmount * price,
          gain_loss: (newAmount * price) - (newAmount * existing.average_cost),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  }
}

export const createTrade = async (portfolioId, { symbol, name, type, quantity, unitPrice }) => {
  const fees = parseFloat((quantity * unitPrice * 0.001).toFixed(2))
  const netValue = type === 'BUY'
    ? quantity * unitPrice + fees
    : quantity * unitPrice - fees

  const { data, error } = await supabase
    .from('trades')
    .insert({
      portfolio_id: portfolioId,
      symbol,
      name,
      type,
      quantity,
      unit_price: unitPrice,
      fees,
      net_value: netValue,
      status: 'completed',
      trade_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const listTrades = async (portfolioId, limit = 20) => {
  if (!portfolioId) return []
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('trade_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export const updatePortfolioCash = async (portfolioId, newBalance) => {
  const { data, error } = await supabase
    .from('portfolios')
    .update({ cash_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', portfolioId)
    .select()
    .single()

  if (error) throw error
  return data
}

export const executeTrade = async (portfolioId, cashBalance, { symbol, name, type, quantity, unitPrice }) => {
  const fees = parseFloat((quantity * unitPrice * 0.001).toFixed(2))
  const totalCost = type === 'BUY' ? quantity * unitPrice + fees : quantity * unitPrice - fees

  if (type === 'BUY' && totalCost > cashBalance) {
    throw new Error(`Insufficient cash balance. Need $${totalCost.toFixed(2)}, have $${cashBalance.toFixed(2)}`)
  }

  const trade = await createTrade(portfolioId, { symbol, name, type, quantity, unitPrice })

  await upsertHolding(portfolioId, {
    symbol,
    name,
    quantity,
    price: unitPrice,
    isBuy: type === 'BUY',
  })

  const newCash = type === 'BUY'
    ? cashBalance - totalCost
    : cashBalance + (quantity * unitPrice - fees)

  await updatePortfolioCash(portfolioId, newCash)

  return trade
}
