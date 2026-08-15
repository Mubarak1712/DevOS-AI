import { useState } from 'react';
import { Camera, Key, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Card, Input, Avatar } from '@/components/ui';
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    setProfileLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name, company, role, bio },
      });

      if (error) {
        setProfileFeedback({ type: 'error', message: error.message });
      } else {
        // Also update the public.users table
        if (user?.id) {
          await supabase
            .from('users')
            .update({ name, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        }
        setProfileFeedback({ type: 'success', message: 'Profile updated successfully!' });
      }
    } catch {
      setProfileFeedback({ type: 'error', message: 'An unexpected error occurred.' });
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
      setPasswordFeedback({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarClick = () => {
    // Avatar upload requires Supabase Storage bucket configuration
    setProfileFeedback({ type: 'error', message: 'Avatar upload coming soon — storage bucket not yet configured.' });
    setTimeout(() => setProfileFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Profile</h1>
        <p className="text-neutral-500 mt-1">Manage your personal information</p>
      </div>

      {/* Profile Card */}
      <Card className="p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative">
            <Avatar
              src={user?.user_metadata?.avatar_url}
              alt={user?.user_metadata?.name || user?.email || 'User'}
              size="xl"
            />
            <button
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-lg hover:bg-primary-600 transition-colors"
              title="Change avatar"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-neutral-900">
              {user?.user_metadata?.name || 'Developer'}
            </h2>
            <p className="text-neutral-500">{user?.email}</p>
            <p className="text-sm text-neutral-400 mt-1">
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </Card>

      {/* Personal Information */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Personal Information</h2>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {profileFeedback && (
            <FeedbackBanner type={profileFeedback.type} message={profileFeedback.message} />
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              label="Email Address"
              type="email"
              defaultValue={user?.email}
              disabled
              helperText="Email cannot be changed"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Input
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company"
            />
            <Input
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Your role"
            />
          </div>

          <Input
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
          />

          <div className="flex justify-end">
            <Button type="submit" isLoading={profileLoading}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Change Password</h2>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {passwordFeedback && (
            <FeedbackBanner type={passwordFeedback.type} message={passwordFeedback.message} />
          )}

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (8+ characters)"
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />

          <div className="flex justify-end">
            <Button type="submit" isLoading={passwordLoading}>
              <Key className="w-4 h-4 mr-2" />
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
