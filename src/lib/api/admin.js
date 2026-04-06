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

// ── Call the existing fn_admin_update_withdrawal RPC ─────────────────────────
export const adminUpdateWithdrawal = async (transactionId, status, adminMessage = null) => {
  const { error } = await supabase.rpc('fn_admin_update_withdrawal', {
    p_transaction_id: transactionId,
    p_status: status,
    p_admin_message: adminMessage,
  })
  if (error) throw error
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
    id_document_path: 'kyc-documents',
    id_back_path: 'kyc-documents',
    proof_of_address_path: 'kyc-documents',
    selfie_path: 'kyc-selfies',
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

// ── Call fn_admin_review_kyc RPC ─────────────────────────────────────────────
export const adminReviewKyc = async (submissionId, status, reviewerNotes = null) => {
  const { error } = await supabase.rpc('fn_admin_review_kyc', {
    p_submission_id: submissionId,
    p_status: status,
    p_reviewer_notes: reviewerNotes,
  })
  if (error) throw error
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
}

// ── Update user status (active / suspended) ───────────────────────────────────
export const setUserStatus = async (userId, status) => {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId)

  if (error) throw error
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

  const [pendingWithdrawals, pendingKyc, totalUsers, portfolioSum] = await Promise.all([
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
    totalUsers,
    totalPlatformValue,
  }
}
