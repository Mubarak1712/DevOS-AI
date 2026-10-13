import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, AlertCircle, Github, Mail, Shield, Copy, Check } from 'lucide-react';
import { Button, Card, Input, Avatar } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

function FeedbackBanner({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
        type === 'success'
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          : 'bg-rose-50 border border-rose-200 text-rose-700'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      {message}
    </div>
  );
}

export function ProfilePage() {
  const { user } = useAuth();

  // Profile form state
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [company, setCompany] = useState(user?.user_metadata?.company || '');
  const [role, setRole] = useState(user?.user_metadata?.role || '');
  const [bio, setBio] = useState(user?.user_metadata?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
  const [showAvatarEdit, setShowAvatarEdit] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user?.user_metadata) {
      if (user.user_metadata.name) setName(user.user_metadata.name);
      if (user.user_metadata.company) setCompany(user.user_metadata.company);
      if (user.user_metadata.role) setRole(user.user_metadata.role);
      if (user.user_metadata.bio) setBio(user.user_metadata.bio);
      if (user.user_metadata.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);
    }
  }, [user]);

  const authProvider = user?.app_metadata?.provider || (user?.identities?.[0]?.provider ?? 'email');
  const isGitHubAuth = authProvider === 'github';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    setProfileLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name, company, role, bio, avatar_url: avatarUrl },
      });

      if (error) {
        setProfileFeedback({ type: 'error', message: error.message });
      } else {
        // Also update the public.users table if it exists
        if (user?.id) {
          await supabase
            .from('users')
            .update({
              name,
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }
        setProfileFeedback({ type: 'success', message: 'Profile details saved successfully!' });
      }
    } catch {
      setProfileFeedback({ type: 'error', message: 'An unexpected error occurred while saving profile.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordFeedback({ type: 'error', message: error.message });
      } else {
        setPasswordFeedback({ type: 'success', message: 'Password updated successfully!' });
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch {
      setPasswordFeedback({ type: 'error', message: 'An unexpected error occurred updating password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyUserId = async () => {
    if (!user?.id) return;
    await navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Account"
        title="Developer Identity & Profile"
        description="Manage your personal developer profile, authentication details, and credentials"
      />

      {/* Profile Overview Card */}
      <Card variant="os" padding="md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative group">
            <Avatar
              src={avatarUrl || user?.user_metadata?.avatar_url}
              alt={name || user?.email || 'User'}
              size="xl"
            />
            <button
              type="button"
              onClick={() => setShowAvatarEdit(!showAvatarEdit)}
              className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold shadow-md hover:bg-violet-700 transition-colors"
            >
              Edit
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-neutral-900">
                {name || 'Developer'}
              </h2>
              {role && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                  {role}
                </span>
              )}
            </div>

            <p className="text-sm text-surface-500 mt-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-surface-400" />
              {user?.email}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                {isGitHubAuth ? (
                  <>
                    <Github className="w-3.5 h-3.5 text-neutral-800" />
                    <span>Signed in via GitHub OAuth</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Email & Password Auth</span>
                  </>
                )}
              </span>

              <span>•</span>

              <span>
                Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Recently'}
              </span>

              <span>•</span>

              <button
                type="button"
                onClick={copyUserId}
                className="text-violet-600 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                ID: {user?.id?.slice(0, 8)}...
                {copiedId ? <Check className="w-3 h-3 text-success-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Avatar URL Input */}
        {showAvatarEdit && (
          <div className="mt-4 pt-4 border-t border-surface-100">
            <label className="text-xs font-semibold text-neutral-700 mb-1 block">Custom Avatar Image URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png or GitHub avatar URL"
                className="flex-1 text-xs rounded-xl border border-surface-200 px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <Button size="sm" variant="secondary" onClick={() => setShowAvatarEdit(false)}>
                Done
              </Button>
            </div>
            <p className="text-[11px] text-surface-400 mt-1">Paste a public image URL or keep your OAuth provider avatar.</p>
          </div>
        )}
      </Card>

      {/* Personal Information Form */}
      <Card variant="os" padding="md">
        <h2 className="text-base font-bold text-neutral-900 mb-4">Personal Information</h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileFeedback && (
            <FeedbackBanner type={profileFeedback.type} message={profileFeedback.message} />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Chen"
            />
            <Input
              label="Email Address"
              type="email"
              defaultValue={user?.email}
              disabled
              helperText="Managed by authentication provider"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Company / Team"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp or Independent"
            />
            <Input
              label="Engineering Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Fullstack Engineer, DevOps Lead"
            />
          </div>

          <Input
            label="Bio / Technical Summary"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Brief description of your primary technologies and projects..."
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={profileLoading}>
              <Save className="w-4 h-4 mr-2" />
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Credentials / Password Management */}
      <Card variant="os" padding="md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Security Credentials</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              {isGitHubAuth
                ? 'You are signed in via GitHub. You can optionally set a password for direct email login.'
                : 'Update your account password to protect access.'}
            </p>
          </div>
          <Key className="w-5 h-5 text-violet-500" />
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {passwordFeedback && (
            <FeedbackBanner type={passwordFeedback.type} message={passwordFeedback.message} />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={passwordLoading} disabled={!newPassword}>
              <Key className="w-4 h-4 mr-2" />
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
