import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { Hotel } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthPageProps {
  portal: 'client' | 'staff';
}

export default function AuthPage({ portal }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const { user, loading, signOut } = useAuth();
  const isClientPortal = portal === 'client';
  const portalTitle = isClientPortal ? 'Guest Portal' : 'Staff Portal';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-lg font-medium">Loading...</div>
      </div>
    );
  }

  if (user) {
    const isGuestOnly = user.roles.includes('guest') && user.roles.length === 1;
    if (isClientPortal && isGuestOnly) {
      return <Navigate to="/guest" replace />;
    }
    if (!isClientPortal && !isGuestOnly) {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md border-2 border-border p-6">
          <h1 className="text-2xl font-bold">Wrong Login Portal</h1>
          <p className="mt-2 text-muted-foreground">
            {isClientPortal
              ? 'This account belongs to staff. Please use the staff login.'
              : 'This account is a guest account. Please use the client login.'}
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={signOut}>Sign out</Button>
            {isClientPortal && (
              <Button variant="outline" asChild>
                <a href="http://localhost:8081/staff-login">Go to Staff Login</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden flex-1 flex-col justify-between border-r-2 border-border bg-primary p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="border-2 border-primary-foreground p-2">
              <Hotel className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-primary-foreground">HotelOps {portalTitle}</h1>
          </div>
        </div>
        
        <div className="space-y-6">
          <blockquote className="text-xl font-medium leading-relaxed text-primary-foreground">
            {isClientPortal
              ? '"A simple guest portal for room booking, room service, requests, billing, and concierge support."'
              : '"A focused operations console for reception, rooms, food orders, complaints, payments, and kitchen workflows."'}
          </blockquote>
          <div className="space-y-1">
            <p className="font-bold text-primary-foreground">{portalTitle}</p>
            <p className="text-primary-foreground/80">
              {isClientPortal ? 'Designed for guests and clients.' : 'Designed for hotel staff.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-primary-foreground/70">
          <div>
            <p className="text-3xl font-bold text-primary-foreground">6</p>
            <p className="text-sm">{isClientPortal ? 'Guest Flow' : 'Staff Roles'}</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary-foreground">∞</p>
            <p className="text-sm">Live Updates</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary-foreground">100%</p>
            <p className="text-sm">{isClientPortal ? 'Self Service' : 'Operations'}</p>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="border-2 border-primary p-2">
              <Hotel className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">HotelOps {portalTitle}</h1>
          </div>
          
          {isLogin ? (
            <LoginForm portal={portal} onToggleMode={() => setIsLogin(false)} />
          ) : (
            <SignUpForm onToggleMode={() => setIsLogin(true)} />
          )}
          {isClientPortal && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Staff members use the separate staff website.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
