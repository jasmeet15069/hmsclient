import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, GripVertical } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: boolean;
  preparation_time: number;
}

const mockMenuItems: MenuItem[] = [
  { id: '1', name: 'Continental Breakfast', description: 'Croissants, fresh fruits, yogurt, and coffee', price: 18.99, category: 'Breakfast', is_available: true, preparation_time: 15 },
  { id: '2', name: 'American Breakfast', description: 'Eggs, bacon, toast, hash browns', price: 22.99, category: 'Breakfast', is_available: true, preparation_time: 20 },
  { id: '3', name: 'Grilled Salmon', description: 'Atlantic salmon with seasonal vegetables', price: 32.99, category: 'Main Course', is_available: true, preparation_time: 25 },
  { id: '4', name: 'Beef Tenderloin', description: 'Prime cut with truffle mashed potatoes', price: 45.99, category: 'Main Course', is_available: false, preparation_time: 30 },
  { id: '5', name: 'Fresh Orange Juice', description: 'Freshly squeezed', price: 6.99, category: 'Beverages', is_available: true, preparation_time: 5 },
  { id: '6', name: 'Espresso', description: 'Double shot Italian espresso', price: 4.99, category: 'Beverages', is_available: true, preparation_time: 3 },
];

const categories = ['Breakfast', 'Main Course', 'Desserts', 'Beverages', 'Snacks'];

export default function MenuPage() {
  const [items, setItems] = useState(mockMenuItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const toggleAvailability = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, is_available: !item.is_available } : item
    ));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Menu Management</h2>
            <p className="text-muted-foreground">
              {items.length} items • {items.filter(i => i.is_available).length} available
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingItem(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="border-2">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="name">Item Name</Label>
                    <Input id="name" className="border-2" defaultValue={editingItem?.name} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" className="border-2" defaultValue={editingItem?.description} />
                  </div>
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input id="price" type="number" step="0.01" className="border-2" defaultValue={editingItem?.price} />
                  </div>
                  <div>
                    <Label htmlFor="prep_time">Prep Time (min)</Label>
                    <Input id="prep_time" type="number" className="border-2" defaultValue={editingItem?.preparation_time} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="available" defaultChecked={editingItem?.is_available ?? true} />
                  <Label htmlFor="available">Available for ordering</Label>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-2 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Menu Items by Category */}
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category}>
              <h3 className="mb-4 text-lg font-bold">{category}</h3>
              <div className="space-y-3">
                {categoryItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 border-2 p-4 transition-all ${
                      !item.is_available ? 'border-muted bg-muted/50 opacity-60' : 'border-border'
                    }`}
                  >
                    <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold">{item.name}</h4>
                        {!item.is_available && (
                          <span className="bg-muted px-2 py-0.5 text-xs font-medium">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="mt-1 text-sm">
                        <span className="font-medium">${item.price.toFixed(2)}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{item.preparation_time} min prep</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_available}
                        onCheckedChange={() => toggleAvailability(item.id)}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setEditingItem(item);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
