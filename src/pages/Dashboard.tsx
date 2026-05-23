import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClickableStatCard } from '@/components/dashboard/ClickableStatCard';
import { LiveOrderCard } from '@/components/dashboard/LiveOrderCard';
import { RoomStatusGrid } from '@/components/dashboard/RoomStatusGrid';
import { useRooms } from '@/hooks/useRooms';
import { useOrders } from '@/hooks/useOrders';
import { useGuestStays } from '@/hooks/useGuestStays';
import GuestDashboard from '@/pages/guest/GuestDashboard';
import { Bed, UtensilsCrossed, Clock, Users, ChefHat, Truck, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { hasRole, hasAnyRole } = useAuth();
  const { rooms, stats: roomStats, isLoading: roomsLoading } = useRooms();
  const { orders, stats: orderStats, isLoading: ordersLoading } = useOrders();
  const { todayCheckIns, currentGuests } = useGuestStays();

  const isReceptionist = hasRole('super_admin');
  const isAdmin = hasRole('admin');
  const isFoodManager = hasRole('food_manager');
  const isKitchenManager = hasRole('kitchen_manager');
  const isWaiter = hasRole('waiter');
  const isGuest = hasRole('guest') && !hasAnyRole(['super_admin', 'admin', 'food_manager', 'kitchen_manager', 'waiter']);

  const isLoading = roomsLoading || ordersLoading;

  // Show guest dashboard for guest-only users
  if (isGuest) {
    return <GuestDashboard />;
  }

  // Get active orders for live feed
  const activeOrders = orders
    .filter(o => !['delivered', 'cancelled'].includes(o.status))
    .slice(0, 5)
    .map(o => ({
      orderNumber: o.order_number,
      roomNumber: o.rooms?.room_number || 'N/A',
      guestName: o.guest_stays?.guest_name || 'Walk-in',
      items: o.order_items?.map(i => ({ name: i.menu_items?.name || 'Item', quantity: i.quantity })) || [],
      status: o.status as 'pending' | 'preparing' | 'ready',
      createdAt: o.created_at,
      specialInstructions: o.special_instructions || undefined,
    }));

  // Map rooms for grid
  const roomsForGrid = rooms.map(r => ({
    id: r.id,
    room_number: r.room_number,
    status: r.status as 'available' | 'occupied' | 'maintenance' | 'cleaning',
    floor: r.floor,
  }));

  if (isLoading) {
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            {isReceptionist && 'Front desk operations overview'}
            {isAdmin && 'Hotel operations overview'}
            {isFoodManager && 'Food & beverage operations'}
            {isKitchenManager && 'Kitchen operations status'}
            {isWaiter && 'Your delivery assignments'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(isReceptionist || isAdmin) && (
            <>
              <ClickableStatCard
                title="Rooms Occupied"
                value={`${roomStats.occupied}/${roomStats.total}`}
                subtitle={`${roomStats.total > 0 ? Math.round((roomStats.occupied / roomStats.total) * 100) : 0}% occupancy`}
                icon={<Bed className="h-5 w-5" />}
                variant="highlight"
                href="/rooms"
              />
              <ClickableStatCard
                title="Today's Check-ins"
                value={todayCheckIns.toString()}
                subtitle={`${currentGuests} current guests`}
                icon={<Users className="h-5 w-5" />}
                href="/guests"
              />
            </>
          )}
          
          {(isReceptionist || isKitchenManager || isFoodManager) && (
            <>
              <ClickableStatCard
                title="Active Orders"
                value={orderStats.pending + orderStats.preparing + orderStats.ready}
                subtitle={`${orderStats.ready} ready for pickup`}
                icon={<UtensilsCrossed className="h-5 w-5" />}
                href={isReceptionist ? '/place-order' : '/kitchen'}
              />
              <ClickableStatCard
                title="Avg. Prep Time"
                value="18m"
                subtitle="2m faster than target"
                icon={<Clock className="h-5 w-5" />}
                trend={{ value: 8, isPositive: true }}
                href="/kitchen"
              />
            </>
          )}

          {isKitchenManager && (
            <ClickableStatCard
              title="Orders in Queue"
              value={orderStats.pending + orderStats.preparing}
              icon={<ChefHat className="h-5 w-5" />}
              href="/kitchen"
            />
          )}

          {isWaiter && (
            <ClickableStatCard
              title="My Deliveries Today"
              value={orderStats.ready}
              icon={<Truck className="h-5 w-5" />}
              href="/deliveries"
            />
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {hasAnyRole(['super_admin', 'kitchen_manager', 'waiter']) && activeOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Live Orders</h3>
                <span className="bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">LIVE</span>
              </div>
              <div className="space-y-3">
                {activeOrders.map(order => (
                  <LiveOrderCard key={order.orderNumber} {...order} />
                ))}
              </div>
            </div>
          )}

          {(isReceptionist || isAdmin) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Room Status</h3>
              <div className="border-2 border-border p-4">
                <RoomStatusGrid rooms={roomsForGrid} />
              </div>
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
