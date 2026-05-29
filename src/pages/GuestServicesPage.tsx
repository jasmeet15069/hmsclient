import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGuestPreferences } from '@/hooks/useGuestPreferences';
import { useHotelBranding } from '@/hooks/useHotelBranding';
import { AIConciergeChat } from '@/components/ai/AIConciergeChat';
import { MenuSuggestionCard } from '@/components/ai/MenuSuggestionCard';
import { GuestPreferencesDialog } from '@/components/guest/GuestPreferencesDialog';
import { GuestProfileDialog } from '@/components/guest/GuestProfileDialog';
import { GuestBillingTab } from '@/components/guest/GuestBillingTab';
import { OrderTracker } from '@/components/guest/OrderTracker';
import { 
  Bed, 
  UtensilsCrossed, 
  Clock, 
  Star, 
  MessageSquare, 
  CreditCard,
  LogOut,
  Hotel,
  Plus,
  Sparkles,
  Phone,
  Wifi,
  Coffee,
  Calendar,
  CheckCircle2,
  Users,
  Loader2,
  Home,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { COUNTRY_OPTIONS, formatCurrency, getCountryOption, getExchangeRate } from '@/lib/currency';

interface Room {
  id?: string;
  room_number?: string;
  room_type: string;
  floor?: number;
  capacity: number;
  price_per_night: number;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning';
  amenities: string[] | null;
}

interface RoomPackage {
  room_type: string;
  capacity: number;
  price_per_night: number;
  amenities: string[];
  available_count: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_name?: string;
  is_available: boolean;
  menu_item_customizations?: MenuCustomization[];
}

interface MenuItemResponse extends MenuItem {
  menu_categories?: { name: string } | null;
}

interface MenuCustomization {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  customizations: MenuCustomization[];
}

interface GuestStay {
  id: string;
  room_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  actual_check_in: string | null;
  actual_check_out: string | null;
  total_amount: number | null;
  rooms?: { room_number: string; room_type?: string | null } | null;
}

interface PaymentConfig {
  stripe_configured: boolean;
  mode: 'live' | 'test' | null;
  publishable_mode: 'live' | 'test' | null;
  mode_matches: boolean;
  active_gateway?: 'none' | 'stripe' | 'razorpay' | 'cash' | 'card' | 'bank_transfer';
  default_currency?: string;
  razorpay_configured?: boolean;
}

const dateInputValue = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
};

const authHeaders = () => {
  try {
    const rawSession = localStorage.getItem('hotel_harmony_session');
    const session = rawSession ? JSON.parse(rawSession) : null;
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
};

export default function GuestServicesPage() {
  const { user, signOut, isStaff } = useAuth();
  const { toast } = useToast();
  const { preferences } = useGuestPreferences();
  const { branding } = useHotelBranding();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeStay, setActiveStay] = useState<GuestStay | null>(null);
  const [activeTab, setActiveTab] = useState('rooms');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [showConcierge, setShowConcierge] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [housekeepingNotes, setHousekeepingNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookingCountry, setBookingCountry] = useState(COUNTRY_OPTIONS[0].country);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [bookingDetails, setBookingDetails] = useState({
    guestName: user?.profile?.full_name || '',
    guestEmail: user?.email || '',
    guestPhone: user?.profile?.phone || '',
    checkInDate: dateInputValue(0),
    checkOutDate: dateInputValue(1),
  });

  useEffect(() => {
    if (!preferences) return;
    setBookingCountry(getCountryOption(preferences.country, preferences.currency).country);
  }, [preferences?.country, preferences?.currency]);

  useEffect(() => {
    if (preferences) return;
    setBookingCountry(getCountryOption(branding.country, branding.currency).country);
  }, [branding.country, branding.currency, preferences]);

  useEffect(() => {
    if (!isStaff) {
      fetchData();
      fetchPaymentConfig();
      const intervalId = window.setInterval(() => fetchData(true), 4000);
      const refreshOnFocus = () => fetchData(true);
      window.addEventListener('focus', refreshOnFocus);
      document.addEventListener('visibilitychange', refreshOnFocus);

      return () => {
        window.clearInterval(intervalId);
        window.removeEventListener('focus', refreshOnFocus);
        document.removeEventListener('visibilitychange', refreshOnFocus);
      };
    }
  }, [isStaff]);

  const fetchPaymentConfig = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/payment-config`);
      const payload = await response.json();
      setPaymentConfig(payload.data || null);
    } catch (error) {
      console.error('Error fetching payment config:', error);
      setPaymentConfig(null);
    }
  };

  useEffect(() => {
    const selected = COUNTRY_OPTIONS.find(option => option.country === bookingCountry) || COUNTRY_OPTIONS[0];
    if (selected.currency === 'USD') {
      setExchangeRate(1);
      return;
    }

    setIsRateLoading(true);
    getExchangeRate(selected.currency)
      .then(rate => setExchangeRate(rate))
      .catch(error => {
        console.error('Error fetching exchange rate:', error);
        setExchangeRate(1);
        toast({
          title: 'Currency rate unavailable',
          description: 'Showing USD pricing until the exchange-rate service responds.',
          variant: 'destructive',
        });
      })
      .finally(() => setIsRateLoading(false));
  }, [bookingCountry, toast]);

  // Staff should go to dashboard
  if (isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Fetch available rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('room_type, capacity, price_per_night, status, amenities')
        .eq('status', 'available')
        .order('room_type');

      setRooms(roomsData || []);

      // Fetch menu items with categories
      const { data: menuData } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories(name),
          menu_item_customizations(*)
        `)
        .eq('is_available', true)
        .order('name');

      const formattedMenu = (menuData as MenuItemResponse[] | null)?.map(item => ({
        ...item,
        category_name: item.menu_categories?.name || 'Uncategorized',
      })) || [];

      setMenuItems(formattedMenu);

      if (user?.id) {
        const { data: staysData } = await supabase
          .from('guest_stays')
          .select('*, rooms(room_number, room_type)')
          .eq('guest_id', user.id)
          .order('check_in_date', { ascending: false });

        const currentStay = ((staysData || []) as GuestStay[]).find(stay => !stay.actual_check_out) || null;
        setActiveStay(currentStay);
        if (currentStay) {
          setBookingDetails(prev => ({
            ...prev,
            guestName: currentStay.guest_name || prev.guestName,
            guestEmail: currentStay.guest_email || prev.guestEmail,
            guestPhone: currentStay.guest_phone || prev.guestPhone,
          }));
          setActiveTab(current => current === 'rooms' ? 'my-stay' : current);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    const selectedIds = selectedOptions[item.id] || [];
    const customizations = (item.menu_item_customizations || [])
      .filter(option => option.is_available && selectedIds.includes(option.id));
    const customizationTotal = customizations.reduce((sum, option) => sum + Number(option.price), 0);
    const cartId = `${item.id}:${selectedIds.sort().join(',')}`;

    setCart(prev => {
      const existing = prev.find(i => i.id === cartId);
      if (existing) {
        return prev.map(i => i.id === cartId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: cartId,
        name: item.name,
        price: Number(item.price) + customizationTotal,
        quantity: 1,
        customizations,
      }];
    });
    toast({
      title: 'Added to cart',
      description: `${item.name} added to your order`,
    });
  };

  const toggleOption = (itemId: string, optionId: string) => {
    setSelectedOptions(prev => {
      const selected = prev[itemId] || [];
      const next = selected.includes(optionId)
        ? selected.filter(id => id !== optionId)
        : [...selected, optionId];
      return { ...prev, [itemId]: next };
    });
  };

  const bookingNights = Math.max(
    1,
    Math.ceil((new Date(bookingDetails.checkOutDate).getTime() - new Date(bookingDetails.checkInDate).getTime()) / (1000 * 60 * 60 * 24))
  );

  const selectedCountry = COUNTRY_OPTIONS.find(option => option.country === bookingCountry) || COUNTRY_OPTIONS[0];

  const formatMoney = (amount: number, currency = selectedCountry.currency) => {
    const option = currency === selectedCountry.currency ? selectedCountry : getCountryOption(null, currency);
    return formatCurrency(amount, option);
  };

  const handleStripeBooking = async (roomPackage: RoomPackage) => {
    if (!user?.id) return;

    if (paymentConfig?.active_gateway && paymentConfig.active_gateway !== 'stripe') {
      toast({
        title: 'Online card payment is not active',
        description: `${paymentConfig.active_gateway.replace('_', ' ')} is selected for this hotel. Use Hold Room or ask reception for payment instructions.`,
        variant: 'destructive',
      });
      return;
    }

    if (!paymentConfig?.stripe_configured) {
      toast({
        title: 'Stripe is not configured',
        description: 'Ask the hotel admin to add Stripe keys in Portal Settings > Payments.',
        variant: 'destructive',
      });
      return;
    }

    if (paymentConfig.mode_matches === false) {
      toast({
        title: 'Stripe key mismatch',
        description: 'Publishable and secret Stripe keys must both be live or both be test.',
        variant: 'destructive',
      });
      return;
    }

    if (!bookingDetails.guestName || !bookingDetails.guestEmail || !bookingDetails.checkInDate || !bookingDetails.checkOutDate) {
      toast({
        title: 'Missing booking details',
        description: 'Please enter guest details and stay dates before payment.',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/bookings/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          user_id: user.id,
          country: selectedCountry.country,
          currency: selectedCountry.currency,
          ...bookingDetails,
          guest_name: bookingDetails.guestName,
          guest_email: bookingDetails.guestEmail,
          guest_phone: bookingDetails.guestPhone,
          check_in_date: bookingDetails.checkInDate,
          check_out_date: bookingDetails.checkOutDate,
          room_type: roomPackage.room_type,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || 'Unable to create Stripe Checkout session');
      window.location.href = payload.data.checkout_url;
    } catch (error) {
      console.error('Error starting Stripe checkout:', error);
      toast({
        title: 'Payment setup failed',
        description: error instanceof Error ? error.message : 'Unable to start Stripe Checkout.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleManualBooking = async (roomPackage: RoomPackage) => {
    if (!user?.id) return;

    if (!bookingDetails.guestName || !bookingDetails.guestEmail || !bookingDetails.checkInDate || !bookingDetails.checkOutDate) {
      toast({
        title: 'Missing booking details',
        description: 'Please enter guest details and stay dates before holding a room.',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/bookings/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          user_id: user.id,
          country: selectedCountry.country,
          currency: selectedCountry.currency,
          ...bookingDetails,
          guest_name: bookingDetails.guestName,
          guest_email: bookingDetails.guestEmail,
          guest_phone: bookingDetails.guestPhone,
          check_in_date: bookingDetails.checkInDate,
          check_out_date: bookingDetails.checkOutDate,
          room_type: roomPackage.room_type,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || 'Unable to hold this room type');

      toast({
        title: 'Room held',
        description: `A ${getRoomTypeLabel(roomPackage.room_type)} room has been held. Your assigned room number is now visible in My Stay.`,
      });
      await fetchData();
      setActiveTab('my-stay');
    } catch (error) {
      console.error('Error booking room:', error);
      toast({
        title: 'Booking failed',
        description: error instanceof Error ? error.message : 'Unable to complete the booking hold. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleHousekeepingRequest = async (notes = housekeepingNotes) => {
    if (!activeStay?.id) {
      toast({
        title: 'No active stay',
        description: 'Housekeeping requests are available after a room is booked or checked in.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/housekeeping/guest-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          guest_stay_id: activeStay.id,
          request_type: 'guest_request',
          notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || 'Unable to create housekeeping request');
      setHousekeepingNotes('');
      toast({
        title: 'Housekeeping requested',
        description: "Your request has been sent. We'll attend to your room shortly.",
      });
    } catch (error) {
      toast({
        title: 'Request failed',
        description: error instanceof Error ? error.message : 'Unable to send housekeeping request.',
        variant: 'destructive',
      });
    }
  };

  const handleRequestCheckout = () => {
    toast({
      title: 'Checkout request received',
      description: 'Please review your bill. Reception will confirm the final checkout balance.',
    });
    setActiveTab('billing');
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const getRoomTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      standard: 'Standard',
      deluxe: 'Deluxe',
      suite: 'Suite',
      penthouse: 'Penthouse',
      presidential: 'Presidential Suite',
    };
    const normalized = (type || '').toLowerCase();
    if (types[normalized]) return types[normalized];
    return normalized
      ? normalized.split(/[\s_-]+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
      : 'Room';
  };

  const nightsRemaining = activeStay
    ? Math.max(0, Math.ceil((new Date(activeStay.check_out_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Group menu items by category
  const menuByCategory = menuItems.reduce((acc, item) => {
    const category = item.category_name || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const roomTypeOrder = ['standard', 'deluxe', 'suite', 'penthouse', 'presidential'];
  const roomPackages = Object.values(rooms.reduce((acc, room) => {
    const key = (room.room_type || 'standard').toLowerCase();
    const amenities = Array.isArray(room.amenities) ? room.amenities : [];
    if (!acc[key]) {
      acc[key] = {
        room_type: key,
        capacity: Number(room.capacity) || 1,
        price_per_night: Number(room.price_per_night) || 0,
        amenities: [],
        available_count: 0,
      };
    }

    acc[key].capacity = Math.max(acc[key].capacity, Number(room.capacity) || 1);
    acc[key].price_per_night = Math.min(acc[key].price_per_night || Number(room.price_per_night), Number(room.price_per_night) || 0);
    acc[key].amenities = Array.from(new Set([...acc[key].amenities, ...amenities]));
    acc[key].available_count += 1;
    return acc;
  }, {} as Record<string, RoomPackage>)).sort((a, b) => {
    const aOrder = roomTypeOrder.indexOf(a.room_type);
    const bOrder = roomTypeOrder.indexOf(b.room_type);
    if (aOrder !== -1 || bOrder !== -1) {
      return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
    }
    return getRoomTypeLabel(a.room_type).localeCompare(getRoomTypeLabel(b.room_type));
  });
  const displayedRoomPackages = selectedRoomType === 'all'
    ? roomPackages
    : roomPackages.filter(roomPackage => roomPackage.room_type === selectedRoomType);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-2 border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="border-2 border-primary p-1.5">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.hotel_name || 'Hotel logo'} className="h-5 w-5 object-contain" />
              ) : (
                <Hotel className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="font-bold">{branding.hotel_name || 'HotelOps Guest Portal'}</h1>
              <p className="text-xs text-muted-foreground">{branding.welcome_message || `Welcome, ${user?.profile?.full_name || 'Guest'}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <Button variant="outline" className="relative">
                <UtensilsCrossed className="h-4 w-4 mr-2" />
                Cart ({cart.length})
                <span className="ml-2 font-bold">{formatMoney(cartTotal * exchangeRate)}</span>
              </Button>
            )}
            <GuestProfileDialog />
            <GuestPreferencesDialog open={showPreferences} onOpenChange={setShowPreferences} />
            <Button variant="outline" onClick={() => setShowConcierge(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Concierge
            </Button>
            <Button variant="outline" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Hotel Services</h2>
          <p className="text-muted-foreground">Browse available rooms, order food, and access hotel services</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 border-2 sm:grid-cols-6">
            <TabsTrigger value="my-stay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Home className="mr-2 h-4 w-4" />
              My Stay
            </TabsTrigger>
            <TabsTrigger value="rooms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bed className="mr-2 h-4 w-4" />
              Rooms
            </TabsTrigger>
            <TabsTrigger value="menu" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="mr-2 h-4 w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="services" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Phone className="mr-2 h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* My Stay Tab */}
          <TabsContent value="my-stay" className="space-y-6">
            {activeStay ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Current Stay</h3>
                    <p className="text-sm text-muted-foreground">
                      Room {activeStay.rooms?.room_number || activeStay.room_id}
                    </p>
                  </div>
                  <Badge variant="secondary">{nightsRemaining} night{nightsRemaining === 1 ? '' : 's'} remaining</Badge>
                </div>

                <Card className="border-2">
                  <CardHeader>
                    <CardTitle>Room {activeStay.rooms?.room_number || activeStay.room_id}</CardTitle>
                    <CardDescription>
                      {(activeStay.rooms?.room_type && getRoomTypeLabel(activeStay.rooms.room_type)) || 'Hotel room'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="border-2 border-border p-3">
                        <p className="text-xs text-muted-foreground">Check in</p>
                        <p className="font-bold">{new Date(activeStay.check_in_date).toLocaleDateString()}</p>
                      </div>
                      <div className="border-2 border-border p-3">
                        <p className="text-xs text-muted-foreground">Check out</p>
                        <p className="font-bold">{new Date(activeStay.check_out_date).toLocaleDateString()}</p>
                      </div>
                      <div className="border-2 border-border p-3">
                        <p className="text-xs text-muted-foreground">Folio balance</p>
                        <p className="font-bold">{formatMoney(Number(activeStay.total_amount || 0))}</p>
                      </div>
                      <div className="border-2 border-border p-3">
                        <p className="text-xs text-muted-foreground">Guest</p>
                        <p className="font-bold">{activeStay.guest_name}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <Button onClick={() => setActiveTab('menu')}>
                        <UtensilsCrossed className="mr-2 h-4 w-4" />
                        Order Food
                      </Button>
                      <Button variant="outline" onClick={() => handleHousekeepingRequest('Guest requested housekeeping from My Stay')}>
                        <Coffee className="mr-2 h-4 w-4" />
                        Request Housekeeping
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('services')}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Report Issue
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('billing')}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        View Full Bill
                      </Button>
                      <Button variant="outline" onClick={handleRequestCheckout}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Request Checkout
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-2">
                <CardContent className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                  <Bed className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-bold">No active stay yet</h3>
                    <p className="text-sm text-muted-foreground">Book or hold a room to unlock in-stay services.</p>
                  </div>
                  <Button onClick={() => setActiveTab('rooms')}>Browse Rooms</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Available Room Types</h3>
                <p className="text-sm text-muted-foreground">Choose a room type. Your exact room number is assigned after booking.</p>
              </div>
              <Badge variant="secondary">{rooms.length} rooms available</Badge>
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <Label>Room Type</Label>
              <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                <SelectTrigger className="border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {roomPackages.map(roomPackage => (
                    <SelectItem key={roomPackage.room_type} value={roomPackage.room_type}>
                      {getRoomTypeLabel(roomPackage.room_type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-pulse text-muted-foreground">Loading rooms...</div>
              </div>
            ) : roomPackages.length === 0 ? (
              <Card className="border-2">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No rooms currently available. Please contact reception.
                </CardContent>
              </Card>
            ) : displayedRoomPackages.length === 0 ? (
              <Card className="border-2">
                <CardContent className="py-8 text-center text-muted-foreground">
                  This room type is not currently available. Please choose another type.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedRoomPackages.map(roomPackage => (
                  <Card key={roomPackage.room_type} className="border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{getRoomTypeLabel(roomPackage.room_type)} Room</CardTitle>
                          <CardDescription>Automatically assigned after booking</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-primary/10">
                          {formatMoney(roomPackage.price_per_night * exchangeRate)}/night
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>Up to {roomPackage.capacity} guests</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{roomPackage.available_count} available for auto-assignment</span>
                        </div>
                      </div>
                      
                      {roomPackage.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {roomPackage.amenities.slice(0, 4).map(amenity => (
                            <Badge key={amenity} variant="secondary" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                          {roomPackage.amenities.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{roomPackage.amenities.length - 4} more
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="w-full">
                            <Calendar className="mr-2 h-4 w-4" />
                            Book This Type
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto border-2 p-4 sm:max-w-lg sm:p-5">
                          <DialogHeader className="space-y-1 text-left">
                            <DialogTitle className="text-base sm:text-lg">Book {getRoomTypeLabel(roomPackage.room_type)} Room</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                              Enter stay details. We will assign an available room automatically.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-2 gap-2 border-2 border-border p-3 text-xs sm:text-sm">
                              <div>
                                <p className="text-muted-foreground">Type</p>
                                <p className="font-medium">{getRoomTypeLabel(roomPackage.room_type)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Assignment</p>
                                <p className="font-medium">After booking</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Capacity</p>
                                <p className="font-medium">Up to {roomPackage.capacity} guests</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Available</p>
                                <p className="font-medium">{roomPackage.available_count} room{roomPackage.available_count === 1 ? '' : 's'}</p>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Guest Name</Label>
                                <Input
                                  value={bookingDetails.guestName}
                                  onChange={(event) => setBookingDetails({ ...bookingDetails, guestName: event.target.value })}
                                  className="border-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Email</Label>
                                <Input
                                  type="email"
                                  value={bookingDetails.guestEmail}
                                  onChange={(event) => setBookingDetails({ ...bookingDetails, guestEmail: event.target.value })}
                                  className="border-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Phone</Label>
                                <Input
                                  value={bookingDetails.guestPhone}
                                  onChange={(event) => setBookingDetails({ ...bookingDetails, guestPhone: event.target.value })}
                                  className="border-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Country</Label>
                                <Select value={bookingCountry} onValueChange={setBookingCountry}>
                                  <SelectTrigger className="border-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COUNTRY_OPTIONS.map(option => (
                                      <SelectItem key={option.country} value={option.country}>
                                        {option.country} ({option.currency})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label>Check In</Label>
                                <Input
                                  type="date"
                                  value={bookingDetails.checkInDate}
                                  onChange={(event) => setBookingDetails({ ...bookingDetails, checkInDate: event.target.value })}
                                  className="border-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Check Out</Label>
                                <Input
                                  type="date"
                                  value={bookingDetails.checkOutDate}
                                  onChange={(event) => setBookingDetails({ ...bookingDetails, checkOutDate: event.target.value })}
                                  className="border-2"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5 border-2 border-border p-3">
                              <div className="flex justify-between text-sm">
                                <span>Base rate</span>
                                <span>{formatMoney(roomPackage.price_per_night, 'USD')} / night</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Nights</span>
                                <span>{bookingNights}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Live rate</span>
                                <span>{isRateLoading ? 'Loading...' : `1 USD = ${exchangeRate.toFixed(4)} ${selectedCountry.currency}`}</span>
                              </div>
                              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                                <span>Total</span>
                                <span>{formatMoney(roomPackage.price_per_night * bookingNights * exchangeRate)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Stripe collects payment in {selectedCountry.currency}. Room number appears after booking.
                              </p>
                            </div>

                            <div className="sticky bottom-0 -mx-4 border-t-2 border-border bg-background px-4 pb-1 pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                              {paymentConfig?.active_gateway && paymentConfig.active_gateway !== 'stripe' && (
                                <p className="mb-2 border-2 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800">
                                  {paymentConfig.active_gateway.replace('_', ' ')} is selected for this hotel. Use Hold Room or pay at reception.
                                </p>
                              )}
                              {(!paymentConfig?.active_gateway || paymentConfig.active_gateway === 'stripe') && !paymentConfig?.stripe_configured && (
                                <p className="mb-2 border-2 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800">
                                  Stripe needs keys in Portal Settings. Use Hold Room until it is configured.
                                </p>
                              )}
                              {paymentConfig?.stripe_configured && paymentConfig.mode_matches === false && (
                                <p className="mb-2 border-2 border-destructive bg-destructive/5 p-2 text-xs text-destructive">
                                  Stripe public and secret keys are in different modes.
                                </p>
                              )}
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Button className="w-full" onClick={() => handleStripeBooking(roomPackage)} disabled={isCheckingOut || isRateLoading || (paymentConfig?.active_gateway || 'stripe') !== 'stripe' || !paymentConfig?.stripe_configured || paymentConfig.mode_matches === false}>
                                  {isCheckingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                                  Pay & Book
                                </Button>
                                <Button className="w-full" variant="outline" onClick={() => handleManualBooking(roomPackage)} disabled={isCheckingOut}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Hold Type
                                </Button>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-6">
            <MenuSuggestionCard 
              menuItems={menuItems.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                price: item.price,
                category: item.category_name || 'Other',
              }))}
              preferences={preferences}
              autoSuggest
              formatMoney={(amount) => formatMoney(amount * exchangeRate)}
              onOpenPreferences={() => setShowPreferences(true)}
              onSelectItem={(itemId) => {
                const item = menuItems.find(i => i.id === itemId);
                if (item) addToCart(item);
              }}
            />

            {Object.entries(menuByCategory).map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-3 text-lg font-bold">{category}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(item => (
                    <Card key={item.id} className="border-2">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{item.name}</CardTitle>
                            <CardDescription className="text-sm">{item.description}</CardDescription>
                          </div>
                          <span className="font-bold">{formatMoney(item.price * exchangeRate)}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => addToCart(item)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add to Order
                        </Button>
                        {item.menu_item_customizations && item.menu_item_customizations.filter(option => option.is_available).length > 0 && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            {item.menu_item_customizations.filter(option => option.is_available).map(option => (
                              <label key={option.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2">
                                  <Checkbox
                                    checked={(selectedOptions[item.id] || []).includes(option.id)}
                                    onCheckedChange={() => toggleOption(item.id, option.id)}
                                  />
                                  {option.name}
                                </span>
                                <span className="text-muted-foreground">
                                  {Number(option.price) > 0 ? `+${formatMoney(Number(option.price) * exchangeRate)}` : 'Free'}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {menuItems.length === 0 && !loading && (
              <Card className="border-2">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Menu items are currently being updated. Please check back later.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <OrderTracker />
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
            <h3 className="text-lg font-bold">Hotel Services</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Room Service
                  </CardTitle>
                  <CardDescription>24/7 in-room dining and requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Call extension 0 for immediate assistance or use the menu tab to order food.
                  </p>
                  <Button variant="outline" className="w-full">
                    <Phone className="mr-2 h-4 w-4" />
                    Call Room Service
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coffee className="h-5 w-5" />
                    Housekeeping
                  </CardTitle>
                  <CardDescription>Room cleaning and amenity requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Request extra towels, pillows, toiletries, or cleaning service.
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Request Housekeeping
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-2">
                      <DialogHeader>
                        <DialogTitle>Request Housekeeping</DialogTitle>
                        <DialogDescription>
                          Tell the team what you need for Room {activeStay?.rooms?.room_number || ''}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Textarea
                          value={housekeepingNotes}
                          onChange={(event) => setHousekeepingNotes(event.target.value)}
                          placeholder="Extra towels, room cleaning, toiletries..."
                          className="border-2"
                        />
                        <Button className="w-full" onClick={() => handleHousekeepingRequest()}>
                          Send Request
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card className="border-2 cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    WiFi & Tech Support
                  </CardTitle>
                  <CardDescription>Internet access and technical assistance</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Network: HotelOps_Guest<br />
                    Password: Available at reception
                  </p>
                  <Button variant="outline" className="w-full">
                    <Phone className="mr-2 h-4 w-4" />
                    Tech Support
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Complaints & Feedback
                  </CardTitle>
                  <CardDescription>We value your feedback</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Report issues or share suggestions to help us improve your stay.
                  </p>
                  <Button variant="outline" className="w-full">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <GuestBillingTab />
          </TabsContent>
        </Tabs>
      </main>
      
      {/* AI Concierge Chat */}
      <AIConciergeChat isOpen={showConcierge} onClose={() => setShowConcierge(false)} />
    </div>
  );
}
