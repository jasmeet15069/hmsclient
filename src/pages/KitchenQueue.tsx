import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { cn } from '@/lib/utils';
import { Clock, User, MapPin, ChevronRight, AlertTriangle } from 'lucide-react';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready';

interface KitchenOrder {
  id: string;
  orderNumber: string;
  roomNumber: string;
  guestName: string;
  items: { name: string; quantity: number; notes?: string }[];
  status: OrderStatus;
  createdAt: string;
  specialInstructions?: string;
  priority: 'normal' | 'rush';
}

const mockOrders: KitchenOrder[] = [
  {
    id: '1',
    orderNumber: '1040',
    roomNumber: '201',
    guestName: 'David Chen',
    items: [
      { name: 'Breakfast Set A', quantity: 2 },
      { name: 'Coffee', quantity: 2 },
      { name: 'Fresh Fruit Platter', quantity: 1 },
    ],
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    priority: 'rush',
  },
  {
    id: '2',
    orderNumber: '1041',
    roomNumber: '412',
    guestName: 'Maria Garcia',
    items: [
      { name: 'Grilled Salmon', quantity: 1 },
      { name: 'Steamed Vegetables', quantity: 1 },
    ],
    status: 'confirmed',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    priority: 'normal',
  },
  {
    id: '3',
    orderNumber: '1042',
    roomNumber: '305',
    guestName: 'John Smith',
    items: [
      { name: 'Club Sandwich', quantity: 2, notes: 'No onions' },
      { name: 'Caesar Salad', quantity: 1 },
      { name: 'Fresh Orange Juice', quantity: 2 },
    ],
    status: 'preparing',
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
    specialInstructions: 'Guest has a nut allergy',
    priority: 'normal',
  },
  {
    id: '4',
    orderNumber: '1039',
    roomNumber: '508',
    guestName: 'Emma Wilson',
    items: [
      { name: 'Beef Tenderloin', quantity: 1 },
      { name: 'Red Wine', quantity: 1 },
    ],
    status: 'ready',
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    priority: 'normal',
  },
];

const statusFlow: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];

export default function KitchenQueue() {
  const [orders, setOrders] = useState(mockOrders);

  const advanceOrder = (orderId: string) => {
    setOrders(prev =>
      prev.map(order => {
        if (order.id === orderId) {
          const currentIdx = statusFlow.indexOf(order.status);
          if (currentIdx < statusFlow.length - 1) {
            return { ...order, status: statusFlow[currentIdx + 1] };
          }
        }
        return order;
      })
    );
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getNextAction = (status: OrderStatus): string => {
    switch (status) {
      case 'pending': return 'Start Preparing';
      case 'confirmed': return 'Begin Cooking';
      case 'preparing': return 'Mark Ready';
      default: return 'Done';
    }
  };

  const columns: { status: OrderStatus; label: string }[] = [
    { status: 'pending', label: 'New Orders' },
    { status: 'confirmed', label: 'Confirmed' },
    { status: 'preparing', label: 'Cooking' },
    { status: 'ready', label: 'Ready for Pickup' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Kitchen Queue</h2>
            <p className="text-muted-foreground">
              {orders.length} active orders • Real-time updates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="animate-pulse bg-green-500 h-2 w-2 rounded-full" />
            <span className="text-sm font-medium">Live</span>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid gap-4 lg:grid-cols-4">
          {columns.map(column => {
            const columnOrders = orders.filter(o => o.status === column.status);
            
            return (
              <div key={column.status} className="space-y-3">
                <div className="flex items-center justify-between border-b-2 border-border pb-2">
                  <h3 className="font-bold">{column.label}</h3>
                  <span className="bg-muted px-2 py-0.5 text-sm font-bold">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnOrders.map(order => (
                    <div
                      key={order.id}
                      className={cn(
                        'border-2 bg-card p-4 transition-all hover:shadow-sm',
                        order.priority === 'rush' && 'border-destructive'
                      )}
                    >
                      {order.priority === 'rush' && (
                        <div className="mb-2 flex items-center gap-1 text-sm font-bold text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          RUSH ORDER
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-lg font-bold">#{order.orderNumber}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          Room {order.roomNumber}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {order.guestName}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {getTimeAgo(order.createdAt)}
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1 border-t border-border pt-3">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">{item.quantity}×</span> {item.name}
                            {item.notes && (
                              <span className="ml-1 text-muted-foreground">({item.notes})</span>
                            )}
                          </li>
                        ))}
                      </ul>

                      {order.specialInstructions && (
                        <div className="mt-3 border-l-2 border-destructive bg-destructive/5 p-2 text-sm">
                          <span className="font-bold text-destructive">⚠️</span> {order.specialInstructions}
                        </div>
                      )}

                      {order.status !== 'ready' && (
                        <Button
                          className="mt-4 w-full"
                          size="sm"
                          onClick={() => advanceOrder(order.id)}
                        >
                          {getNextAction(order.status)}
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {columnOrders.length === 0 && (
                    <div className="border-2 border-dashed border-border p-8 text-center text-muted-foreground">
                      No orders
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
