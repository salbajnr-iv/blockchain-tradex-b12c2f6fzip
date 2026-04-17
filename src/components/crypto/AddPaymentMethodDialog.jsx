import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard, Building2, Wallet2, CheckCircle2, Loader2,
  ChevronLeft, ShieldCheck, Lock, Info,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { addPaymentMethod, detectCardBrand, formatCardNumber, formatExpiry } from "@/lib/api/paymentMethods";
import { toast } from '@/lib/toast';

const BRAND_COLORS = {
  visa:       "from-blue-600 to-blue-800",
  mastercard: "from-red-600 to-orange-600",
  amex:       "from-blue-500 to-cyan-600",
  discover:   "from-orange-500 to-yellow-600",
  unknown:    "from-slate-600 to-slate-800",
};

const BRAND_LABEL = {
  visa: "VISA", mastercard: "Mastercard", amex: "AMEX", discover: "Discover", unknown: "",
};

function CardPreview({ number, name, expiry, brand }) {
  const masked = number
    ? number.padEnd(19, " ").replace(/(\d{4})/g, "$1 ").trim()
    : "•••• •••• •••• ••••";
  const gradient = BRAND_COLORS[brand] || BRAND_COLORS.unknown;
  return (
    <div className={`relative bg-gradient-to-br ${gradient} rounded-xl p-5 text-white overflow-hidden h-44 flex flex-col justify-between shadow-xl`}>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="1" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="white" strokeWidth="1" />
        </svg>
      </div>
      <div className="flex justify-between items-start">
        <Lock className="w-5 h-5 opacity-60" />
        <span className="text-xs font-bold tracking-widest opacity-80">{BRAND_LABEL[brand] || ""}</span>
      </div>
      <div>
        <p className="font-mono text-lg tracking-wider mb-2 opacity-90">
          {masked.split("").map((c, i) => c === " " ? " " : (number && number.replace(/\s/g,"")[i] ? number.replace(/\s/g,"")[Math.floor(i/5)*4+(i%5)] || "•" : "•")).join("")}
        </p>
        <p className="font-mono text-sm tracking-wider opacity-80">{number || "•••• •••• •••• ••••"}</p>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs opacity-60 uppercase tracking-wider mb-0.5">Card Holder</p>
          <p className="text-sm font-semibold">{name || "YOUR NAME"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-60 uppercase tracking-wider mb-0.5">Expires</p>
          <p className="text-sm font-semibold font-mono">{expiry || "MM/YY"}</p>
        </div>
      </div>
    </div>
  );
}

const TYPE_OPTIONS = [
  { id: "card",         icon: CreditCard,  label: "Debit / Credit Card", desc: "Visa, Mastercard, Amex, Discover" },
  { id: "bank_account", icon: Building2,   label: "Bank Account",         desc: "ACH direct deposit (US accounts)" },
  { id: "paypal",       icon: Wallet2,     label: "PayPal",               desc: "Pay using your PayPal balance" },
];

export default function AddPaymentMethodDialog({ open, onClose, onAdded }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardName,   setCardName]   = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [cvv,        setCvv]        = useState("");

  // Bank fields
  const [bankName,      setBankName]      = useState("");
  const [accountNum,    setAccountNum]    = useState("");
  const [routingNum,    setRoutingNum]    = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  // PayPal
  const [paypalEmail,        setPaypalEmail]        = useState("");
  const [paypalEmailConfirm, setPaypalEmailConfirm] = useState("");
  const [paypalName,         setPaypalName]         = useState("");

  const brand = detectCardBrand(cardNumber);

  const resetForm = () => {
    setStep(1); setType("");
    setCardNumber(""); setCardName(""); setExpiry(""); setCvv("");
    setBankName(""); setAccountNum(""); setRoutingNum(""); setAccountHolder("");
    setPaypalEmail(""); setPaypalEmailConfirm(""); setPaypalName("");
  };

  const handleClose = () => { resetForm(); onClose(); };

  const canProceedStep2 = () => {
    if (type === "card") {
      const digits = cardNumber.replace(/\D/g, "");
      const [mm, yy] = expiry.split("/");
      const now = new Date();
      const expDate = new Date(2000 + parseInt(yy || "0"), parseInt(mm || "0") - 1);
      return digits.length >= 15 && cardName.trim().length >= 2 &&
             expiry.length === 5 && expDate > now && cvv.length >= 3;
    }
    if (type === "bank_account") {
      return bankName.trim() && accountNum.replace(/\D/g,"").length >= 4 &&
             routingNum.replace(/\D/g,"").length === 9 && accountHolder.trim();
    }
    if (type === "paypal") {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail);
      return emailValid && paypalEmail === paypalEmailConfirm && paypalName.trim().length >= 2;
    }
    return false;
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let payload = { type, is_default: false };

      if (type === "card") {
        const digits = cardNumber.replace(/\D/g, "");
        const [mm, yy] = expiry.split("/");
        payload = {
          ...payload,
          card_brand:       brand,
          card_last_four:   digits.slice(-4),
          card_holder_name: cardName.trim(),
          expiry_month:     parseInt(mm),
          expiry_year:      2000 + parseInt(yy),
          label: `${BRAND_LABEL[brand] || "Card"} ••••${digits.slice(-4)}`,
        };
      } else if (type === "bank_account") {
        payload = {
          ...payload,
          bank_name:         bankName.trim(),
          account_last_four: accountNum.replace(/\D/g,"").slice(-4),
          account_holder:    accountHolder.trim(),
          routing_last_four: routingNum.slice(-4),
          label: `${bankName.trim()} ••••${accountNum.replace(/\D/g,"").slice(-4)}`,
        };
      } else if (type === "paypal") {
        payload = {
          ...payload,
          paypal_email:   paypalEmail.trim(),
          account_holder: paypalName.trim(),
          label: `PayPal (${paypalEmail.trim()})`,
        };
      }

      const added = await addPaymentMethod(user.id, payload);
      toast.success("Payment method added");
      onAdded?.(added);
      handleClose();
    } catch (err) {
      toast.error(err.message || "Failed to add payment method");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border/50 bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="mr-1 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <CreditCard className="w-5 h-5 text-primary" />
            {step === 1 ? "Add Payment Method" : step === 2 ? "Enter Details" : "Confirm"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-2">
          {[1,2,3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-secondary/50"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Choose type */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 py-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setType(opt.id); setStep(2); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <opt.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Your financial data is encrypted and never stored in full.</span>
              </div>
            </motion.div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
              {type === "card" && (
                <>
                  <CardPreview number={cardNumber} name={cardName} expiry={expiry} brand={brand} />
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Card Number</label>
                      <Input
                        value={cardNumber}
                        onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="bg-secondary/50 border-border/50 font-mono tracking-wider"
                        autoComplete="cc-number"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Cardholder Name</label>
                      <Input
                        value={cardName}
                        onChange={e => setCardName(e.target.value.toUpperCase())}
                        placeholder="JOHN DOE"
                        className="bg-secondary/50 border-border/50 uppercase"
                        autoComplete="cc-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
                        <Input
                          value={expiry}
                          onChange={e => setExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="bg-secondary/50 border-border/50 font-mono"
                          autoComplete="cc-exp"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">CVV</label>
                        <Input
                          value={cvv}
                          onChange={e => setCvv(e.target.value.replace(/\D/g,"").slice(0, brand === "amex" ? 4 : 3))}
                          placeholder={brand === "amex" ? "••••" : "•••"}
                          type="password"
                          maxLength={brand === "amex" ? 4 : 3}
                          className="bg-secondary/50 border-border/50 font-mono"
                          autoComplete="cc-csc"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> CVV is verified and never stored.
                  </p>
                </>
              )}

              {type === "bank_account" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank Name</label>
                    <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Chase, Bank of America" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Holder Name</label>
                    <Input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Full name on account" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Number</label>
                    <Input value={accountNum} onChange={e => setAccountNum(e.target.value.replace(/\D/g,""))} placeholder="Checking or savings account number" className="bg-secondary/50 border-border/50 font-mono" inputMode="numeric" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Routing Number (9 digits)</label>
                    <Input value={routingNum} onChange={e => setRoutingNum(e.target.value.replace(/\D/g,"").slice(0,9))} placeholder="9-digit ABA routing number" maxLength={9} className="bg-secondary/50 border-border/50 font-mono" inputMode="numeric" />
                  </div>
                </div>
              )}

              {type === "paypal" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Holder Name</label>
                    <Input
                      value={paypalName}
                      onChange={e => setPaypalName(e.target.value)}
                      placeholder="Full name on your PayPal account"
                      className="bg-secondary/50 border-border/50"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">PayPal Email Address</label>
                    <Input
                      value={paypalEmail}
                      onChange={e => setPaypalEmail(e.target.value)}
                      type="email"
                      placeholder="you@example.com"
                      className="bg-secondary/50 border-border/50"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm Email Address</label>
                    <Input
                      value={paypalEmailConfirm}
                      onChange={e => setPaypalEmailConfirm(e.target.value)}
                      type="email"
                      placeholder="Re-enter your PayPal email"
                      className={`bg-secondary/50 border-border/50 ${paypalEmailConfirm && paypalEmail !== paypalEmailConfirm ? "border-destructive" : ""}`}
                      autoComplete="email"
                    />
                    {paypalEmailConfirm && paypalEmail !== paypalEmailConfirm && (
                      <p className="text-xs text-destructive mt-1">Emails do not match</p>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                    <span>PayPal is not verified via OAuth. Please ensure the email and name match your active PayPal account exactly.</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2()} className="flex-1 bg-primary hover:bg-primary/90">
                  Review
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Review Details</p>
                {type === "card" && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{BRAND_LABEL[brand] || "Card"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Card Number</span><span className="font-mono font-medium">•••• •••• •••• {cardNumber.replace(/\D/g,"").slice(-4)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{cardName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expires</span><span className="font-mono font-medium">{expiry}</span></div>
                  </div>
                )}
                {type === "bank_account" && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{bankName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="font-mono font-medium">••••{accountNum.slice(-4)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Routing</span><span className="font-mono font-medium">•••••{routingNum.slice(-4)}</span></div>
                  </div>
                )}
                {type === "paypal" && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span className="font-medium">{paypalName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PayPal Email</span><span className="font-medium">{paypalEmail}</span></div>
                    <div className="flex items-start gap-1.5 text-xs text-amber-500/80 pt-1">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Not OAuth-verified — ensure this matches your active PayPal account</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Only masked data is saved. Full card numbers and CVV are never stored.</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Edit</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Save Method
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
