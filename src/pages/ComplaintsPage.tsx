import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ComplaintAnalysisPanel } from '@/components/ai/ComplaintAnalysisPanel';
import { Plus, Search, Clock, User, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface Complaint {
  id: string;
  complaint_number: string;
  guest_name: string;
  room_number: string;
  category: string;
  priority: Priority;
  status: ComplaintStatus;
  description: string;
  resolution?: string;
  created_at: string;
}

const mockComplaints: Complaint[] = [
  {
    id: '1',
    complaint_number: 'C-001',
    guest_name: 'John Smith',
    room_number: '305',
    category: 'Room Service',
    priority: 'high',
    status: 'open',
    description: 'Order arrived cold after 45 minutes wait. Requested refund.',
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: '2',
    complaint_number: 'C-002',
    guest_name: 'Maria Garcia',
    room_number: '412',
    category: 'Housekeeping',
    priority: 'medium',
    status: 'in_progress',
    description: 'Room not cleaned properly. Found hair in bathroom.',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: '3',
    complaint_number: 'C-003',
    guest_name: 'David Chen',
    room_number: '201',
    category: 'Noise',
    priority: 'low',
    status: 'resolved',
    description: 'Noise from adjacent room late at night.',
    resolution: 'Spoke with guests in room 202. Issue resolved.',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: '4',
    complaint_number: 'C-004',
    guest_name: 'Emma Wilson',
    room_number: '508',
    category: 'Facilities',
    priority: 'critical',
    status: 'open',
    description: 'AC not working in room. Temperature very uncomfortable.',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
];

const priorityColors: Record<Priority, string> = {
  low: 'border-muted-foreground bg-muted text-muted-foreground',
  medium: 'border-amber-600 bg-amber-50 text-amber-800',
  high: 'border-orange-600 bg-orange-50 text-orange-800',
  critical: 'border-destructive bg-destructive/10 text-destructive',
};

const statusColors: Record<ComplaintStatus, string> = {
  open: 'border-destructive bg-destructive/10 text-destructive',
  in_progress: 'border-amber-600 bg-amber-50 text-amber-800',
  resolved: 'border-green-600 bg-green-50 text-green-800',
  closed: 'border-muted-foreground bg-muted text-muted-foreground',
};

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState(mockComplaints);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = c.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.complaint_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    open: complaints.filter(c => c.status === 'open').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    critical: complaints.filter(c => c.priority === 'critical' && c.status !== 'resolved').length,
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Complaints</h2>
            <p className="text-muted-foreground">
              {stats.open} open • {stats.in_progress} in progress • {stats.critical} critical
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Complaint
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-2 border-destructive bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">Open</p>
            <p className="text-3xl font-bold text-destructive">{stats.open}</p>
          </div>
          <div className="border-2 border-amber-600 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">In Progress</p>
            <p className="text-3xl font-bold text-amber-800">{stats.in_progress}</p>
          </div>
          <div className="border-2 border-red-700 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Critical Pending</p>
            <p className="text-3xl font-bold text-red-800">{stats.critical}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search complaints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-2 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 border-2">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Complaints List */}
        <div className="space-y-3">
          {filteredComplaints.map(complaint => (
            <div
              key={complaint.id}
              className={cn(
                'cursor-pointer border-2 p-4 transition-all hover:shadow-sm',
                complaint.priority === 'critical' && complaint.status === 'open' && 'border-destructive'
              )}
              onClick={() => setSelectedComplaint(complaint)}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold">{complaint.complaint_number}</span>
                    <Badge className={cn('border-2', priorityColors[complaint.priority])}>
                      {complaint.priority.toUpperCase()}
                    </Badge>
                    <Badge className={cn('border-2', statusColors[complaint.status])}>
                      {complaint.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {complaint.guest_name}
                    </span>
                    <span>Room {complaint.room_number}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {getTimeAgo(complaint.created_at)}
                    </span>
                  </div>

                  <p className="text-sm">{complaint.description}</p>
                </div>

                <Badge variant="outline">{complaint.category}</Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Complaint Detail Dialog */}
        <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
          <DialogContent className="border-2 max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedComplaint?.complaint_number}
                <Badge className={cn('border-2', selectedComplaint && priorityColors[selectedComplaint.priority])}>
                  {selectedComplaint?.priority.toUpperCase()}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            {selectedComplaint && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Guest</p>
                    <p className="font-medium">{selectedComplaint.guest_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Room</p>
                    <p className="font-medium">{selectedComplaint.room_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{selectedComplaint.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{getTimeAgo(selectedComplaint.created_at)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="mt-1 border-l-2 border-border pl-3">{selectedComplaint.description}</p>
                </div>

                {selectedComplaint.resolution && (
                  <div>
                    <p className="text-sm text-muted-foreground">Resolution</p>
                    <p className="mt-1 border-l-2 border-green-600 bg-green-50 p-2 text-sm">
                      {selectedComplaint.resolution}
                    </p>
                  </div>
                )}

                {selectedComplaint.status !== 'resolved' && selectedComplaint.status !== 'closed' && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-sm font-medium">Add Resolution</p>
                      <Textarea placeholder="Enter resolution details..." className="border-2" />
                    </div>
                    
                    {/* AI Analysis Panel */}
                    <ComplaintAnalysisPanel 
                      description={selectedComplaint.description}
                      category={selectedComplaint.category}
                      onAnalysisComplete={(analysis) => {
                        console.log('Apply AI suggestions:', analysis);
                        // Could auto-fill priority and resolution
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  {selectedComplaint.status === 'open' && (
                    <Button className="flex-1">Mark In Progress</Button>
                  )}
                  {selectedComplaint.status === 'in_progress' && (
                    <Button className="flex-1">Mark Resolved</Button>
                  )}
                  <Button variant="outline" onClick={() => setSelectedComplaint(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
