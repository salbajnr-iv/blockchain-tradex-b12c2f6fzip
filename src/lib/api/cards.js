const CARD_STORAGE_KEY = 'bt_virtual_card';

function generateCardNumber() {
  return '4532' + Array(12).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
}

function generateExpiryDate() {
  const year = new Date().getFullYear() + 5;
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `${month}/${year.toString().slice(-2)}`;
}

function generateCVV() {
  return String(Math.floor(Math.random() * 900) + 100);
}

export const getOrCreateCard = (userId, fullName) => {
  const storageKey = `${CARD_STORAGE_KEY}_${userId}`;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through to create
    }
  }
  const card = {
    id: crypto.randomUUID(),
    card_holder: fullName || 'User',
    card_number: generateCardNumber(),
    expiry_date: generateExpiryDate(),
    cvv: generateCVV(),
    balance: 45000,
    card_type: 'premium',
    is_active: true,
    daily_limit: 5000000,
    spending_today: 2000000,
  };
  localStorage.setItem(storageKey, JSON.stringify(card));
  return card;
};
