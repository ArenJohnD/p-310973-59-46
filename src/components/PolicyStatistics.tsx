
import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "./DatePickerWithRange";

export function PolicyStatistics() {
  console.log("PolicyStatistics component rendering");
  
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: today,
    to: today,
  });
  const [timeframe, setTimeframe] = useState<string>("today");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    console.log("Current timeframe:", timeframe);
    console.log("Current date range:", dateRange);
  }, [timeframe, dateRange]);

  // Subscribe to real-time updates for policy_views
  useEffect(() => {
    const channel = supabase
      .channel('policy_stats_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'policy_views'
        },
        (payload) => {
          console.log('New policy view detected:', payload);
          // Trigger a refresh of the query
          setRefreshTrigger(prev => prev + 1);
          toast({
            title: "Statistics Updated",
            description: "A new policy view has been recorded",
          });
        })
      .subscribe();

    return () => {
      // Clean up subscription when component unmounts
      supabase.removeChannel(channel);
    };
  }, []);

  const updateDateRange = (newTimeframe: string) => {
    console.log("Updating timeframe to:", newTimeframe);
    const today = new Date();
    let from = today;
    let to = today;

    switch (newTimeframe) {
      case "today":
        break;
      case "week":
        from = startOfWeek(today);
        to = endOfWeek(today);
        break;
      case "month":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "custom":
        return; // Don't update the date range for custom selection
      default:
        break;
    }

    setDateRange({ from, to });
    setTimeframe(newTimeframe);
  };

  // Get all categories first
  const { data: allCategories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['allPolicyCategories'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('policy_categories')
          .select('*')
          .order('display_order', { ascending: true });

        if (error) {
          console.error("Error fetching categories:", error);
          throw error;
        }
        
        console.log("All categories:", data);
        return data || [];
      } catch (error) {
        console.error('Error fetching all policy categories:', error);
        toast({
          title: "Error",
          description: "Failed to load policy categories",
          variant: "destructive",
        });
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });

  // Get view statistics
  const { data: viewStats, isLoading: isStatsLoading, error, refetch } = useQuery({
    queryKey: ['policyViewStats', dateRange?.from, dateRange?.to, refreshTrigger],
    queryFn: async () => {
      try {
        console.log("Fetching policy stats for date range:", 
          dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : 'undefined', 
          "to", 
          dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : 'undefined'
        );
        
        if (!dateRange?.from || !dateRange?.to) {
          console.log("Date range incomplete, returning empty array");
          return [];
        }

        // Format dates for SQL query - include beginning of from date and end of to date
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(addDays(dateRange.to, 1), 'yyyy-MM-dd');

        console.log("Querying with date range:", fromDate, "to", toDate);

        const { data, error } = await supabase
          .from('policy_views')
          .select(`
            category_id,
            viewed_at,
            viewer_id,
            policy_categories(title)
          `)
          .gte('viewed_at', fromDate)
          .lt('viewed_at', toDate);

        if (error) {
          console.error("Supabase query error:", error);
          throw error;
        }

        console.log("Raw view data from Supabase:", data);
        return data || [];
      } catch (error) {
        console.error('Error fetching policy view stats:', error);
        toast({
          title: "Error",
          description: "Failed to load policy statistics",
          variant: "destructive",
        });
        throw error;
      }
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Process statistics and combine with all categories
  const processedStats = React.useMemo(() => {
    if (!allCategories) return [];
    
    // Create a map with all categories first (including those with 0 views)
    const statsByCategory = allCategories.reduce((acc: any, category: any) => {
      acc[category.id] = {
        categoryId: category.id,
        title: category.title,
        viewCount: 0,
        uniqueViewers: new Set(),
        dates: new Set(),
      };
      return acc;
    }, {});
    
    // Then add view data where available
    if (viewStats && viewStats.length > 0) {
      viewStats.forEach((view: any) => {
        const categoryId = view.category_id;
        if (statsByCategory[categoryId]) {
          statsByCategory[categoryId].viewCount++;
          statsByCategory[categoryId].uniqueViewers.add(view.viewer_id);
          statsByCategory[categoryId].dates.add(format(new Date(view.viewed_at), 'yyyy-MM-dd'));
        }
      });
    }
    
    // Convert to array and process for display
    return Object.values(statsByCategory).map((category: any) => ({
      ...category,
      uniqueViewers: category.uniqueViewers.size,
      dates: Array.from(category.dates).sort(),
      lastViewed: category.dates.size > 0 
        ? Array.from(category.dates).sort().pop() 
        : null
    }));
  }, [allCategories, viewStats]);

  const isLoading = isCategoriesLoading || isStatsLoading;

  if (error) {
    console.error("React Query error:", error);
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Select
            value={timeframe}
            onValueChange={updateDateRange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {timeframe === 'custom' && (
            <DatePickerWithRange date={dateRange} onSelect={setDateRange} />
          )}
          
          <Button 
            onClick={() => refetch()}
            variant="outline"
            size="sm"
          >
            Refresh Data
          </Button>
        </div>
        
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <h3 className="text-lg font-medium">Error Loading Statistics</h3>
          <p>There was a problem loading the policy statistics. Please try again later.</p>
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Select
          value={timeframe}
          onValueChange={updateDateRange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {timeframe === 'custom' && (
          <DatePickerWithRange date={dateRange} onSelect={setDateRange} />
        )}
        
        <Button 
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          Refresh Data
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mb-2"></div>
          <p>Loading statistics...</p>
        </div>
      ) : processedStats.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processedStats.map((stat: any) => (
            <Card key={stat.categoryId} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.viewCount}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.uniqueViewers} unique viewers
                </p>
                {stat.lastViewed && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last viewed: {stat.lastViewed}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
          <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
          <p className="text-gray-500 max-w-md mx-auto mt-1">
            There are no policy views recorded for this time period. Try selecting a different date range or refresh the data.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => refetch()}
          >
            Refresh Data
          </Button>
        </div>
      )}
    </div>
  );
}
