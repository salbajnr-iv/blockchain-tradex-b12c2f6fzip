import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  getLatestKycSubmission,
  uploadKycFile,
  submitKycApplication,
  subscribeToKycStatus,
} from "@/lib/api/kyc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock, Upload, ChevronRight,
  ChevronLeft, CheckCircle2, Loader2, FileText, Camera, User,
  Globe, MapPin, Calendar, CreditCard, AlertCircle, Zap, Info,
} from "lucide-react";

const STEPS = ["Personal Info", "Document Info", "Upload ID", "Selfie", "Review"];

const DOC_TYPES = [
  { value: "passport",         label: "Passport" },
  { value: "national_id",      label: "National ID" },
  { value: "drivers_license",  label: "Driver's License" },
  { value: "residence_permit", label: "Residence Permit" },
];

const COUNTRIES = [
  "Algeria","Angola","Australia","Benin","Botswana","Brazil","Burkina Faso",
  "Burundi","Cabo Verde","Cameroon","Canada","Central African Republic","Chad",
  "Comoros","Congo (Republic)","Congo (Democratic Republic)","Denmark",
  "Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia",
  "France","Gabon","Gambia","Germany","Ghana","Guinea","Guinea-Bissau",
  "Hong Kong","India","Israel","Ivory Coast","Japan","Kenya","Lesotho",
  "Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius",
  "Morocco","Mozambique","Namibia","Netherlands","New Zealand","Niger",
  "Nigeria","Norway","Rwanda","São Tomé and Príncipe","Senegal","Seychelles",
  "Sierra Leone","Singapore","Somalia","South Africa","South Korea",
  "South Sudan","Spain","Sudan","Sweden","Switzerland","Tanzania","Togo",
  "Tunisia","Uganda","United Arab Emirates","United Kingdom","United States",
  "Zambia","Zimbabwe",
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

      {/* Reviewer notes */}
      {liveNotes && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Reviewer Note</p>
            <p className="text-sm text-muted-foreground mt-1">{liveNotes}</p>
          </div>
        </div>
      )}

      {/* Rejection reason */}
      {(liveStatus === "rejected" || liveStatus === "more_info_needed") && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
          <div className="flex gap-3">
            <ShieldX className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {liveStatus === "rejected" ? "Application Rejected" : "Additional Information Required"}
              </p>
              {liveReason && <p className="text-sm text-muted-foreground mt-1">{liveReason}</p>}
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

// ── Main KYC page ────────────────────────────────────────────────────────────
export default function KycSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [forceNew, setForceNew] = useState(false);

  // Form state
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    getLatestKycSubmission()
      .then(setSubmission)
      .catch(() => setSubmission(null))
      .finally(() => setLoading(false));
  }, []);

  const showForm = forceNew || !submission || ["rejected", "more_info_needed"].includes(submission?.status);
  const showExisting = submission && !forceNew;

  const updatePersonal = (k, v) => setPersonal(p => ({ ...p, [k]: v }));
  const updateDoc = (k, v) => setDocInfo(d => ({ ...d, [k]: v }));
  const updateFile = (k, v) => setFiles(f => ({ ...f, [k]: v }));

  const canProceed = () => {
    if (step === 0) return personal.firstName && personal.lastName && personal.dateOfBirth && personal.nationality && personal.country && personal.addressLine1 && personal.city && personal.postalCode;
    if (step === 1) return docInfo.type && docInfo.number && docInfo.country;
    if (step === 2) return files.idFront;
    if (step === 3) return files.selfie;
    return true;
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
        tier: "intermediate",
        personalInfo: personal,
        documentInfo: docInfo,
        filePaths: uploaded,
      });

      setSubmission(result);
      setForceNew(false);
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
            <div className="flex flex-wrap gap-4 mt-3">
              {[
                { label: "Basic", desc: "Up to $500/day" },
                { label: "Intermediate", desc: "Up to $10,000/day", active: true },
                { label: "Pro", desc: "Unlimited" },
              ].map(({ label, desc, active }) => (
                <div key={label} className={`text-xs px-3 py-1.5 rounded-lg border ${active ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border/50 text-muted-foreground"}`}>
                  <span className="font-semibold">{label}</span>
                  <span className="ml-1.5">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Existing submission */}
      {showExisting && (
        <SubmissionStatus
          submission={submission}
          onResubmit={() => setForceNew(true)}
        />
      )}

      {/* New application form */}
      {showForm && (
        <div className="bg-card border border-border/50 rounded-xl p-6">
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
                    <Input type="date" value={docInfo.expiry} onChange={e => updateDoc("expiry", e.target.value)}
                      min={new Date().toISOString().split("T")[0]} className="bg-secondary/50 border-border/50" />
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
                <div className="bg-secondary/30 rounded-lg p-4 flex gap-3">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Make sure all document details match exactly as they appear on your ID. Mismatches may cause rejection.
                    All data is encrypted at rest with AES-256.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — Upload ID */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Upload Identity Documents
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload clear, well-lit photos of your {DOC_TYPES.find(d => d.value === docInfo.type)?.label}.
                  Accepted formats: JPG, PNG, PDF — max 10MB each.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileDropZone
                    label="ID Front *"
                    icon={FileText}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    file={files.idFront}
                    onChange={(f) => updateFile("idFront", f)}
                    hint="Clear photo of the front side"
                  />
                  {docInfo.type !== "passport" && (
                    <FileDropZone
                      label="ID Back"
                      icon={FileText}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      file={files.idBack}
                      onChange={(f) => updateFile("idBack", f)}
                      hint="Clear photo of the back side"
                    />
                  )}
                  <FileDropZone
                    label="Proof of Address (optional)"
                    icon={MapPin}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    file={files.address}
                    onChange={(f) => updateFile("address", f)}
                    hint="Utility bill or bank statement (last 3 months)"
                  />
                </div>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-xs font-semibold text-foreground mb-2">Tips for a successful submission:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Ensure all four corners of the document are visible</li>
                    <li>Make sure text is readable and not blurry</li>
                    <li>Avoid glare, shadows, and reflections</li>
                    <li>Do not edit or crop the image</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Selfie */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Liveness Selfie
                </h3>
                <p className="text-sm text-muted-foreground">
                  Take or upload a clear selfie to confirm you are the owner of the document.
                  Max file size: 5MB.
                </p>
                <div className="max-w-sm mx-auto">
                  <FileDropZone
                    label="Upload Selfie *"
                    icon={Camera}
                    accept="image/jpeg,image/png,image/webp"
                    file={files.selfie}
                    onChange={(f) => updateFile("selfie", f)}
                    hint="Face clearly visible, good lighting"
                  />
                </div>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-xs font-semibold text-foreground mb-2">Selfie requirements:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Face fully visible and centered</li>
                    <li>No sunglasses or face coverings</li>
                    <li>Good, even lighting — no harsh shadows</li>
                    <li>Plain or neutral background preferred</li>
                    <li>Photo should be recent (taken today)</li>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal</p>
                    {[
                      { label: "Name",      value: `${personal.firstName} ${personal.lastName}` },
                      { label: "DOB",       value: personal.dateOfBirth },
                      { label: "Nationality", value: personal.nationality },
                      { label: "Country",   value: personal.country },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value || "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document</p>
                    {[
                      { label: "Type",    value: DOC_TYPES.find(d => d.value === docInfo.type)?.label },
                      { label: "Number",  value: docInfo.number ? `****${docInfo.number.slice(-4)}` : "—" },
                      { label: "Expiry",  value: docInfo.expiry || "—" },
                      { label: "Country", value: docInfo.country || "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sm:col-span-2 bg-secondary/30 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Files</p>
                    {[
                      { label: "ID Front",         file: files.idFront,  required: true },
                      { label: "ID Back",          file: files.idBack,   required: false },
                      { label: "Selfie",           file: files.selfie,   required: true },
                      { label: "Proof of Address", file: files.address,  required: false },
                    ].map(({ label, file, required }) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{label}{required && " *"}</span>
                        {file
                          ? <span className="text-green-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {file.name}</span>
                          : <span className="text-muted-foreground">{required ? "Missing" : "Not provided"}</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 flex gap-3">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    By submitting, you confirm that all information is accurate and the documents are genuine.
                    False submissions may result in permanent account suspension. Review takes 1–3 business days.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/30">
            <Button
              variant="outline"
              onClick={() => step > 0 ? setStep(s => s - 1) : setForceNew(false)}
              className="border-border/50 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="bg-primary hover:bg-primary/90"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 min-w-32"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                {submitting ? "Submitting…" : "Submit Application"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
