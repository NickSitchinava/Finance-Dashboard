import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LockKeyhole,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAuth } from "../components/auth/AuthProvider";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { LabelInput } from "../components/ui/LabelInput";
import { Seek } from "../components/ui/Seek";
import "../components/ui/LabelInput.css";
import "../components/ui/Seek.css";
import { useProfile } from "../components/auth/ProfileContext";
import { useCategoryAssignments } from "../hooks/useCategoryAssignments";
import { supabase } from "../lib/supabase";
import SwipeToast from "../components/ui/SwipeToast";
import "./SettingsPage.css";

type Section = "account" | "security" | "preferences" | "industries";
type Currency = "USD" | "EUR" | "GEL";
const sections = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "industries", label: "Client Industries", icon: Tags },
] as const;
const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾" },
] as const;
const swatches = [
  "#4935A5",
  "#7664CC",
  "#16845E",
  "#2777A5",
  "#A45C87",
  "#B57A35",
  "#52678C",
  "#6B7487",
];
const validSection = (s: string | null): s is Section => sections.some((x) => x.id === s);
const validCurrency = (s: string | null): s is Currency => currencies.some((x) => x.code === s);
const validColor = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function Skeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="settings-skeleton" role="status" aria-label="Loading settings">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="settings-skeleton__row">
          <i />
          <span>
            <b />
            <b />
          </span>
        </div>
      ))}
    </div>
  );
}
function PasswordField({
  label,
  value,
  change,
  autoComplete,
  error,
  shakeToken,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
  autoComplete: string;
  error?: string;
  shakeToken?: number;
}) {
  return <LabelInput field={label} type="password" corner={20}
    value={value} onChange={change} autoComplete={autoComplete} error={error} shakeToken={shakeToken} />;
}
function Dialog({
  title,
  close,
  children,
  locked = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const callbackRef = useRef(close);
  const lockedRef = useRef(locked);
  useEffect(() => {
    callbackRef.current = close;
    lockedRef.current = locked;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lockedRef.current) callbackRef.current();
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled])",
        ) ?? [],
      );
      if (!nodes.length) return;
      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
        e.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="settings-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) close();
      }}
    >
      <div ref={ref} className="settings-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="settings-dialog__head">
          <h2>{title}</h2>
          <button ref={closeRef} onClick={close} disabled={locked} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { avatarUrl, fullName, loading: profileLoading, setAvatarUrl, setFullName } = useProfile();
  const location = useLocation(),
    navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const param = query.get("section") ?? (query.get("tab") === "general" ? "account" : null);
  const active = validSection(param) ? param : "account";
  const [mobileHome, setMobileHome] = useState(!validSection(param));
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
    id: number;
  } | null>(null);
  const notify = (kind: "success" | "error", message: string) =>
    setToast({ kind, message, id: Date.now() });
  const [name, setName] = useState(""),
    [savedName, setSavedName] = useState(""),
    [nameError, setNameError] = useState(""),
    [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false),
    [photoStatus, setPhotoStatus] = useState(""),
    [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(""),
    [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrorField, setPasswordErrorField] = useState<"current" | "new" | "confirm" | "">("");
  const [passwordShakeToken, setPasswordShakeToken] = useState(0);
  const [currency, setCurrency] = useState<Currency>("USD"),
    [savedCurrency, setSavedCurrency] = useState<Currency>("USD");
  const [currencyLoading, setCurrencyLoading] = useState(true),
    [savingCurrency, setSavingCurrency] = useState(false);
  const [search, setSearch] = useState(""),
    [editor, setEditor] = useState<string | null>(null),
    [industryName, setIndustryName] = useState(""),
    [industryColor, setIndustryColor] = useState(swatches[0]);
  const [industryError, setIndustryError] = useState(""),
    [industryBusy, setIndustryBusy] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearStep, setClearStep] = useState(0),
    [clearPassword, setClearPassword] = useState(""),
    [clearError, setClearError] = useState(""),
    [clearing, setClearing] = useState(false);
  const {
    categories,
    assignments,
    loading: industriesLoading,
    fetchAll,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategoryAssignments();
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((x) => map.set(x.category_id, (map.get(x.category_id) ?? 0) + 1));
    return map;
  }, [assignments]);
  const filtered = useMemo(
    () =>
      categories.filter((x) =>
        x.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
    [categories, search],
  );
  const reduceMotion = useReducedMotion();
  const railRef = useRef<HTMLElement>(null);
  const [railHover, setRailHover] = useState({ y: 0, height: 0, visible: false });
  const moveRailHover = (element: HTMLElement) => {
    const rail = railRef.current;
    if (!rail) return;
    const item = element.getBoundingClientRect();
    const parent = rail.getBoundingClientRect();
    setRailHover({ y: item.top - parent.top, height: item.height, visible: true });
  };
  useEffect(() => {
    setName(fullName);
    setSavedName(fullName);
  }, [fullName]);
  useEffect(() => {
    setMobileHome(!validSection(param));
  }, [param]);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("preferred_currency")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        let fallback: string | null = null;
        try {
          fallback = JSON.parse(localStorage.getItem("user_preferences") || "{}").currency;
        } catch {
          /* ignore old malformed preference */
        }
        const next = validCurrency(data?.preferred_currency)
          ? data.preferred_currency
          : validCurrency(fallback)
            ? fallback
            : "USD";
        setCurrency(next);
        setSavedCurrency(validCurrency(data?.preferred_currency) ? data.preferred_currency : "USD");
        setCurrencyLoading(false);
        if (error) notify("error", "Could not load currency preference.");
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  const open = (id: Section) => {
    navigate(`/settings?section=${id}`);
    setMobileHome(false);
  };
  const back = () => {
    navigate("/settings");
    setMobileHome(true);
  };
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next.length > 80) {
      setNameError("Enter a name between 1 and 80 characters.");
      return;
    }
    if (!user || savingName || next === savedName) return;
    setSavingName(true);
    setNameError("");
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: next, updated_at: new Date().toISOString() });
    setSavingName(false);
    if (error) {
      setNameError("Your name could not be saved. Try again.");
      notify("error", "Could not save profile.");
      return;
    }
    setName(next);
    setSavedName(next);
    setFullName(next);
    notify("success", "Profile updated.");
  }
  async function upload(file?: File) {
    if (!file || !user || uploading) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      notify("error", "Choose a JPG, PNG, or WebP image under 2 MB.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setPhotoStatus("Uploading photo…");
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `avatars/${user.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      notify("error", "Photo upload failed. Try again.");
    } else {
      setPhotoStatus("Saving photo…");
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const nextUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: nextUrl, updated_at: new Date().toISOString() });
      if (error) notify("error", "Photo could not be saved. Try again.");
      else {
        setAvatarUrl(nextUrl);
        const old = avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(avatars\/[^?]+)/);
        if (old && old[1].startsWith(`avatars/${user.id}.`) && old[1] !== path) {
          const { error: cleanupError } = await supabase.storage.from("avatars").remove([old[1]]);
          notify(
            cleanupError ? "error" : "success",
            cleanupError
              ? "Photo updated, but its old file could not be removed."
              : "Photo updated.",
          );
        } else notify("success", "Photo updated.");
      }
    }
    setUploading(false);
    setPhotoStatus("");
    URL.revokeObjectURL(objectUrl);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }
  async function removePhoto() {
    if (!user || !avatarUrl || uploading) return;
    setUploading(true);
    setPhotoStatus("Removing photo…");
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) notify("error", "Could not remove photo.");
    else {
      setAvatarUrl("");
      const match = avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(avatars\/[^?]+)/);
      if (match && match[1].startsWith(`avatars/${user.id}.`)) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([match[1]]);
        notify(
          cleanupError ? "error" : "success",
          cleanupError
            ? "Photo removed from your profile, but its stored file could not be removed."
            : "Photo removed.",
        );
      } else notify("success", "Photo removed.");
    }
    setUploading(false);
    setPhotoStatus("");
  }
  function failPassword(field: "current" | "new" | "confirm", message: string) {
    setPasswordErrorField(field);
    setPasswordError(message);
    setPasswordShakeToken(value => value + 1);
  }
  function clearPasswordError(field: "current" | "new" | "confirm") {
    if (passwordErrorField === field) { setPasswordError(""); setPasswordErrorField(""); }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (!currentPassword) { failPassword("current", "Enter your current password."); return; }
    if (!newPassword) { failPassword("new", "Enter a new password."); return; }
    if (!confirmPassword) { failPassword("confirm", "Confirm your new password."); return; }
    if (newPassword === currentPassword) {
      failPassword("new", "Choose a different new password.");
      return;
    }
    if (newPassword.length < 6) {
      failPassword("new", "Use at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      failPassword("confirm", "New passwords do not match.");
      return;
    }
    if (!user?.email || savingPassword) return;
    setSavingPassword(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (authError) {
      failPassword("current", "Current password is incorrect.");
      setSavingPassword(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    setSavingPassword(false);
    if (error) {
      failPassword("new", "Password could not be updated. Check the password requirements and try again.");
      notify("error", "Could not update password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrorField("");
    notify("success", "Password updated.");
  }
  async function saveCurrency() {
    if (!user || savingCurrency || currency === savedCurrency) return;
    setSavingCurrency(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, preferred_currency: currency, updated_at: new Date().toISOString() });
    setSavingCurrency(false);
    if (error) {
      notify("error", "Could not save currency preference.");
      return;
    }
    setSavedCurrency(currency);
    localStorage.setItem("user_preferences", JSON.stringify({ currency }));
    window.dispatchEvent(new Event("f-dash:preferences-changed"));
    notify("success", "Currency preference saved.");
  }
  function openEditor(id: string) {
    const item = categories.find((x) => x.id === id);
    setEditor(id);
    setIndustryName(item?.name ?? "");
    setIndustryColor(item?.color ?? swatches[0]);
    setIndustryError("");
  }
  async function saveIndustry(e: React.FormEvent) {
    e.preventDefault();
    const next = industryName.trim();
    if (!next || next.length > 60) {
      setIndustryError("Enter a name between 1 and 60 characters.");
      return;
    }
    if (!validColor(industryColor)) {
      setIndustryError("Choose a valid color.");
      return;
    }
    if (
      categories.some(
        (x) => x.id !== editor && x.name.toLocaleLowerCase() === next.toLocaleLowerCase(),
      )
    ) {
      setIndustryError("An industry with this name already exists.");
      return;
    }
    if (!editor || industryBusy) return;
    setIndustryBusy(true);
    const success =
      editor === "new"
        ? Boolean(await createCategory(next, industryColor))
        : await updateCategory(editor, next, industryColor);
    setIndustryBusy(false);
    if (!success) {
      setIndustryError("Could not save this industry. Try again.");
      return;
    }
    notify("success", editor === "new" ? "Industry created." : "Industry updated.");
    setEditor(null);
  }
  async function deleteIndustry() {
    if (!deleteId || industryBusy || (counts.get(deleteId) ?? 0) > 0) return;
    setIndustryBusy(true);
    const success = await deleteCategory(deleteId);
    setIndustryBusy(false);
    if (!success) {
      notify("error", "Could not delete this industry.");
      return;
    }
    setDeleteId(null);
    notify("success", "Industry deleted.");
  }
  async function clearData() {
    if (!clearPassword || clearing || clearStep !== 2) return;
    setClearing(true);
    setClearError("");
    const { data, error } = await supabase.functions.invoke("clear-application-data", {
      body: { password: clearPassword },
    });
    setClearing(false);
    if (error || !data?.cleared) {
      const detail = error?.context instanceof Response
        ? await error.context.json().catch(() => null)
        : data;
      setClearError(
        typeof detail?.error === "string"
          ? detail.error
          : "Data could not be cleared. Check your password and try again.",
      );
      return;
    }
    setClearPassword("");
    setClearStep(0);
    await fetchAll();
    window.dispatchEvent(new Event("f-dash:data-cleared"));
    notify("success", "Application data cleared. Your GitHub connection remains active.");
  }
  const closeClear = () => {
    if (clearing) return;
    setClearStep(0);
    setClearPassword("");
    setClearError("");
  };
  return (
    <div className="settings-root">
      <div className="settings-wrap">
        <div className="settings-layout">
          <nav
            ref={railRef}
            className={`settings-rail${railHover.visible ? " is-hovering" : ""}`}
            aria-label="Settings sections"
            onPointerLeave={() => setRailHover((previous) => ({ ...previous, visible: false }))}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setRailHover((previous) => ({ ...previous, visible: false }));
            }}
          >
            <span className="settings-rail__label">Personal settings</span>
            <span
              className="settings-rail__hover"
              style={{
                height: railHover.height,
                transform: `translateY(${railHover.y}px)`,
                opacity: railHover.visible ? 1 : 0,
              }}
              aria-hidden="true"
            />
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => open(item.id)}
                className={active === item.id ? "is-active" : ""}
                aria-current={active === item.id ? "page" : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") moveRailHover(event.currentTarget);
                }}
                onFocus={(event) => moveRailHover(event.currentTarget)}
              >
                <item.icon size={17} strokeWidth={1.9} />
                <span>{item.label}</span>
                <ChevronRight size={15} className="settings-rail__chevron" />
              </button>
            ))}
          </nav>
          <div className="settings-mobile-home">
            <p>Choose a section</p>
            {sections.map((item) => (
              <button type="button" key={item.id} onClick={() => open(item.id)}>
                <span className="settings-mobile-home__icon">
                  <item.icon size={19} />
                </span>
                <span className="settings-mobile-home__text">
                  <strong>{item.label}</strong>
                </span>
                <ChevronRight size={19} />
              </button>
            ))}
          </div>
          <main className={`settings-main${mobileHome ? " settings-main--home" : ""}`}>
            <button className="settings-back" type="button" onClick={back}>
              <ChevronLeft size={18} /> Back to Settings
            </button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.19 }}
              >
                {active === "account" && (
                  <div className="settings-stack">
                    {profileLoading ? (
                      <Skeleton />
                    ) : (
                      <>
                        <section className="settings-panel settings-identity">
                          <div className="settings-avatar">
                            {preview || avatarUrl ? (
                              <img src={preview || avatarUrl} alt="Your profile" />
                            ) : (
                              <span>
                                {(fullName || user?.email || "U").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="settings-identity__copy">
                            <h3>Profile photo</h3>
                            <p>Make your workspace feel like yours.</p>
                            <div className="settings-inline-actions">
                              <button
                                type="button"
                                className="settings-button settings-button--secondary"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                              >
                                <ImagePlus size={16} /> {uploading ? "Working…" : "Upload photo"}
                              </button>
                              {avatarUrl && (
                                <button
                                  type="button"
                                  className="settings-text-button"
                                  onClick={() => void removePhoto()}
                                  disabled={uploading}
                                >
                                  Remove photo
                                </button>
                              )}
                            </div>
                            <small>JPG, PNG, or WebP · up to 2 MB</small>
                            {photoStatus && <p role="status">{photoStatus}</p>}
                          </div>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            onChange={(e) => void upload(e.target.files?.[0])}
                          />
                        </section>
                        <form className="settings-panel settings-form" onSubmit={saveName}>
                          <div className="settings-panel__heading">
                            <h3>Personal information</h3>
                            <p>Your name appears throughout F-Dash.</p>
                          </div>
                          <div className="settings-fields">
                            <label className="settings-field">
                              <span>Full name</span>
                              <input
                                value={name}
                                maxLength={80}
                                onChange={(e) => {
                                  setName(e.target.value);
                                  setNameError("");
                                }}
                                autoComplete="name"
                              />
                              {nameError && <em role="alert">{nameError}</em>}
                            </label>
                            <div className="settings-field">
                              <span>Email address</span>
                              <div className="settings-readonly">
                                {user?.email ?? "—"} <LockKeyhole size={15} />
                              </div>
                              <small>Managed by your account login</small>
                            </div>
                          </div>
                          <div className="settings-actions">
                            <button
                              className="settings-button settings-button--primary"
                              disabled={name.trim() === savedName || !name.trim() || savingName}
                            >
                              {savingName ? "Saving…" : "Save changes"}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                )}
                {active === "security" && (
                  <div className="settings-stack settings-security">
                    <section className="settings-panel settings-form">
                      <div className="settings-panel__heading">
                        <h3>Change password</h3>
                        <p>Choose a unique password to protect your account.</p>
                      </div>
                      <form onSubmit={changePassword}>
                        <div className="settings-fields">
                          <PasswordField
                            label="Current password"
                            value={currentPassword}
                            change={value => { setCurrentPassword(value); clearPasswordError("current"); }}
                            autoComplete="current-password"
                            error={passwordErrorField === "current" ? passwordError : undefined}
                            shakeToken={passwordErrorField === "current" ? passwordShakeToken : 0}
                          />
                          <PasswordField
                            label="New password"
                            value={newPassword}
                            change={value => { setNewPassword(value); clearPasswordError("new"); }}
                            autoComplete="new-password"
                            error={passwordErrorField === "new" ? passwordError : undefined}
                            shakeToken={passwordErrorField === "new" ? passwordShakeToken : 0}
                          />
                          <PasswordField
                            label="Confirm new password"
                            value={confirmPassword}
                            change={value => { setConfirmPassword(value); clearPasswordError("confirm"); }}
                            autoComplete="new-password"
                            error={passwordErrorField === "confirm" ? passwordError : undefined}
                            shakeToken={passwordErrorField === "confirm" ? passwordShakeToken : 0}
                          />
                        </div>
                        <PasswordStrength password={newPassword} guidance />
                        <div className="settings-actions">
                          <button
                            className="settings-button settings-button--primary"
                            disabled={savingPassword}
                          >
                            {savingPassword ? "Updating…" : "Update password"}
                          </button>
                        </div>
                      </form>
                    </section>
                    <section className="settings-panel settings-danger">
                      <div>
                        <h3>Clear application data</h3>
                        <p>
                          Permanently remove saved business, finance, project, and productivity
                          data. Your account, profile, and GitHub connection remain.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="settings-button settings-button--danger-outline"
                        onClick={() => setClearStep(1)}
                      >
                        Clear all data
                      </button>
                    </section>
                  </div>
                )}
                {active === "preferences" && (
                  <section className="settings-panel settings-form">
                    <div className="settings-panel__heading">
                      <h3>Currency preferences</h3>
                      <p>Choose how converted totals appear across your workspace.</p>
                    </div>
                    {currencyLoading ? (
                      <Skeleton rows={1} />
                    ) : (
                      <>
                        <label className="settings-field settings-currency">
                          <span>Primary currency</span>
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as Currency)}
                          >
                            {currencies.map((x) => (
                              <option key={x.code} value={x.code}>
                                {x.code} · {x.name} ({x.symbol})
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="settings-note">
                          Financial totals use recorded currencies and available exchange rates.
                          Original amounts and invoice currencies stay intact.
                        </p>
                        <div className="settings-actions">
                          <button
                            className="settings-button settings-button--primary"
                            type="button"
                            disabled={savingCurrency || currency === savedCurrency}
                            onClick={() => void saveCurrency()}
                          >
                            {savingCurrency ? "Saving…" : "Save preferences"}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
                {active === "industries" && (
                  <section className="settings-panel settings-industries">
                    <div className="settings-industries__heading">
                      <div>
                        <h3>Client industries</h3>
                        <p>Classify your clients with a name and color.</p>
                      </div>
                      <button
                        type="button"
                        className="settings-button settings-button--primary"
                        onClick={() => openEditor("new")}
                      >
                        Add industry
                      </button>
                    </div>
                    <div className="settings-search">
                      <Seek width={280} height={39} ariaLabel="Search industries" placeholder="Search industries" value={search} onChange={setSearch} />
                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch("")}
                          aria-label="Clear search"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {industriesLoading ? (
                      <Skeleton rows={3} />
                    ) : filtered.length ? (
                      <ul className="settings-industry-list">
                        {filtered.map((x) => (
                          <li key={x.id}>
                            <span
                              className="settings-industry-color"
                              style={{ background: validColor(x.color) ? x.color : swatches[0] }}
                            />
                            <strong title={x.name}>{x.name}</strong>
                            <span className="settings-industry-count">
                              {counts.get(x.id) ?? 0} client
                              {(counts.get(x.id) ?? 0) === 1 ? "" : "s"}
                            </span>
                            <div className="settings-industry-actions">
                              <button
                                type="button"
                                onClick={() => openEditor(x.id)}
                                aria-label={`Edit ${x.name}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteId(x.id)}
                                aria-label={`Delete ${x.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="settings-empty">
                        <Tags size={24} />
                        <h4>{search ? "No matching industries" : "No industries yet"}</h4>
                        <p>
                          {search
                            ? "Try a different search."
                            : "Create your first industry to organize your clients."}
                        </p>
                        {!search && (
                          <button
                            type="button"
                            className="settings-button settings-button--secondary"
                            onClick={() => openEditor("new")}
                          >
                            Add industry
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      {toast &&
        createPortal(
          <div className="app-toast-viewport" aria-label="Notifications">
            <SwipeToast
              key={toast.id}
              kind={toast.kind}
              message={toast.message}
              onClose={() => setToast(null)}
            />
          </div>,
          document.body,
        )}
      {editor && (
        <Dialog
          title={editor === "new" ? "Add industry" : "Edit industry"}
          close={() => setEditor(null)}
        >
          <form className="settings-dialog__body" onSubmit={saveIndustry}>
            <label className="settings-field">
              <span>Industry name</span>
              <input
                value={industryName}
                maxLength={60}
                onChange={(e) => {
                  setIndustryName(e.target.value);
                  setIndustryError("");
                }}
                placeholder="e.g. Technology"
              />
            </label>
            <div className="settings-field">
              <span>Industry color</span>
              <div className="settings-swatches">
                {swatches.map((color) => (
                  <button
                    type="button"
                    key={color}
                    style={{ background: color }}
                    className={
                      industryColor.toLowerCase() === color.toLowerCase() ? "is-selected" : ""
                    }
                    onClick={() => setIndustryColor(color)}
                    aria-label={`Choose ${color}`}
                    aria-pressed={industryColor.toLowerCase() === color.toLowerCase()}
                  />
                ))}
                <label
                  className={`settings-custom-color${!swatches.some((color) => color.toLowerCase() === industryColor.toLowerCase()) ? " is-selected" : ""}`}
                  title="Choose custom color"
                >
                  <Palette size={18} aria-hidden="true" />
                  <input
                    type="color"
                    value={validColor(industryColor) ? industryColor : swatches[0]}
                    onChange={(e) => setIndustryColor(e.target.value)}
                    aria-label="Choose custom color"
                  />
                </label>
              </div>
            </div>
            <div className="settings-industry-preview">
              <i style={{ background: industryColor }} />
              <span>{industryName.trim() || "Industry preview"}</span>
            </div>
            {industryError && (
              <p className="settings-error" role="alert">
                {industryError}
              </p>
            )}
            <div className="settings-dialog__actions">
              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-button settings-button--primary"
                disabled={industryBusy}
              >
                {industryBusy ? "Saving…" : "Save industry"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleteId && (
        <Dialog title="Delete industry?" close={() => setDeleteId(null)}>
          <div className="settings-dialog__body">
            <p>
              {(counts.get(deleteId) ?? 0) > 0
                ? `This industry is assigned to ${counts.get(deleteId)} client(s). Reassign or unassign those clients before deleting it.`
                : "This industry has no assigned clients. Deleting it cannot be undone."}
            </p>
            <div className="settings-dialog__actions">
              <button
                className="settings-button settings-button--secondary"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              {(counts.get(deleteId) ?? 0) === 0 && (
                <button
                  className="settings-button settings-button--danger"
                  disabled={industryBusy}
                  onClick={() => void deleteIndustry()}
                >
                  {industryBusy ? "Deleting…" : "Delete industry"}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {clearStep > 0 && (
        <Dialog
          title={clearStep === 1 ? "Clear all application data?" : "This is your final chance"}
          locked={clearing}
          close={closeClear}
        >
          <div className="settings-dialog__body">
            <p>
              {clearStep === 1
                ? "This permanently removes your clients, projects, finances, invoices, goals, and other saved dashboard records. Your account, GitHub connection, email, password, profile, and preferences remain intact."
                : "Once confirmed, this data cannot be recovered. Enter your current password to authorize the operation."}
            </p>
            {clearStep === 2 && (
              <label className="settings-field">
                <span>Current password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={clearPassword}
                  onChange={(e) => setClearPassword(e.target.value)}
                />
              </label>
            )}
            {clearError && (
              <p className="settings-error" role="alert">
                {clearError}
              </p>
            )}
            <div className="settings-dialog__actions">
              <button
                type="button"
                className="settings-button settings-button--secondary"
                disabled={clearing}
                onClick={() => (clearStep === 2 ? setClearStep(1) : closeClear())}
              >
                {clearStep === 2 ? "Go back" : "Cancel"}
              </button>
              {clearStep === 1 ? (
                <button
                  type="button"
                  className="settings-button settings-button--danger-outline"
                  onClick={() => setClearStep(2)}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="settings-button settings-button--danger"
                  disabled={!clearPassword || clearing}
                  onClick={() => void clearData()}
                >
                  {clearing ? "Clearing…" : "Permanently clear data"}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
