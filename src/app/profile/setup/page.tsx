'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase_client } from '@/lib/supabase_client';
import { useRouter } from 'next/navigation';
import { MessageCircle, Camera, Loader2, ArrowRight, User } from 'lucide-react';

export default function ProfileSetupPage() {
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Fast local check — no network needed
        const { data: { session } } = await supabase_client.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }
        setUserId(session.user.id);

        // If profile already exists, redirect to chat
        const { data: profile } = await supabase_client
          .from('project_v2_profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          router.push('/chat');
        }
      } catch (err) {
        console.error('Profile setup auth error:', err);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar must be under 5MB.');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (age && (parseInt(age) < 13 || parseInt(age) > 120)) {
      setError('Age must be between 13 and 120.');
      return;
    }
    if (!userId) return;

    setLoading(true);

    let avatar_url = '';

    // Upload avatar if selected
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const filePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase_client.storage
        .from('project-v2-media')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) {
        setError('Failed to upload avatar: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase_client.storage
        .from('project-v2-media')
        .getPublicUrl(filePath);
      avatar_url = urlData.publicUrl;
    }

    // Insert profile
    const { error: insertError } = await supabase_client
      .from('project_v2_profiles')
      .insert({
        id: userId,
        display_name: displayName.trim(),
        age: age ? parseInt(age) : null,
        bio: bio.trim(),
        avatar_url,
      });

    if (insertError) {
      setError('Failed to create profile: ' + insertError.message);
      setLoading(false);
      return;
    }

    router.push('/chat');
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.06] blur-[128px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-500/[0.04] blur-[128px]" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold">Talkr</span>
        </div>

        <div className="glass rounded-2xl p-8 md:p-10">
          <h2 className="text-2xl font-bold mb-1 text-center">Set up your profile</h2>
          <p className="text-white/40 text-center mb-8">This is how others will see you. You can change it later.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative group"
              >
                <div className="w-24 h-24 rounded-full bg-white/[0.08] border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden group-hover:border-emerald-500/50 transition-colors">
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
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Display Name */}
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
            </div>

            {/* Age */}
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

            {/* Bio */}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary !py-4 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continue to Chat <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
