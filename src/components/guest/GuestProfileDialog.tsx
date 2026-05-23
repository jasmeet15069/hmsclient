import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, UserRound } from 'lucide-react';

export function GuestProfileDialog() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFullName(user?.profile?.full_name || '');
    setPhone(user?.profile?.phone || '');
    setAvatarUrl(user?.profile?.avatar_url || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [isOpen, user?.profile]);

  const handleAvatarFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 800_000) {
      toast({ title: 'Image too large', description: 'Please choose an image under 800 KB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || 'Guest',
          phone: phone.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      await refreshUser();
      toast({ title: 'Profile saved', description: 'Your profile details were updated.' });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Profile update failed',
        description: error instanceof Error ? error.message : 'Unable to save profile.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast({ title: 'Password missing', description: 'Enter current and new password.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Password mismatch', description: 'New password and confirmation must match.', variant: 'destructive' });
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        current_password: currentPassword,
        password: newPassword,
      });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', description: 'Use your new password next time you sign in.' });
    } catch (error) {
      toast({
        title: 'Password update failed',
        description: error instanceof Error ? error.message : 'Unable to update password.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserRound className="mr-2 h-4 w-4" />
          Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-2 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Profile Management</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden border-2 bg-muted">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-9 w-9 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Upload Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleAvatarFile(event.target.files?.[0])}
              />
              {avatarUrl && (
                <Button type="button" variant="ghost" onClick={() => setAvatarUrl('')}>
                  Remove photo
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email ID</Label>
            <Input value={user?.email || ''} readOnly className="border-2 bg-muted" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} className="border-2" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="border-2" />
            </div>
          </div>

          <Button onClick={saveProfile} disabled={isSaving} className="w-full">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile
          </Button>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-bold">Reset Password</h3>
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="border-2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="border-2" />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="border-2" />
              </div>
            </div>
            <Button onClick={changePassword} disabled={isChangingPassword} variant="outline" className="w-full">
              {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
