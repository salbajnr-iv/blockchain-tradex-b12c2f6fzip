import { supabase } from '@/lib/supabaseClient'

export const getPortfolio = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing, error: fetchError } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing) return existing

  // Auto-create portfolio for new users
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  const { data: created, error: createError } = await supabase
    .from('portfolios')
    .insert({
      user_id: user.id,
      name: `${fullName}'s Portfolio`,
      cash_balance: 0,
      total_value: 0,
    })
    .select()
    .single()

  if (createError) throw createError
  return created
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

// All cash_balance updates now go through SECURITY DEFINER RPC functions.
// Users cannot directly UPDATE cash_balance via the REST API.
export const updatePortfolioCash = async (portfolioId, newBalance) => {
  const { data, error } = await supabase
    .rpc('fn_update_cash_after_trade', {
      p_portfolio_id: portfolioId,
      p_new_balance:  newBalance,
    })

  if (error) throw error
  if (!data.success) throw new Error(data.error || 'Failed to update cash balance')
  return data
}

export const executeTrade = async (portfolioId, cashBalance, { symbol, name, type, quantity, unitPrice }) => {
  const fees = parseFloat((quantity * unitPrice * 0.001).toFixed(2))
  const totalCost = type === 'BUY' ? quantity * unitPrice + fees : 0

  if (type === 'BUY' && totalCost > cashBalance) {
    throw new Error(`Insufficient cash. Need $${totalCost.toFixed(2)}, have $${cashBalance.toFixed(2)}`)
  }

  const trade = await createTrade(portfolioId, { symbol, name, type, quantity, unitPrice })

  await upsertHolding(portfolioId, {
    symbol,
    name,
    quantity,
    price: unitPrice,
    isBuy: type === 'BUY',
  })

  const sellProceeds = quantity * unitPrice - parseFloat((quantity * unitPrice * 0.001).toFixed(2))
  const newCash = type === 'BUY'
    ? cashBalance - totalCost
    : cashBalance + sellProceeds

  await updatePortfolioCash(portfolioId, parseFloat(newCash.toFixed(2)))

  // Log to transactions table for analytics/history (non-blocking)
  supabase
    .from('transactions')
    .insert({
      portfolio_id: portfolioId,
      type,
      symbol,
      quantity,
      price_per_unit: unitPrice,
      total_amount: parseFloat((quantity * unitPrice).toFixed(2)),
      status: 'completed',
      transaction_date: new Date().toISOString(),
      notes: `${type} ${quantity} ${symbol} @ $${unitPrice.toLocaleString()}`,
    })
    .then(({ error }) => {
      if (error) console.warn('Trade transaction log error:', error.message)
    })

  return trade
}
