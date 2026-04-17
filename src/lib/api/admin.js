import { supabase } from '@/lib/supabaseClient'

// ── Check if the current user is an admin ───────────────────────────────────
export const getAdminStatus = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.is_admin === true
}

// ── Helper: fetch users by IDs ───────────────────────────────────────────────
const fetchUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return {}
  const unique = [...new Set(userIds)]
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, username')
    .in('id', unique)
  if (error) throw error
  const map = {}
  ;(data ?? []).forEach(u => { map[u.id] = u })
  return map
}

// ── Helper: fetch portfolios by IDs ──────────────────────────────────────────
const fetchPortfoliosByIds = async (portfolioIds) => {
  if (!portfolioIds || portfolioIds.length === 0) return {}
  const unique = [...new Set(portfolioIds)]
  const { data, error } = await supabase
    .from('portfolios')
    .select('id, user_id, cash_balance, total_value')
    .in('id', unique)
  if (error) throw error
  const map = {}
  ;(data ?? []).forEach(p => { map[p.id] = p })
  return map
}

// ── Audit log: write an entry (fire-and-forget, never throws) ─────────────────
export const logAdminAction = async (action, targetType, targetId, details = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: adminUser } = await supabase
      .from('users')
      .select('email, full_name, username')
      .eq('id', user.id)
      .single()

    await supabase.from('admin_audit_log').insert({
      admin_id:    user.id,
      admin_email: adminUser?.email ?? user.email ?? null,
      admin_name:  adminUser?.full_name ?? adminUser?.username ?? null,
      action,
      target_type: targetType,
      target_id:   targetId ? String(targetId) : null,
      details,
    })
  } catch {
    // Never let audit logging break the main flow
  }
}

// ── Fetch audit log (admin only) ──────────────────────────────────────────────
export const getAuditLog = async (limit = 100, offset = 0) => {
  const { data, error, count } = await supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return { logs: data ?? [], total: count ?? 0 }
}

// ── Fetch all pending withdrawal transactions (admin only) ───────────────────
export const getPendingWithdrawals = async () => {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'WITHDRAWAL')
    .eq('status', 'pending')
    .order('transaction_date', { ascending: false })

  if (error) throw error
  if (!txs || txs.length === 0) return []

  const portfolioIds = txs.map(t => t.portfolio_id).filter(Boolean)
  const portfolioMap = await fetchPortfoliosByIds(portfolioIds)

  const userIds = Object.values(portfolioMap).map(p => p.user_id).filter(Boolean)
  const userMap = await fetchUsersByIds(userIds)

  return txs.map(tx => {
    const portfolio = portfolioMap[tx.portfolio_id] ?? null
    const user = portfolio ? (userMap[portfolio.user_id] ?? null) : null
    return {
      ...tx,
      portfolios: portfolio ? { ...portfolio, users: user } : null,
    }
  })
}

// ── Fetch ALL withdrawal transactions (admin only) ────────────────────────────
export const getAllWithdrawals = async () => {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'WITHDRAWAL')
    .order('transaction_date', { ascending: false })

  if (error) throw error
  if (!txs || txs.length === 0) return []

  const portfolioIds = txs.map(t => t.portfolio_id).filter(Boolean)
  const portfolioMap = await fetchPortfoliosByIds(portfolioIds)

  const userIds = Object.values(portfolioMap).map(p => p.user_id).filter(Boolean)
  const userMap = await fetchUsersByIds(userIds)

  return txs.map(tx => {
    const portfolio = portfolioMap[tx.portfolio_id] ?? null
    const user = portfolio ? (userMap[portfolio.user_id] ?? null) : null
    return {
      ...tx,
      portfolios: portfolio ? { ...portfolio, users: user } : null,
    }
  })
}

// ── Helper: refund portfolio cash_balance when a withdrawal is rejected ────────
const refundBalanceDirect = async (transactionId) => {
  try {
    const { data: tx } = await supabase
      .from('transactions')
      .select('portfolio_id, total_amount')
      .eq('id', transactionId)
      .single()

    if (!tx?.portfolio_id || !tx?.total_amount) return

    // Try RPC first
    const { error: rpcErr } = await supabase.rpc('fn_admin_adjust_balance', {
      p_portfolio_id: tx.portfolio_id,
      p_operation:    'add',
      p_amount:       Number(tx.total_amount),
      p_note:         'Withdrawal rejected — balance refunded',
    })

    if (rpcErr) {
      // Fallback: read current balance then increment
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('cash_balance')
        .eq('id', tx.portfolio_id)
        .single()

      if (portfolio) {
        await supabase
          .from('portfolios')
          .update({ cash_balance: (Number(portfolio.cash_balance) || 0) + Number(tx.total_amount) })
          .eq('id', tx.portfolio_id)
      }
    }
  } catch {
    // Swallow — refund is best-effort; admin can adjust manually if needed
  }
}

// ── Approve or reject a withdrawal ───────────────────────────────────────────
export const adminUpdateWithdrawal = async (transactionId, status, adminMessage = null) => {
  const actionKey = status === 'completed' ? 'withdrawal_approved' : 'withdrawal_rejected'
  const isRejected = status === 'rejected'

  // 1. Try the RPC first (works when withdrawal-migration.sql has been applied)
  const { error: rpcError } = await supabase.rpc('fn_admin_update_withdrawal', {
    p_transaction_id: transactionId,
    p_status: status,
    p_admin_message: adminMessage,
  })

  if (!rpcError) {
    if (isRejected) await refundBalanceDirect(transactionId)
    await logAdminAction(actionKey, 'withdrawal', transactionId, { status, admin_message: adminMessage })
    return
  }

  // 2. Fallback: direct update with extended columns (requires migration + is_admin RLS)
  const { data: { user } } = await supabase.auth.getUser()

  const { data: fullUpdate, error: fullError } = await supabase
    .from('transactions')
    .update({
      status,
      admin_message: adminMessage,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq('id', transactionId)
    .eq('type', 'WITHDRAWAL')
    .select('id')

  if (!fullError) {
    if (!fullUpdate || fullUpdate.length === 0) {
      throw new Error(
        'Permission denied — 0 rows updated. Ensure your account has is_admin = true and the admin RLS policies are applied.'
      )
    }
    if (isRejected) await refundBalanceDirect(transactionId)
    await logAdminAction(actionKey, 'withdrawal', transactionId, { status, admin_message: adminMessage, fallback: 'full' })
    return
  }

  // 3. Last-resort fallback: update only the status column (no migration columns needed)
  //    This works as long as the admin can write to transactions via any existing RLS policy.
  const isColumnError = fullError.code === '42703' || fullError.message?.toLowerCase().includes('column')
  if (!isColumnError) {
    throw new Error(`Could not update withdrawal: ${fullError.message}`)
  }

  const { data: minUpdate, error: minError } = await supabase
    .from('transactions')
    .update({ status })
    .eq('id', transactionId)
    .eq('type', 'WITHDRAWAL')
    .select('id')

  if (minError) throw new Error(`Could not update withdrawal: ${minError.message}`)

  if (!minUpdate || minUpdate.length === 0) {
    throw new Error(
      'Permission denied — 0 rows updated. Run sql/withdrawal-migration.sql in your Supabase SQL Editor and ensure is_admin = true.'
    )
  }

  if (isRejected) await refundBalanceDirect(transactionId)
  await logAdminAction(actionKey, 'withdrawal', transactionId, { status, admin_message: adminMessage, fallback: 'minimal' })
}

// ── Fetch all pending KYC submissions (admin only) ───────────────────────────
export const getPendingKycSubmissions = async () => {
  const { data: submissions, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

  if (error) throw error
  if (!submissions || submissions.length === 0) return []

  const userIds = submissions.map(s => s.user_id).filter(Boolean)
  const userMap = await fetchUsersByIds(userIds)

  return submissions.map(s => ({
    ...s,
    users: userMap[s.user_id] ?? null,
  }))
}

// ── Fetch all KYC submissions (admin only) ────────────────────────────────────
export const getAllKycSubmissions = async () => {
  const { data: submissions, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) throw error
  if (!submissions || submissions.length === 0) return []

  const userIds = submissions.map(s => s.user_id).filter(Boolean)
  const userMap = await fetchUsersByIds(userIds)

  return submissions.map(s => ({
    ...s,
    users: userMap[s.user_id] ?? null,
  }))
}

// ── Get signed URLs for KYC document files ────────────────────────────────────
export const getKycDocumentUrls = async (submission) => {
  const bucketMap = {
    id_document_path:      'kyc-documents',
    id_back_path:          'kyc-documents',
    proof_of_address_path: 'kyc-documents',
    selfie_path:           'kyc-selfies',
  }

  const urls = {}
  await Promise.all(
    Object.entries(bucketMap).map(async ([field, bucket]) => {
      const path = submission[field]
      if (!path) return
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60)
      if (!error && data?.signedUrl) urls[field] = data.signedUrl
    })
  )
  return urls
}

// ── Call fn_admin_review_kyc RPC (with direct-update fallback) ───────────────
export const adminReviewKyc = async (submissionId, status, reviewerNotes = null) => {
  // Tier 1: try the dedicated RPC
  const { error: rpcError } = await supabase.rpc('fn_admin_review_kyc', {
    p_submission_id: submissionId,
    p_status: status,
    p_reviewer_notes: reviewerNotes,
  })

  if (rpcError) {
    // Tier 2: direct table update fallback
    const now = new Date().toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateError } = await supabase
      .from('kyc_submissions')
      .update({
        status,
        reviewer_notes: reviewerNotes,
        reviewed_at: now,
        reviewed_by: user?.id ?? null,
        updated_at: now,
      })
      .eq('id', submissionId)

    if (updateError) {
      throw new Error(
        `KYC review failed. Please run sql/kyc-admin-review.sql in your Supabase SQL Editor, then try again. (${updateError.message})`
      )
    }

    // If approved, also update the user's kyc_verified flag
    if (status === 'approved') {
      const { data: submission } = await supabase
        .from('kyc_submissions')
        .select('user_id, tier')
        .eq('id', submissionId)
        .single()

      if (submission?.user_id) {
        await supabase
          .from('users')
          .update({
            kyc_verified: true,
            kyc_tier: submission.tier ?? 1,
          })
          .eq('id', submission.user_id)
      }
    }
  }

  const actionType =
    status === 'approved' ? 'kyc_approved' :
    status === 'more_info_needed' ? 'kyc_more_info_needed' :
    'kyc_rejected'
  await logAdminAction(
    actionType,
    'kyc_submission',
    submissionId,
    { status, reviewer_notes: reviewerNotes }
  )
}

// ── List all registered users (admin only) ───────────────────────────────────
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, username, kyc_tier, kyc_verified, status, is_admin, created_at, last_login')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Toggle admin flag on a user ──────────────────────────────────────────────
export const setUserAdminFlag = async (userId, isAdmin) => {
  const { error } = await supabase
    .from('users')
    .update({ is_admin: isAdmin })
    .eq('id', userId)

  if (error) throw error

  await logAdminAction(
    isAdmin ? 'user_promoted_to_admin' : 'user_demoted_from_admin',
    'user',
    userId,
    { is_admin: isAdmin }
  )
}

// ── Update user status (active / suspended) ───────────────────────────────────
export const setUserStatus = async (userId, status) => {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId)

  if (error) throw error

  await logAdminAction('user_status_changed', 'user', userId, { status })
}

// ── List all users WITH their portfolio balance ───────────────────────────────
export const getAllUsersWithBalances = async () => {
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, username, kyc_tier, kyc_verified, status, is_admin, created_at, last_login')
    .order('created_at', { ascending: false })

  if (usersError) throw usersError
  if (!users || users.length === 0) return []

  const userIds = users.map(u => u.id)
  const { data: portfolios, error: portfoliosError } = await supabase
    .from('portfolios')
    .select('id, user_id, cash_balance, total_value, balance_locked, balance_locked_reason, balance_locked_at')
    .in('user_id', userIds)

  if (portfoliosError) throw portfoliosError

  const portfolioByUserId = {}
  ;(portfolios ?? []).forEach(p => { portfolioByUserId[p.user_id] = p })

  return users.map(u => ({
    ...u,
    portfolio: portfolioByUserId[u.id] ?? null,
  }))
}

// ── Admin: add, deduct, or set a user's cash balance via RPC ─────────────────
export const adminAdjustBalance = async (portfolioId, operation, amount, note) => {
  const { data, error } = await supabase.rpc('fn_admin_adjust_balance', {
    p_portfolio_id: portfolioId,
    p_operation: operation,
    p_amount: Number(amount),
    p_note: note,
  })
  if (error) throw error

  await logAdminAction('balance_adjusted', 'portfolio', portfolioId, {
    operation,
    amount: Number(amount),
    note,
  })

  return data
}

// ── Admin: lock or unlock a user's balance ────────────────────────────────────
export const adminLockBalance = async (portfolioId, locked, reason = null) => {
  const { error } = await supabase.rpc('fn_admin_lock_balance', {
    p_portfolio_id: portfolioId,
    p_locked: locked,
    p_reason: reason,
  })
  if (error) throw error

  await logAdminAction(
    locked ? 'balance_locked' : 'balance_unlocked',
    'portfolio',
    portfolioId,
    { locked, reason }
  )
}

// ── Admin dashboard stats ─────────────────────────────────────────────────────
export const getAdminDashboardStats = async () => {
  const safeCount = async (query) => {
    try {
      const { count, error } = await query
      if (error) return 0
      return count ?? 0
    } catch {
      return 0
    }
  }

  const safeData = async (query) => {
    try {
      const { data, error } = await query
      if (error) return []
      return data ?? []
    } catch {
      return []
    }
  }

  const [pendingWithdrawals, pendingKyc, pendingDeposits, totalUsers, portfolioSum] = await Promise.all([
    safeCount(
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'WITHDRAWAL')
        .eq('status', 'pending')
    ),
    safeCount(
      supabase
        .from('kyc_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
    ),
    safeCount(
      supabase
        .from('deposits')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'under_review'])
    ),
    safeCount(
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
    ),
    safeData(
      supabase
        .from('portfolios')
        .select('cash_balance, total_value')
    ),
  ])

  const totalPlatformValue = portfolioSum.reduce(
    (sum, p) => sum + (Number(p.cash_balance) || 0) + (Number(p.total_value) || 0),
    0
  )

  return {
    pendingWithdrawals,
    pendingKyc,
    pendingDeposits,
    totalUsers,
    totalPlatformValue,
  }
}

// ── Admin analytics: time-series data for charts (last 30 days) ───────────────
const groupByDay = (items, dateField, valueField = null) => {
  const result = {}
  items.forEach(item => {
    const raw = item[dateField]
    if (!raw) return
    const day = raw.split('T')[0]
    if (!result[day]) result[day] = 0
    result[day] += valueField ? (Number(item[valueField]) || 0) : 1
  })
  return result
}

const fillDays = (dataMap, days = 30) => {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    result.push({ date: key, label: key.slice(5), value: dataMap[key] || 0 })
  }
  return result
}

export const getAdminAnalytics = async (days = 30) => {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)
  const since = sinceDate.toISOString()

  const safe = async (fn) => {
    try { return await fn() } catch { return [] }
  }

  const [signups, trades, withdrawals] = await Promise.all([
    safe(() =>
      supabase
        .from('users')
        .select('created_at')
        .gte('created_at', since)
        .then(r => r.data ?? [])
    ),
    safe(() =>
      supabase
        .from('transactions')
        .select('transaction_date, total_amount, fee_amount, type')
        .in('type', ['BUY', 'SELL'])
        .gte('transaction_date', since)
        .then(r => r.data ?? [])
    ),
    safe(() =>
      supabase
        .from('transactions')
        .select('transaction_date, total_amount, status')
        .eq('type', 'WITHDRAWAL')
        .gte('transaction_date', since)
        .then(r => r.data ?? [])
    ),
  ])

  const signupsByDay  = groupByDay(signups,  'created_at')
  const volumeByDay   = groupByDay(trades,   'transaction_date', 'total_amount')
  const revenueByDay  = groupByDay(trades,   'transaction_date', 'fee_amount')

  const withdrawalsByDay = {}
  const withdrawalsPendingByDay = {}
  withdrawals.forEach(w => {
    const day = (w.transaction_date || '').split('T')[0]
    if (!day) return
    withdrawalsByDay[day] = (withdrawalsByDay[day] || 0) + 1
    if (w.status === 'pending') {
      withdrawalsPendingByDay[day] = (withdrawalsPendingByDay[day] || 0) + 1
    }
  })

  const signupsSeries      = fillDays(signupsByDay, days)
  const volumeSeries       = fillDays(volumeByDay, days)
  const revenueSeries      = fillDays(revenueByDay, days)
  const withdrawalsSeries  = fillDays(withdrawalsByDay, days).map((d, i) => ({
    ...d,
    pending: withdrawalsPendingByDay[d.date] || 0,
  }))

  const totalVolume  = volumeSeries.reduce((s, d) => s + d.value, 0)
  const totalRevenue = revenueSeries.reduce((s, d) => s + d.value, 0)
  const totalSignups = signupsSeries.reduce((s, d) => s + d.value, 0)
  const totalWithdrawals = withdrawalsSeries.reduce((s, d) => s + d.value, 0)

  return {
    signups: signupsSeries,
    volume: volumeSeries,
    revenue: revenueSeries,
    withdrawals: withdrawalsSeries,
    totals: { totalVolume, totalRevenue, totalSignups, totalWithdrawals },
  }
}

// ── Platform settings: read all ───────────────────────────────────────────────
export const getPlatformSettings = async () => {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .order('key')

  if (error) throw error

  const map = {}
  ;(data ?? []).forEach(row => { map[row.key] = row })
  return map
}

// ── Bank details: read ────────────────────────────────────────────────────────
export const getBankDetails = async () => {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['bank_details_usd', 'bank_details_eur', 'bank_details_gbp'])

  if (error) return {}
  const result = {}
  ;(data ?? []).forEach(row => {
    const currency = row.key.replace('bank_details_', '').toUpperCase()
    try {
      result[currency] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
    } catch {
      result[currency] = {}
    }
  })
  return result
}

// ── Bank details: save one currency ──────────────────────────────────────────
export const saveBankDetails = async (currency, fields) => {
  const key = `bank_details_${currency.toLowerCase()}`
  await updatePlatformSetting(key, fields)
}

// ── Leaderboard: fetch real user portfolio data ───────────────────────────────
export const getRealLeaderboardUsers = async () => {
  try {
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select('user_id, cash_balance, total_value')
      .order('total_value', { ascending: false })
      .limit(50)

    if (error || !portfolios?.length) return []

    const userIds = portfolios.map(p => p.user_id).filter(Boolean)
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, username, country, created_at')
      .in('id', userIds)

    const userMap = {}
    ;(users ?? []).forEach(u => { userMap[u.id] = u })

    const AVATARS = ['🐯','🦊','🐺','🦁','🐻','🦅','🐉','🦄','🦋','🐧','🦜','🐸','🦩','🦒','🐳']
    const FLAGS = { 'United States':'🇺🇸','United Kingdom':'🇬🇧','Germany':'🇩🇪','Japan':'🇯🇵','Singapore':'🇸🇬','Australia':'🇦🇺','Canada':'🇨🇦','South Korea':'🇰🇷','France':'🇫🇷','Netherlands':'🇳🇱' }

    return portfolios.map((p, i) => {
      const u = userMap[p.user_id] ?? {}
      const portfolio = (p.total_value ?? 0) + (p.cash_balance ?? 0)
      const displayName = u.full_name
        ? u.full_name.split(' ').map((n, idx) => idx === 0 ? n : n[0] + '.').join(' ')
        : u.username ?? 'Trader'
      const joinedMs = u.created_at ? Date.now() - new Date(u.created_at).getTime() : 0
      const joinedDaysAgo = Math.floor(joinedMs / 86400000)
      return {
        id: `real_${p.user_id}`,
        isReal: true,
        isMock: false,
        name: u.username ?? `trader_${i + 1}`,
        displayName,
        avatar: AVATARS[i % AVATARS.length],
        badge: portfolio > 1_000_000 ? '🦈 Whale' : portfolio > 100_000 ? '💎 Diamond' : null,
        portfolio: Math.round(portfolio),
        totalProfit: 0,
        profitPct: 0,
        winRate: 0,
        trades: 0,
        country: FLAGS[u.country] ?? '🌍',
        joinedDaysAgo,
      }
    })
  } catch {
    return []
  }
}

// ── Platform settings: update one key ─────────────────────────────────────────
export const updatePlatformSetting = async (key, value) => {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: 'key' })

  if (error) throw new Error(`Could not update setting "${key}": ${error.message}`)

  await logAdminAction('setting_updated', 'platform_setting', key, { key, value })
}
