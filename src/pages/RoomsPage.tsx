import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RoomStatusGrid } from '@/components/dashboard/RoomStatusGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRooms } from '@/hooks/useRooms';
import { Plus, Filter, Loader2, Trash2 } from 'lucide-react';

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning';

export default function RoomsPage() {
  const { rooms, stats, isLoading, createRoom, updateRoom, deleteRoom } = useRooms();
  const [selectedRoom, setSelectedRoom] = useState<typeof rooms[0] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    room_number: '',
    room_type: 'Standard',
    floor: 1,
    capacity: 2,
    price_per_night: 150,
  });

  const filteredRooms = statusFilter === 'all' 
    ? rooms 
    : rooms.filter(r => r.status === statusFilter);

  const handleCreateRoom = async () => {
    const success = await createRoom({
      ...newRoom,
      status: 'available',
    });
    if (success) {
      setIsCreateOpen(false);
      setNewRoom({ room_number: '', room_type: 'Standard', floor: 1, capacity: 2, price_per_night: 150 });
    }
  };

  const handleUpdateStatus = async (status: RoomStatus) => {
    if (!selectedRoom) return;
    await updateRoom(selectedRoom.id, { status });
    setSelectedRoom(null);
  };

  const handleDelete = async () => {
    if (!selectedRoom) return;
    await deleteRoom(selectedRoom.id);
    setSelectedRoom(null);
  };

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Room Management</h2>
            <p className="text-muted-foreground">
              {stats.available} available • {stats.occupied} occupied • {stats.total} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 border-2">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rooms</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Room</Button>
              </DialogTrigger>
              <DialogContent className="border-2">
                <DialogHeader><DialogTitle>Add New Room</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Room Number</Label><Input value={newRoom.room_number} onChange={(e) => setNewRoom({...newRoom, room_number: e.target.value})} className="mt-1 border-2" /></div>
                  <div><Label>Type</Label><Select value={newRoom.room_type} onValueChange={(v) => setNewRoom({...newRoom, room_type: v})}><SelectTrigger className="mt-1 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Standard">Standard</SelectItem><SelectItem value="Deluxe">Deluxe</SelectItem><SelectItem value="Suite">Suite</SelectItem><SelectItem value="Penthouse">Penthouse</SelectItem></SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Floor</Label><Input type="number" value={newRoom.floor} onChange={(e) => setNewRoom({...newRoom, floor: parseInt(e.target.value)})} className="mt-1 border-2" /></div>
                    <div><Label>Capacity</Label><Input type="number" value={newRoom.capacity} onChange={(e) => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} className="mt-1 border-2" /></div>
                  </div>
                  <div><Label>Price/Night ($)</Label><Input type="number" value={newRoom.price_per_night} onChange={(e) => setNewRoom({...newRoom, price_per_night: parseFloat(e.target.value)})} className="mt-1 border-2" /></div>
                  <Button className="w-full" onClick={handleCreateRoom}>Create Room</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Available', value: stats.available, color: 'border-green-600 bg-green-50' },
            { label: 'Occupied', value: stats.occupied, color: 'border-primary bg-primary/5' },
            { label: 'Cleaning', value: stats.cleaning, color: 'border-amber-600 bg-amber-50' },
            { label: 'Maintenance', value: stats.maintenance, color: 'border-destructive bg-destructive/5' },
          ].map(stat => (
            <div key={stat.label} className={`border-2 p-4 ${stat.color}`}>
              <p className="text-sm font-medium">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="border-2 border-border p-6">
          <RoomStatusGrid rooms={filteredRooms.map(r => ({ ...r, room_number: r.room_number, status: r.status as RoomStatus }))} onRoomClick={(room) => setSelectedRoom(rooms.find(r => r.id === room.id) || null)} />
        </div>

        <Dialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
          <DialogContent className="border-2">
            <DialogHeader><DialogTitle>Room {selectedRoom?.room_number}</DialogTitle></DialogHeader>
            {selectedRoom && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-muted-foreground">Type</Label><p className="font-medium">{selectedRoom.room_type}</p></div>
                  <div><Label className="text-muted-foreground">Floor</Label><p className="font-medium">{selectedRoom.floor}</p></div>
                  <div><Label className="text-muted-foreground">Capacity</Label><p className="font-medium">{selectedRoom.capacity} guests</p></div>
                  <div><Label className="text-muted-foreground">Rate</Label><p className="font-medium">${selectedRoom.price_per_night}/night</p></div>
                </div>
                <div>
                  <Label>Update Status</Label>
                  <Select value={selectedRoom.status} onValueChange={(v) => handleUpdateStatus(v as RoomStatus)}>
                    <SelectTrigger className="mt-1 border-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedRoom(null)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
