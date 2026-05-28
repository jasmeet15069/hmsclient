import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMenuSuggestions } from '@/hooks/useMenuSuggestions';
import { Sparkles, Loader2, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
}

interface MenuSuggestionCardProps {
  menuItems: MenuItem[];
  preferences?: {
    dietary_restrictions?: string[];
    allergies?: string[];
    favorite_categories?: string[];
    notes?: string | null;
  } | null;
  autoSuggest?: boolean;
  formatMoney?: (amount: number) => string;
  onOpenPreferences?: () => void;
  onSelectItem?: (itemId: string) => void;
}

const confidenceColors = {
  high: 'border-green-600 bg-green-50 text-green-800',
  medium: 'border-amber-600 bg-amber-50 text-amber-800',
  low: 'border-muted-foreground bg-muted text-muted-foreground',
};

export function MenuSuggestionCard({ menuItems, preferences, autoSuggest = false, formatMoney, onOpenPreferences, onSelectItem }: MenuSuggestionCardProps) {
  const { suggestions, isLoading, error, getSuggestions, clearSuggestions } = useMenuSuggestions();
  const autoRequested = useRef(false);

  const hasPreferences = useMemo(() => {
    return Boolean(
      (preferences?.dietary_restrictions?.length || 0) > 0 ||
      (preferences?.allergies?.length || 0) > 0 ||
      (preferences?.favorite_categories?.length || 0) > 0 ||
      preferences?.notes
    );
  }, [preferences]);

  const handleGetSuggestions = () => {
    if (menuItems.length === 0) return;
    getSuggestions(
      menuItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description,
      })),
      {
        dietaryRestrictions: preferences?.dietary_restrictions || [],
        allergies: preferences?.allergies || [],
        favoriteCategories: preferences?.favorite_categories || [],
        notes: preferences?.notes || '',
      },
      []
    );
  };

  useEffect(() => {
    if (!autoSuggest || autoRequested.current || !hasPreferences || menuItems.length === 0) return;
    autoRequested.current = true;
    handleGetSuggestions();
  }, [autoSuggest, hasPreferences, menuItems.length]);

  if (!hasPreferences) {
    return (
      <Card className="border-2 border-dashed border-primary/50 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <Sparkles className="mb-3 h-8 w-8 text-primary" />
          <h3 className="mb-2 font-bold">Recommended for You</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Set your dining preferences to get personalised menu recommendations.
          </p>
          {onOpenPreferences && (
            <Button variant="outline" onClick={onOpenPreferences}>
              Set Preferences
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!suggestions && !isLoading) {
    return (
      <Card className="border-2 border-dashed border-primary/50 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <Sparkles className="mb-3 h-8 w-8 text-primary" />
          <h3 className="mb-2 font-bold">AI Menu Suggestions</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Get personalized dish recommendations based on your preferences
          </p>
          <Button onClick={handleGetSuggestions} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get Suggestions
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finding perfect dishes for you...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2 border-destructive">
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <p className="mb-3 text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={handleGetSuggestions}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Recommended for You
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={clearSuggestions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {suggestions?.personalNote && (
          <CardDescription>{suggestions.personalNote}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions?.recommendations.map((rec, idx) => {
          const menuItem = menuItems.find(m => m.id === rec.itemId || m.name === rec.itemName);
          return (
            <div
              key={idx}
              className="flex items-start justify-between gap-3 border-2 p-3 transition-colors hover:bg-muted/50 cursor-pointer"
              onClick={() => menuItem && onSelectItem?.(menuItem.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{rec.itemName}</span>
                  <Badge className={cn('border', confidenceColors[rec.confidence])}>
                    {rec.confidence === 'high' && <Star className="mr-1 h-3 w-3 fill-current" />}
                    {rec.confidence}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>
              </div>
              {menuItem && (
                <span className="font-bold">{formatMoney ? formatMoney(menuItem.price) : `$${menuItem.price.toFixed(2)}`}</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
