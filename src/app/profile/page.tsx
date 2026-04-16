'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase_client } from '@/lib/supabase_client';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, Camera, Loader2, ArrowLeft, User,
  Save, LogOut, CheckCircle2,
} from 'lucide-react';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        // Fast local check first
        const { data: { session } } = await supabase_client.auth.getSession();
        if (!session) { router.replace('/login'); return; }

        const { data } = await supabase_client
          .from('project_v2_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!data) { router.replace('/profile/setup'); return; }

        setProfile(data);
        setDisplayName(data.display_name);
        setAge(data.age ? String(data.age) : '');
        setBio(data.bio || '');
        setAvatarPreview(data.avatar_url || null);
      } catch (err) {
        console.error('Profile load error:', err);
        router.replace('/login');
      } finally {
        setPageLoading(false);
      }
    };
    load();
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Avatar must be under 5MB.'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) { setError('Display name is required.'); return; }
    if (age && (parseInt(age) < 13 || parseInt(age) > 120)) {
      setError('Age must be between 13 and 120.');
      return;
    }
    if (!profile) return;

    setSaving(true);

    let avatar_url = profile.avatar_url;

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const filePath = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase_client.storage
        .from('project-v2-media')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        setError('Failed to upload avatar: ' + uploadError.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase_client.storage
        .from('project-v2-media')
        .getPublicUrl(filePath);
      avatar_url = urlData.publicUrl;
    }

    const { error: updateError } = await supabase_client
      .from('project_v2_profiles')
      .update({
        display_name: displayName.trim(),
        age: age ? parseInt(age) : null,
        bio: bio.trim(),
        avatar_url,
      })
      .eq('id', profile.id);

    if (updateError) {
      setError('Failed to save: ' + updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setProfile((prev) => prev ? { ...prev, display_name: displayName.trim(), age: age ? parseInt(age) : null, bio: bio.trim(), avatar_url } : prev);
    setAvatarFile(null);
  };

  const handleLogout = async () => {
    await supabase_client.auth.signOut();
    router.push('/login');
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.05] blur-[128px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-500/[0.04] blur-[128px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/chat')}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-black" strokeWidth={2.5} />
              </div>
              <span className="font-bold">Hirecheck</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Your Profile</h1>
        <p className="text-white/40 text-sm mb-8">Update how others see you on Hirecheck.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-3 mb-6">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Profile saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Profile Photo</h2>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative group flex-shrink-0"
              >
                <div className="w-24 h-24 rounded-full bg-white/[0.08] border-2 border-dashed border-white/20 overflow-hidden flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-white/20" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                  <Camera className="w-4 h-4 text-black" />
                </div>
              </button>
              <div>
                <p className="text-sm font-medium mb-1">Change your avatar</p>
                <p className="text-xs text-white/30 mb-3">JPG, PNG or GIF. Max 5MB.</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Upload photo
                </button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Details */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Personal Info</h2>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Display name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={30}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should people call you?"
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-white/20"
              />
              <p className="text-xs text-white/20 mt-1 text-right">{displayName.length}/30</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Age</label>
              <input
                type="number"
                min={13}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Optional"
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Bio</label>
              <textarea
                maxLength={200}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people a bit about yourself..."
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-white/20 resize-none"
              />
              <p className="text-xs text-white/20 mt-1 text-right">{bio.length}/200</p>
            </div>
          </div>

          {/* Account info */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Account</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Member since</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary !py-4 flex items-center justify-center gap-2 text-base"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" /> Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
