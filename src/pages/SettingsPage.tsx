import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../components/auth/AuthProvider";
import { useProfile } from "../components/auth/ProfileContext";
import { supabase } from "../lib/supabase";
import { useCategoryAssignments } from "../hooks/useCategoryAssignments";
import "./SettingsPage.css";

type TabType = "general" | "security" | "preferences" | "categories";

const PRESET_COLORS = [
  "#E87B3A", "#34C759", "#3296FA", "#FF453A",
  "#A450FF", "#FFD60A", "#00C7BE", "#FF9F0A",
  "#BF5AF2", "#32ADE6", "#FF6961", "#8A8A9A",
];

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const TagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.remove("light-mode");
  } else {
    document.documentElement.classList.add("light-mode");
  }
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { avatarUrl, fullName, setAvatarUrl, setFullName } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const [localName, setLocalName] = useState(fullName);
  const [bio, setBio] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [darkMode, setDarkMode] = useState(true);
  const [showGitHub, setShowGitHub] = useState(true);
  const [notifications, setNotifications] = useState({
    account: true,
    projects: true,
    marketing: false,
  });

  const {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    getClientsCountForCategory,
  } = useCategoryAssignments();

  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatColor, setEditingCatColor] = useState("");
  const [catError, setCatError] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error && error.code !== "PGRST116") console.error(error);
      if (data) {
        setLocalName(data.full_name || "");
        setBio(data.bio || "");
      }
    }
    fetchProfile();

    const savedPrefs = localStorage.getItem("user_preferences");
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      const isDark = prefs.darkMode !== undefined ? prefs.darkMode : true;
      setCurrency(prefs.currency || "USD");
      setDarkMode(isDark);
      setShowGitHub(prefs.showGitHub !== undefined ? prefs.showGitHub : true);
      setNotifications(prefs.notifications || { account: true, projects: true, marketing: false });
      applyTheme(isDark);
    }
  }, [user]);

  useEffect(() => { setLocalName(fullName); }, [fullName]);

  function showMessage(text: string, type: "success" | "error") {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { showMessage("File must be under 2MB.", "error"); return; }
    setUploadingPhoto(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `avatars/${user.id}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) { showMessage(uploadError.message, "error"); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() });
    setAvatarUrl(publicUrl);
    showMessage("Photo updated!", "success");
    setUploadingPhoto(false);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: localName, bio, updated_at: new Date().toISOString() });
    setLoading(false);
    if (error) { showMessage(error.message, "error"); } else { setFullName(localName); showMessage("Profile updated successfully!", "success"); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) { showMessage("New passwords do not match.", "error"); return; }
    if (newPassword.length < 6) { showMessage("Password must be at least 6 characters.", "error"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { showMessage(error.message, "error"); } else { showMessage("Password updated successfully!", "success"); setNewPassword(""); setConfirmNewPassword(""); }
  }

  function handleSavePreferences() {
    const prefs = { currency, darkMode, showGitHub, notifications };
    localStorage.setItem("user_preferences", JSON.stringify(prefs));
    applyTheme(darkMode);
    showMessage("Preferences saved!", "success");
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) { setCatError("Name is required."); return; }
    if (categories.some((c) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      setCatError("A category with this name already exists.");
      return;
    }
    setCatLoading(true);
    setCatError("");
    const result = await createCategory(newCatName.trim(), newCatColor);
    setCatLoading(false);
    if (!result) { setCatError("Failed to create category."); return; }
    setNewCatName("");
    setNewCatColor(PRESET_COLORS[0]);
  }

  async function handleUpdateCategory(id: string) {
    if (!editingCatName.trim()) return;
    setCatLoading(true);
    await updateCategory(id, editingCatName, editingCatColor);
    setCatLoading(false);
    setEditingCatId(null);
  }

  async function handleDeleteCategory(id: string) {
    setCatLoading(true);
    await deleteCategory(id);
    setCatLoading(false);
    setDeletingCatId(null);
  }

  return (
    <div className="page">
      <div className="settings-page">
        <aside className="settings-nav">
          <ul className="settings-nav__list">
            {(
              [
                { id: "general", label: "General", Icon: UserIcon },
                { id: "security", label: "Security", Icon: LockIcon },
                { id: "preferences", label: "Preferences", Icon: GearIcon },
                { id: "categories", label: "Categories", Icon: TagIcon },
              ] as { id: TabType; label: string; Icon: () => React.ReactElement }[]
            ).map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  className={`settings-nav__btn${activeTab === id ? " settings-nav__btn--active" : ""}`}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="settings-content">
          {message.text && (
            <div className={`modal-alert ${message.type === "error" ? "modal-alert--error" : "modal-alert--success"} settings-message`}>
              {message.text}
            </div>
          )}

          {activeTab === "general" && (
            <div className="settings-section">
              <div className="settings-card">
                <h3 className="settings-card__title">Profile Information</h3>
                <p className="settings-card__desc">Update your photo and personal details.</p>
                <div className="profile-upload">
                  <div className="profile-upload__avatar" onClick={() => fileInputRef.current?.click()} title="Click to change photo">
                    {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : localName.charAt(0).toUpperCase() || "N"}
                    <div className="profile-upload__overlay"><CameraIcon /></div>
                  </div>
                  <div>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
                      {uploadingPhoto ? "Uploading..." : "Change Photo"}
                    </button>
                    <p className="profile-upload__hint">JPG, GIF or PNG. 2MB Max.</p>
                    <input ref={fileInputRef} type="file" accept="image/*" className="visually-hidden" onChange={handlePhotoUpload} />
                  </div>
                </div>
                <form onSubmit={handleUpdateProfile} className="modal-form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="Enter your name" />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" value={user?.email || ""} disabled className="input--disabled" />
                  </div>
                  <div className="form-group">
                    <label>Bio</label>
                    <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." />
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</button>
                </form>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="settings-section">
              <div className="settings-card">
                <h3 className="settings-card__title">Change Password</h3>
                <p className="settings-card__desc">Manage your password and account security.</p>
                <form onSubmit={handleChangePassword} className="modal-form">
                  <div className="form-group">
                    <label>New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
                </form>
              </div>
              <div className="settings-card">
                <h3 className="settings-card__title">Two-Factor Authentication</h3>
                <div className="toggle-group">
                  <div className="toggle-group__info">
                    <span className="toggle-group__label">Enable 2FA</span>
                    <span className="toggle-group__desc">Add an extra layer of security to your account.</span>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={is2FAEnabled} onChange={(e) => setIs2FAEnabled(e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="settings-section">
              <div className="settings-card">
                <h3 className="settings-card__title">Application Preferences</h3>
                <p className="settings-card__desc">Customize your dashboard experience.</p>
                <div className="form-group">
                  <label>Primary Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GEL">GEL (₾)</option>
                  </select>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.5" }}>
                    Note: This only changes the currency symbol displayed across the dashboard. It does not convert or recalculate any of your existing amounts.
                  </p>
                </div>
                <div className="toggle-group">
                  <div className="toggle-group__info">
                    <span className="toggle-group__label">Dark Mode</span>
                    <span className="toggle-group__desc">Switch between dark and light themes.</span>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>
                <div className="toggle-group">
                  <div className="toggle-group__info">
                    <span className="toggle-group__label">GitHub Integration</span>
                    <span className="toggle-group__desc">Show GitHub heatmap and activity sections across the dashboard.</span>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={showGitHub} onChange={(e) => setShowGitHub(e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>
                <div className="notifications-section">
                  <h4 className="notifications-section__title">Email Notifications</h4>
                  <div className="toggle-group">
                    <div className="toggle-group__info">
                      <span className="toggle-group__label">Account Updates</span>
                      <span className="toggle-group__desc">Security alerts and billing information.</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={notifications.account} onChange={(e) => setNotifications({ ...notifications, account: e.target.checked })} />
                      <span className="slider" />
                    </label>
                  </div>
                  <div className="toggle-group">
                    <div className="toggle-group__info">
                      <span className="toggle-group__label">Project Milestones</span>
                      <span className="toggle-group__desc">Notifications about project progress and deadlines.</span>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={notifications.projects} onChange={(e) => setNotifications({ ...notifications, projects: e.target.checked })} />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
                <button onClick={handleSavePreferences} className="btn btn--primary settings-save-btn">Save Preferences</button>
              </div>
            </div>
          )}

          {activeTab === "categories" && (
            <div className="settings-section">
              <div className="settings-card">
                <h3 className="settings-card__title">Client Categories</h3>
                <p className="settings-card__desc">Create and manage categories to organise your clients.</p>

                <div className="cat-settings__add">
                  <div className="cat-settings__add-row">
                    <input
                      type="text"
                      placeholder="New category name..."
                      value={newCatName}
                      onChange={(e) => { setNewCatName(e.target.value); setCatError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                      className="cat-settings__name-input"
                    />
                    <div className="cat-settings__colors">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`cat-settings__color-dot${newCatColor === color ? " cat-settings__color-dot--active" : ""}`}
                          style={{ background: color }}
                          onClick={() => setNewCatColor(color)}
                          aria-label={color}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={handleAddCategory}
                      disabled={catLoading || !newCatName.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {catError && <div className="cat-settings__error">{catError}</div>}
                </div>

                {categories.length === 0 ? (
                  <div className="cat-settings__empty">No categories yet. Add one above.</div>
                ) : (
                  <ul className="cat-settings__list">
                    {categories.map((cat) => {
                      const count = getClientsCountForCategory(cat.id);
                      const isEditing = editingCatId === cat.id;
                      const isConfirmingDelete = deletingCatId === cat.id;

                      return (
                        <li key={cat.id} className="cat-settings__item">
                          {isConfirmingDelete ? (
                            <div className="cat-settings__delete-confirm">
                              <span>
                                Delete <strong>{cat.name}</strong>?
                                {count > 0 && ` It's assigned to ${count} client${count !== 1 ? "s" : ""}.`}
                              </span>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button type="button" className="btn btn--outline btn--sm" onClick={() => setDeletingCatId(null)}>Cancel</button>
                                <button type="button" className="btn btn--sm btn--confirm btn--confirm-danger" onClick={() => handleDeleteCategory(cat.id)} disabled={catLoading}>
                                  {catLoading ? "..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          ) : isEditing ? (
                            <div className="cat-settings__edit-row">
                              <input
                                type="text"
                                value={editingCatName}
                                onChange={(e) => setEditingCatName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleUpdateCategory(cat.id); if (e.key === "Escape") setEditingCatId(null); }}
                                autoFocus
                                className="cat-settings__name-input"
                              />
                              <div className="cat-settings__colors">
                                {PRESET_COLORS.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    className={`cat-settings__color-dot${editingCatColor === color ? " cat-settings__color-dot--active" : ""}`}
                                    style={{ background: color }}
                                    onClick={() => setEditingCatColor(color)}
                                    aria-label={color}
                                  />
                                ))}
                              </div>
                              <button type="button" className="btn btn--primary btn--sm" onClick={() => handleUpdateCategory(cat.id)} disabled={catLoading}>Save</button>
                              <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditingCatId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <div className="cat-settings__item-left">
                                <span className="cat-settings__item-dot" style={{ background: cat.color }} />
                                <span className="cat-settings__item-name">{cat.name}</span>
                                <span className="cat-settings__item-count">{count} client{count !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="cat-settings__item-actions">
                                <button
                                  type="button"
                                  className="action-btn action-btn--edit"
                                  onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); setEditingCatColor(cat.color); }}
                                  title="Edit"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="action-btn action-btn--delete"
                                  onClick={() => setDeletingCatId(cat.id)}
                                  title="Delete"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}