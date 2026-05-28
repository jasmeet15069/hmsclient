import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenu } from '@/hooks/useMenu';
import { useRooms } from '@/hooks/useRooms';
import { useGuestStays } from '@/hooks/useGuestStays';
import { useOrders } from '@/hooks/useOrders';
import { UtensilsCrossed, Plus, Minus, ShoppingCart, Loader2, Search, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

const COUNTRY_OPTIONS = [
  { country: 'United States', currency: 'USD', locale: 'en-US' },
  { country: 'India', currency: 'INR', locale: 'en-IN' },
  { country: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { country: 'European Union', currency: 'EUR', locale: 'de-DE' },
  { country: 'United Arab Emirates', currency: 'AED', locale: 'en-AE' },
  { country: 'Canada', currency: 'CAD', locale: 'en-CA' },
  { country: 'Australia', currency: 'AUD', locale: 'en-AU' },
  { country: 'Singapore', currency: 'SGD', locale: 'en-SG' },
  { country: 'Japan', currency: 'JPY', locale: 'ja-JP' },
  { country: 'South Korea', currency: 'KRW', locale: 'ko-KR' },
];

export default function PlaceOrderPage() {
  const { items: menuItems, categories, isLoading: menuLoading, refetch: refetchMenu } = useMenu();
  const { rooms } = useRooms();
  const { stays } = useGuestStays();
  const { createOrder } = useOrders();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedStayId, setSelectedStayId] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCountryName, setSelectedCountryName] = useState(COUNTRY_OPTIONS[0].country);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [isRefreshingMenu, setIsRefreshingMenu] = useState(false);

  // Get current guests (checked in but not checked out)
  const currentGuests = stays.filter(s => s.actual_check_in && !s.actual_check_out);
  const occupiedRooms = rooms.filter(r => r.status === 'occupied');
  const selectedCountry = COUNTRY_OPTIONS.find(option => option.country === selectedCountryName) || COUNTRY_OPTIONS[0];

  useEffect(() => {
    let cancelled = false;

    if (selectedCountry.currency === 'USD') {
      setExchangeRate(1);
      setIsRateLoading(false);
      setRateError(null);
      return;
    }

    setIsRateLoading(true);
    setRateError(null);
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/exchange-rate?base=USD&target=${selectedCountry.currency}`)
      .then(response => response.json())
      .then(payload => {
        if (cancelled) return;
        if (payload.error) throw new Error(payload.error);
        setExchangeRate(Number(payload.data.rate));
      })
      .catch(() => {
        if (cancelled) return;
        setExchangeRate(1);
        setRateError('Live rate unavailable. Showing USD pricing.');
      })
      .finally(() => {
        if (!cancelled) setIsRateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCountry.currency]);

  useEffect(() => {
    const refreshOnFocus = () => refetchMenu();
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [refetchMenu]);

  const handleRefreshMenu = async () => {
    setIsRefreshingMenu(true);
    await refetchMenu();
    setIsRefreshingMenu(false);
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory && item.is_available;
  });

  const addToCart = (item: typeof menuItems[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.id === id) {
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          return { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const convertedCartTotal = cartTotal * exchangeRate;
  const formatMoney = (amount: number, currency = selectedCountry.currency) =>
    new Intl.NumberFormat(selectedCountry.locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(amount);

  const handleSubmitOrder = async () => {
    if (cart.length === 0 || !selectedRoomId) return;

    setIsSubmitting(true);
    
    const order = await createOrder(
      {
        room_id: selectedRoomId,
        guest_stay_id: selectedStayId || null,
        total_amount: cartTotal,
        special_instructions: specialInstructions || null,
        status: 'pending',
      },
      cart.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        notes: item.notes || null,
      }))
    );

    if (order) {
      setCart([]);
      setSelectedRoomId('');
      setSelectedStayId('');
      setSpecialInstructions('');
    }
    setIsSubmitting(false);
  };

  if (menuLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Menu Section */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Place Order</h2>
              <p className="text-muted-foreground">Select items from the menu</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefreshMenu} aria-label="Refresh menu" title="Refresh menu">
              <RefreshCw className={cn('h-4 w-4', isRefreshingMenu && 'animate-spin')} />
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-2 pl-9"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40 border-2">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Menu Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.id === item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'cursor-pointer border-2 p-4 transition-all hover:shadow-sm',
                    inCart && 'border-primary bg-primary/5'
                  )}
                  onClick={() => addToCart(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold">{item.name}</h4>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono font-bold">{formatMoney(Number(item.price) * exchangeRate)}</span>
                        <span className="text-xs text-muted-foreground">
                          • {item.preparation_time}min
                        </span>
                      </div>
                    </div>
                    {inCart && (
                      <Badge className="ml-2">{inCart.quantity}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-2 py-12 text-center text-muted-foreground">
                No items found
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card className="border-2 sticky top-4">
            <CardHeader className="border-b-2 pb-4">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Order Cart
                {cart.length > 0 && (
                  <Badge variant="secondary">{cart.length} items</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Room Selection */}
              <div>
                <label className="text-sm font-medium">Room *</label>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger className="mt-1 border-2">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {occupiedRooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        Room {room.room_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Guest Selection (optional) */}
              {currentGuests.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Guest (optional)</label>
                  <Select value={selectedStayId} onValueChange={setSelectedStayId}>
                    <SelectTrigger className="mt-1 border-2">
                      <SelectValue placeholder="Select guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentGuests.map(stay => (
                        <SelectItem key={stay.id} value={stay.id}>
                          {stay.guest_name} - Room {stay.rooms?.room_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Currency Selection */}
              <div>
                <label className="text-sm font-medium">Country / Currency</label>
                <Select value={selectedCountryName} onValueChange={setSelectedCountryName}>
                  <SelectTrigger className="mt-1 border-2">
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
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Live rate</span>
                  <span>{isRateLoading ? 'Loading...' : `1 USD = ${exchangeRate.toFixed(4)} ${selectedCountry.currency}`}</span>
                </div>
                {rateError && <p className="mt-1 text-xs text-destructive">{rateError}</p>}
              </div>

              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <UtensilsCrossed className="mx-auto h-8 w-8 opacity-50" />
                  <p className="mt-2">No items in cart</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between border-b pb-2">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatMoney(item.price * exchangeRate)} x {item.quantity}
                        </p>
                        <p className="hidden">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-mono">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Special Instructions */}
              <div>
                <label className="text-sm font-medium">Special Instructions</label>
                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests..."
                  className="mt-1 border-2"
                  rows={2}
                />
              </div>

              {/* Total & Submit */}
              <div className="border-t-2 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatMoney(convertedCartTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>Base USD</span>
                  <span>{formatMoney(cartTotal, 'USD')}</span>
                </div>
                <Button
                  className="mt-4 w-full"
                  disabled={cart.length === 0 || !selectedRoomId || isSubmitting || isRateLoading}
                  onClick={handleSubmitOrder}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UtensilsCrossed className="mr-2 h-4 w-4" />
                  )}
                  Place Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
