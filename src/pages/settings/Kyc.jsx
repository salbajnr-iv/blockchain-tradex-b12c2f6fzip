import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { COUNTRIES } from "@/lib/countries";
import {
  getLatestKycSubmission,
  uploadKycFile,
  submitKycApplication,
  subscribeToKycStatus,
  saveKycDraft,
  loadKycDraft,
  clearKycDraft,
} from "@/lib/api/kyc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from '@/lib/toast';
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock, Upload, ChevronRight,
  ChevronLeft, CheckCircle2, Loader2, FileText, Camera, User,
  Globe, MapPin, Calendar, CreditCard, AlertCircle, Zap, Info,
  Save,
} from "lucide-react";

const STEPS = ["Personal Info", "Document Info", "Upload ID", "Selfie", "Review"];

const DOC_TYPES = [
  { value: "passport",         label: "Passport" },
  { value: "national_id",      label: "National ID" },
  { value: "drivers_license",  label: "Driver's License" },
  { value: "residence_permit", label: "Residence Permit" },
];

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    pending:        { icon: Clock,       color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20", label: "Under Review" },
    under_review:   { icon: Clock,       color: "text-blue-500 bg-blue-500/10 border-blue-500/20",    label: "Being Reviewed" },
    approved:       { icon: ShieldCheck, color: "text-green-500 bg-green-500/10 border-green-500/20", label: "Verified" },
    rejected:       { icon: ShieldX,     color: "text-destructive bg-destructive/10 border-destructive/20", label: "Rejected" },
    more_info_needed:{ icon: AlertCircle,color: "text-orange-500 bg-orange-500/10 border-orange-500/20", label: "More Info Needed" },
  }[status] || { icon: Clock, color: "text-muted-foreground bg-secondary border-border", label: status };

  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

// ── File drop zone ───────────────────────────────────────────────────────────
function FileDropZone({ label, icon: Icon, accept, file, onChange, hint }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onChange(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
        ${dragging ? "border-primary bg-primary/5" : file ? "border-green-500/50 bg-green-500/5" : "border-border/50 hover:border-primary/40 hover:bg-secondary/30"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files[0] && onChange(e.target.files[0])}
      />
      {file ? (
        <div className="space-y-1">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
          <p className="text-sm font-medium text-green-500">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Icon className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <p className="text-xs text-muted-foreground">Drag & drop or click to browse</p>
        </div>
      )}
    </div>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < current ? "bg-primary text-primary-foreground" :
                i === current ? "bg-primary/20 text-primary border-2 border-primary" :
                "bg-secondary text-muted-foreground"}`}>
              {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[10px] font-medium hidden sm:block ${i === current ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 transition-all ${i < current ? "bg-primary" : "bg-border/50"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Existing submission view ─────────────────────────────────────────────────
function SubmissionStatus({ submission, onResubmit }) {
  const [liveStatus, setLiveStatus] = useState(submission.status);
  const [liveNotes, setLiveNotes] = useState(submission.reviewer_notes);
  const [liveReason, setLiveReason] = useState(submission.rejection_reason);

  useEffect(() => {
    const unsub = subscribeToKycStatus(submission.user_id, submission.id, (updated) => {
      setLiveStatus(updated.status);
      setLiveNotes(updated.reviewer_notes);
      setLiveReason(updated.rejection_reason);
      if (updated.status === "approved") toast.success("KYC Approved! Your account is now verified.");
      if (updated.status === "rejected") toast.error("KYC application was rejected. Please review and resubmit.");
    });
    return unsub;
  }, [submission.id, submission.user_id]);

  const timeline = [
    { status: "pending",      label: "Application Submitted",  done: true },
    { status: "under_review", label: "Document Review",        done: ["under_review","approved"].includes(liveStatus) },
    { status: "approved",     label: "Identity Verified",      done: liveStatus === "approved" },
  ];

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">KYC Application</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submitted {new Date(submission.submitted_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={liveStatus} />
            <div className="flex items-center gap-1 text-[10px] text-primary/70 font-medium">
              <Zap className="w-3 h-3" />
              Live
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 space-y-4">
          {timeline.map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-primary/20" : "bg-secondary"}`}>
                {step.done
                  ? <CheckCircle2 className="w-4 h-4 text-primary" />
                  : <div className={`w-2 h-2 rounded-full ${liveStatus === step.status ? "bg-yellow-500 animate-pulse" : "bg-border"}`} />
                }
              </div>
              <div>
                <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                {i === 0 && <p className="text-xs text-muted-foreground">Ref: {submission.id.slice(0, 8).toUpperCase()}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviewer notes — only show for non-terminal statuses, since for rejected/more_info_needed
          the reviewer_notes IS the rejection reason and we show it in the red box below */}
      {liveNotes && !["rejected", "more_info_needed"].includes(liveStatus) && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Reviewer Note</p>
            <p className="text-sm text-muted-foreground mt-1">{liveNotes}</p>
          </div>
        </div>
      )}

      {/* Rejection reason — use reviewer_notes as the rejection reason since that is where
          the admin stores the rejection message via the fn_admin_review_kyc RPC */}
      {(liveStatus === "rejected" || liveStatus === "more_info_needed") && (
        <div className={`border rounded-xl p-4 space-y-3 ${liveStatus === "rejected" ? "bg-destructive/5 border-destructive/20" : "bg-orange-500/5 border-orange-500/20"}`}>
          <div className="flex gap-3">
            <ShieldX className={`w-4 h-4 shrink-0 mt-0.5 ${liveStatus === "rejected" ? "text-destructive" : "text-orange-500"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {liveStatus === "rejected" ? "Application Rejected" : "Additional Information Required"}
              </p>
              {/* Display rejection reason — stored in reviewer_notes by the admin */}
              {(liveReason || liveNotes) && (
                <p className="text-sm text-muted-foreground mt-1">{liveReason || liveNotes}</p>
              )}
            </div>
          </div>
          <Button
            onClick={onResubmit}
            size="sm"
            className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          >
            Submit New Application
          </Button>
        </div>
      )}

      {/* Submitted info */}
      <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Submitted Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Full Name",     value: `${submission.legal_first_name} ${submission.legal_last_name}` },
            { label: "Date of Birth", value: submission.date_of_birth },
            { label: "Nationality",   value: submission.nationality },
            { label: "Country",       value: submission.country },
            { label: "Document Type", value: DOC_TYPES.find(d => d.value === submission.document_type)?.label || submission.document_type },
            { label: "Document No.",  value: submission.document_number ? `****${submission.document_number.slice(-4)}` : "—" },
            { label: "City",          value: submission.city },
            { label: "Postal Code",   value: submission.postal_code },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-sm font-medium text-foreground">{value || "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Draft banner ─────────────────────────────────────────────────────────────
function DraftBanner({ step, onContinue, onDiscard }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1">
        <Save className="w-4 h-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Draft saved</p>
          <p className="text-xs text-muted-foreground">You previously stopped at step {step + 1} of {STEPS.length}. Continue from where you left off.</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={onContinue} className="bg-primary hover:bg-primary/90 text-xs h-8">
          Continue
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} className="text-xs h-8 text-muted-foreground">
          Start over
        </Button>
      </div>
    </div>
  );
}

// ── Main KYC page ────────────────────────────────────────────────────────────
export default function KycSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [forceNew, setForceNew] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftStep, setDraftStep] = useState(0);

  // Form state
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState("intermediate");

  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", dateOfBirth: "", nationality: "",
    addressLine1: "", addressLine2: "", city: "", postalCode: "", country: "",
  });
  const [docInfo, setDocInfo] = useState({
    type: "passport", number: "", country: "", expiry: "",
  });
  const [files, setFiles] = useState({
    idFront: null, idBack: null, selfie: null, address: null,
  });

  // Load draft on mount
  useEffect(() => {
    getLatestKycSubmission()
      .then(setSubmission)
      .catch(() => setSubmission(null))
      .finally(() => setLoading(false));
  }, []);

  // Check for saved draft after user is available
  useEffect(() => {
    if (!user?.id) return;
    const draft = loadKycDraft(user.id);
    if (draft && draft.step > 0) {
      setHasDraft(true);
      setDraftStep(draft.step);
    }
  }, [user?.id]);

  const showForm = forceNew || !submission || ["rejected", "more_info_needed"].includes(submission?.status);
  const showExisting = submission && !forceNew;

  const updatePersonal = (k, v) => setPersonal(p => ({ ...p, [k]: v }));
  const updateDoc = (k, v) => setDocInfo(d => ({ ...d, [k]: v }));
  const updateFile = (k, v) => setFiles(f => ({ ...f, [k]: v }));

  // Save draft whenever step/form data changes
  const persistDraft = (nextStep, personalData, docData) => {
    if (!user?.id) return;
    saveKycDraft(user.id, {
      step: nextStep,
      personal: personalData,
      docInfo: docData,
      savedAt: new Date().toISOString(),
    });
  };

  const handleContinueDraft = () => {
    if (!user?.id) return;
    const draft = loadKycDraft(user.id);
    if (draft) {
      if (draft.personal) setPersonal(draft.personal);
      if (draft.docInfo) setDocInfo(draft.docInfo);
      setStep(draft.step);
    }
    setHasDraft(false);
  };

  const handleDiscardDraft = () => {
    if (user?.id) clearKycDraft(user.id);
    setHasDraft(false);
  };

  const canProceed = () => {
    if (step === 0) return personal.firstName && personal.lastName && personal.dateOfBirth && personal.nationality && personal.country && personal.addressLine1 && personal.city && personal.postalCode;
    if (step === 1) return docInfo.type && docInfo.number && docInfo.country;
    if (step === 2) return files.idFront;
    if (step === 3) return files.selfie;
    return true;
  };

  const handleNext = () => {
    const nextStep = step + 1;
    setStep(nextStep);
    persistDraft(nextStep, personal, docInfo);
  };

  const handleBack = () => {
    const prevStep = step - 1;
    setStep(prevStep);
    persistDraft(prevStep, personal, docInfo);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const uid = user.id;
      const uploaded = { idFront: null, idBack: null, selfie: null, address: null };

      if (files.idFront)  uploaded.idFront  = await uploadKycFile("kyc-documents", uid, files.idFront,  "id_front");
      if (files.idBack)   uploaded.idBack   = await uploadKycFile("kyc-documents", uid, files.idBack,   "id_back");
      if (files.selfie)   uploaded.selfie   = await uploadKycFile("kyc-selfies",   uid, files.selfie,   "selfie");
      if (files.address)  uploaded.address  = await uploadKycFile("kyc-documents", uid, files.address,  "address");

      const result = await submitKycApplication({
        tier: selectedTier,
        personalInfo: personal,
        documentInfo: docInfo,
        filePaths: uploaded,
      });

      clearKycDraft(uid);
      setSubmission(result);
      setForceNew(false);
      setHasDraft(false);
      toast.success("KYC application submitted! We'll review it within 1-3 business days.");
    } catch (err) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Identity Verification (KYC)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Verify your identity to unlock higher withdrawal limits, advanced features, and full platform access.
              Your documents are encrypted and stored securely.
            </p>
            {showForm && (
              <div className="flex flex-wrap gap-2 mt-3">
                <p className="w-full text-xs text-muted-foreground mb-1">Select verification tier:</p>
                {[
                  { value: "basic",        label: "Basic",        desc: "Up to $500/day" },
                  { value: "intermediate", label: "Intermediate", desc: "Up to $10,000/day" },
                  { value: "pro",          label: "Pro",          desc: "Unlimited" },
                ].map(({ value, label, desc }) => {
                  const active = selectedTier === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedTier(value)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all focus:outline-none ${active ? "bg-primary/10 border-primary/30 text-primary ring-1 ring-primary/30" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"}`}
                    >
                      <span className="font-semibold">{label}</span>
                      <span className="ml-1.5 opacity-70">{desc}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!showForm && (
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: "Basic", desc: "Up to $500/day" },
                  { label: "Intermediate", desc: "Up to $10,000/day" },
                  { label: "Pro", desc: "Unlimited" },
                ].map(({ label, desc }) => (
                  <div key={label} className="text-xs px-3 py-1.5 rounded-lg border bg-secondary border-border/50 text-muted-foreground">
                    <span className="font-semibold">{label}</span>
                    <span className="ml-1.5">{desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft banner */}
      {showForm && hasDraft && (
        <DraftBanner
          step={draftStep}
          onContinue={handleContinueDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      {/* Existing submission */}
      {showExisting && (
        <SubmissionStatus
          submission={submission}
          onResubmit={() => { setForceNew(true); setHasDraft(false); }}
        />
      )}

      {/* New application form */}
      {showForm && (
        <div className="bg-card border border-border/50 rounded-xl p-4 sm:p-6">
          <StepIndicator current={step} steps={STEPS} />

          <AnimatePresence mode="wait">
            {/* STEP 0 — Personal Information */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Legal First Name *</label>
                    <Input value={personal.firstName} onChange={e => updatePersonal("firstName", e.target.value)} placeholder="As on ID" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Legal Last Name *</label>
                    <Input value={personal.lastName} onChange={e => updatePersonal("lastName", e.target.value)} placeholder="As on ID" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Date of Birth *</label>
                    <Input type="date" value={personal.dateOfBirth} onChange={e => updatePersonal("dateOfBirth", e.target.value)} className="bg-secondary/50 border-border/50"
                      max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Nationality *</label>
                    <select value={personal.nationality} onChange={e => updatePersonal("nationality", e.target.value)}
                      className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/40">
                      <option value="">Select nationality</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 pt-2">
                  <MapPin className="w-4 h-4" /> Residential Address
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Address Line 1 *</label>
                    <Input value={personal.addressLine1} onChange={e => updatePersonal("addressLine1", e.target.value)} placeholder="Street address" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Address Line 2</label>
                    <Input value={personal.addressLine2} onChange={e => updatePersonal("addressLine2", e.target.value)} placeholder="Apartment, suite, etc." className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">City *</label>
                    <Input value={personal.city} onChange={e => updatePersonal("city", e.target.value)} placeholder="City" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Postal Code *</label>
                    <Input value={personal.postalCode} onChange={e => updatePersonal("postalCode", e.target.value)} placeholder="00000" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Country of Residence *</label>
                    <select value={personal.country} onChange={e => updatePersonal("country", e.target.value)}
                      className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/40">
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 1 — Document Information */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Document Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Document Type *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DOC_TYPES.map(dt => (
                        <button
                          key={dt.value}
                          onClick={() => updateDoc("type", dt.value)}
                          className={`py-2.5 px-3 rounded-lg border text-xs font-medium transition-all text-center ${
                            docInfo.type === dt.value
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Document Number *</label>
                    <Input value={docInfo.number} onChange={e => updateDoc("number", e.target.value)} placeholder="e.g. A12345678" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Expiry Date</label>
                    <Input type="date" value={docInfo.expiry} onChange={e => updateDoc("expiry", e.target.value)} className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Issuing Country *</label>
                    <select value={docInfo.country} onChange={e => updateDoc("country", e.target.value)}
                      className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/40">
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — Upload ID */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Upload ID Document
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileDropZone
                    label="ID Front *"
                    icon={FileText}
                    accept="image/*,.pdf"
                    file={files.idFront}
                    onChange={f => updateFile("idFront", f)}
                    hint="Clear photo of front side"
                  />
                  <FileDropZone
                    label="ID Back"
                    icon={FileText}
                    accept="image/*,.pdf"
                    file={files.idBack}
                    onChange={f => updateFile("idBack", f)}
                    hint="Clear photo of back side"
                  />
                  <div className="sm:col-span-2">
                    <FileDropZone
                      label="Proof of Address"
                      icon={MapPin}
                      accept="image/*,.pdf"
                      file={files.address}
                      onChange={f => updateFile("address", f)}
                      hint="Bank statement or utility bill (last 3 months)"
                    />
                  </div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Accepted formats: JPG, PNG, PDF · Max size: 10MB per file</p>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Selfie */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Selfie Verification
                </h3>
                <div className="max-w-sm">
                  <FileDropZone
                    label="Selfie with ID *"
                    icon={Camera}
                    accept="image/*"
                    file={files.selfie}
                    onChange={f => updateFile("selfie", f)}
                    hint="Hold your ID next to your face"
                  />
                </div>
                <div className="bg-secondary/40 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Tips for a good selfie:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {[
                      "Good lighting — avoid harsh shadows",
                      "Face and ID clearly visible",
                      "No glasses or hats",
                      "Look directly at the camera",
                    ].map(tip => (
                      <li key={tip} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {/* STEP 4 — Review */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Review & Submit
                </h3>
                <div className="space-y-4">
                  <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Name: </span><span className="font-medium">{personal.firstName} {personal.lastName}</span></div>
                      <div><span className="text-muted-foreground">DOB: </span><span className="font-medium">{personal.dateOfBirth || "—"}</span></div>
                      <div><span className="text-muted-foreground">Nationality: </span><span className="font-medium">{personal.nationality || "—"}</span></div>
                      <div><span className="text-muted-foreground">Country: </span><span className="font-medium">{personal.country || "—"}</span></div>
                      <div className="sm:col-span-2"><span className="text-muted-foreground">Address: </span><span className="font-medium">{[personal.addressLine1, personal.city, personal.postalCode].filter(Boolean).join(", ") || "—"}</span></div>
                    </div>
                  </div>
                  <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Type: </span><span className="font-medium capitalize">{docInfo.type.replace("_", " ")}</span></div>
                      <div><span className="text-muted-foreground">Number: </span><span className="font-medium">{docInfo.number ? `****${docInfo.number.slice(-4)}` : "—"}</span></div>
                      <div><span className="text-muted-foreground">Country: </span><span className="font-medium">{docInfo.country || "—"}</span></div>
                      <div><span className="text-muted-foreground">Expiry: </span><span className="font-medium">{docInfo.expiry || "—"}</span></div>
                    </div>
                  </div>
                  <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uploaded Files</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ["ID Front", files.idFront],
                        ["ID Back", files.idBack],
                        ["Selfie", files.selfie],
                        ["Proof of Address", files.address],
                      ].map(([label, file]) => (
                        <div key={label} className="flex items-center gap-1.5">
                          {file
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />}
                          <span className={file ? "text-foreground font-medium" : "text-muted-foreground"}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      By submitting, you confirm all information is accurate and authentic. False information may result in permanent account suspension.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/40">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 0 || submitting}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              {step < STEPS.length - 1 ? (
                <>
                  {step > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        persistDraft(step, personal, docInfo);
                        toast.success("Progress saved. You can continue later.");
                      }}
                      className="gap-1.5 text-muted-foreground text-xs hidden sm:flex"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save & Exit
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="bg-primary hover:bg-primary/90 gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Submit Application
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Step counter */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </div>
      )}
    </div>
  );
}
