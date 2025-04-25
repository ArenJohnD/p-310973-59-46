import React, { useState, useEffect } from "react";
import { Calendar, BarChart } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2 } from "lucide-react";

export function PolicyStatistics() {
  console.log("PolicyStatistics component rendering");
  
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(today.setHours(0, 0, 0, 0)), // Start of today
    to: new Date(today.setHours(23, 59, 59, 999)) // End of today
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
    let from = new Date(today.setHours(0, 0, 0, 0));
    let to = new Date(today.setHours(23, 59, 59, 999));

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

        // For today, use exact timestamps, for other timeframes use date-only comparison
        const { data, error } = await supabase
          .from('policy_views')
          .select(`
            category_id,
            viewed_at,
            viewer_id,
            policy_categories(title)
          `)
          .gte('viewed_at', timeframe === 'today' ? dateRange.from.toISOString() : format(dateRange.from, 'yyyy-MM-dd'))
          .lt('viewed_at', timeframe === 'today' ? dateRange.to.toISOString() : format(addDays(dateRange.to, 1), 'yyyy-MM-dd'));

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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart className="h-5 w-5 text-[rgba(49,159,67,1)]" />
              Policy Statistics
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Track and analyze policy document views
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-medium">
              {processedStats.length} {processedStats.length === 1 ? 'category' : 'categories'}
            </Badge>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
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
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[rgba(49,159,67,1)]" />
              <p className="text-sm text-gray-600">Loading statistics...</p>
            </div>
          </div>
        ) : processedStats.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {processedStats.map((stat: any) => (
              <Card key={stat.categoryId} className="group hover:shadow-md transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className="p-2 bg-[rgba(49,159,67,0.1)] rounded-lg group-hover:bg-[rgba(49,159,67,0.2)] transition-colors">
                    <BarChart className="h-4 w-4 text-[rgba(49,159,67,1)]" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-2xl font-bold text-[rgba(49,159,67,1)]">
                        {stat.viewCount}
                      </div>
                      <p className="text-xs text-gray-500">Total Views</p>
                    </div>
                    {stat.lastViewed && (
                      <div className="flex items-center justify-end text-sm">
                        <div className="text-right">
                          <p className="font-medium">{format(new Date(stat.lastViewed), 'MMM d')}</p>
                          <p className="text-xs text-gray-500">Last Viewed</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
              <BarChart className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Data Available</h3>
            <p className="text-sm text-gray-500 max-w-sm mt-2">
              There are no policy views recorded for this time period. Try selecting a different date range.
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
    </div>
  );
}