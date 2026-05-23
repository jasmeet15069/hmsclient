import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Loader2, Receipt, RefreshCw } from 'lucide-react';

interface GuestStay {
  id: string;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  total_amount: number | null;
  actual_check_in: string | null;
  actual_check_out: string | null;
  rooms: { room_number: string; room_type: string } | null;
}

interface Payment {
  id: string;
  payment_number: string;
  guest_stay_id: string | null;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  guest_stays?: { guest_id?: string; guest_name: string; rooms?: { room_number: string } | null } | null;
}

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

export function GuestBillingTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stays, setStays] = useState<GuestStay[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const [staysRes, paymentsRes] = await Promise.all([
        supabase
          .from('guest_stays')
          .select('*, rooms(room_number, room_type)')
          .eq('guest_id', user.id)
          .order('check_in_date', { ascending: false }),
        supabase
          .from('payments')
          .select('*, guest_stays(guest_id, guest_name, rooms(room_number))')
          .order('created_at', { ascending: false }),
      ]);

      const userStays = (staysRes.data as GuestStay[]) || [];
      const stayIds = new Set(userStays.map(stay => stay.id));
      setStays(userStays);
      setPayments(((paymentsRes.data as Payment[]) || []).filter(payment => {
        return Boolean(payment.guest_stay_id && stayIds.has(payment.guest_stay_id));
      }));
    } catch (err) {
      console.error('Error fetching billing:', err);
      toast({
        title: 'Billing unavailable',
        description: 'Unable to load your booking and payment details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('payment_id');
    const sessionId = params.get('session_id');
    if (params.get('booking') !== 'success' || !paymentId || !sessionId) return;

    fetch(`${apiBase}/payments/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, session_id: sessionId }),
    })
      .then(response => response.json().then(payload => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!response.ok || payload.error) throw new Error(payload.error || 'Unable to verify payment');
        toast({ title: 'Payment completed', description: 'Your booking payment has been confirmed.' });
        window.history.replaceState({}, '', window.location.pathname);
        fetchBilling();
      })
      .catch(error => {
        toast({
          title: 'Payment verification pending',
          description: error instanceof Error ? error.message : 'Unable to verify Stripe payment yet.',
          variant: 'destructive',
        });
      });
  }, [fetchBilling, toast]);

  const activeStay = stays.find(stay => !stay.actual_check_out);
  const totalBilled = stays.reduce((sum, stay) => sum + Number(stay.total_amount || 0), 0);
  const pendingPayments = payments.filter(payment => payment.status === 'pending');
  const paymentsByStay = useMemo(() => payments.reduce((acc, payment) => {
    if (!payment.guest_stay_id) return acc;
    if (!acc[payment.guest_stay_id]) acc[payment.guest_stay_id] = [];
    acc[payment.guest_stay_id].push(payment);
    return acc;
  }, {} as Record<string, Payment[]>), [payments]);

  const handlePayNow = async (payment: Payment) => {
    setIsPaying(payment.id);
    try {
      const response = await fetch(`${apiBase}/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: payment.id, currency: 'USD', country: 'United States' }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || 'Unable to start checkout');
      window.location.href = payload.data.checkout_url;
    } catch (error) {
      toast({
        title: 'Payment setup failed',
        description: error instanceof Error ? error.message : 'Unable to start Stripe Checkout.',
        variant: 'destructive',
      });
    } finally {
      setIsPaying(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Billing & Invoices</h3>
        <Button variant="outline" size="sm" onClick={fetchBilling}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {activeStay ? (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Booking
            </CardTitle>
            <CardDescription>
              Room {activeStay.rooms?.room_number || 'N/A'} - {activeStay.rooms?.room_type || 'Room booking'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-b pb-2">
                <p className="text-sm text-muted-foreground">Check-in</p>
                <p className="font-medium">{new Date(activeStay.check_in_date).toLocaleDateString()}</p>
              </div>
              <div className="border-b pb-2">
                <p className="text-sm text-muted-foreground">Check-out</p>
                <p className="font-medium">{new Date(activeStay.check_out_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex justify-between pt-1">
              <span className="font-bold">Room Total</span>
              <span className="text-xl font-bold">${Number(activeStay.total_amount || 0).toFixed(2)}</span>
            </div>

            {(paymentsByStay[activeStay.id] || []).map(payment => (
              <div key={payment.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t-2 pt-3">
                <div>
                  <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                    {payment.status.toUpperCase()}
                  </Badge>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {payment.payment_number} - {payment.payment_method}
                  </p>
                </div>
                {payment.status === 'pending' && (
                  <Button onClick={() => handlePayNow(payment)} disabled={isPaying === payment.id}>
                    {isPaying === payment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Complete Payment
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <CardContent className="py-8 text-center text-muted-foreground">
            <CreditCard className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No active booking found.</p>
            <p className="text-sm">Book a room to see billing details here.</p>
          </CardContent>
        </Card>
      )}

      {pendingPayments.length > 0 && (
        <Card className="border-2 border-amber-600 bg-amber-50">
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
            <CardDescription>Held bookings waiting for payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPayments.map(payment => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-amber-600 bg-background p-3">
                <div>
                  <p className="font-medium">{payment.payment_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Room {payment.guest_stays?.rooms?.room_number || 'N/A'} - ${Number(payment.amount).toFixed(2)}
                  </p>
                </div>
                <Button onClick={() => handlePayNow(payment)} disabled={isPaying === payment.id}>
                  {isPaying === payment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Complete Payment
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {stays.length > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Stay History
            </CardTitle>
            <CardDescription>
              {stays.length} stay(s) - ${totalBilled.toFixed(2)} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b-2">
                  <TableHead>Room</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stays.map(stay => (
                  <TableRow key={stay.id}>
                    <TableCell className="font-medium">{stay.rooms?.room_number || 'N/A'}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(stay.check_in_date).toLocaleDateString()} - {new Date(stay.check_out_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono font-bold">${Number(stay.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={stay.actual_check_out ? 'secondary' : 'default'}>
                        {stay.actual_check_out ? 'Completed' : stay.actual_check_in ? 'Active' : 'Upcoming'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
