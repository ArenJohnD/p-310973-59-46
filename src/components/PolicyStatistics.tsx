
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

  useEffect(() => {
    console.log("Current timeframe:", timeframe);
    console.log("Current date range:", dateRange);
  }, [timeframe, dateRange]);

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

  const { data: viewStats, isLoading, error } = useQuery({
    queryKey: ['policyViewStats', dateRange?.from, dateRange?.to],
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

        const { data, error } = await supabase
          .from('policy_view_stats')
          .select(`
            category_id,
            viewed_at,
            viewer_id,
            policy_categories(title)
          `)
          .gte('viewed_at', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('viewed_at', format(addDays(dateRange.to, 1), 'yyyy-MM-dd'));

        if (error) {
          console.error("Supabase query error:", error);
          throw error;
        }

        console.log("Raw data from Supabase:", data);

        // Process the data to aggregate views by category
        const categoryCounts = data.reduce((acc: any, view: any) => {
          const categoryId = view.category_id;
          if (!acc[categoryId]) {
            acc[categoryId] = {
              categoryId,
              title: view.policy_categories?.title || 'Unknown Category',
              viewCount: 0,
              uniqueViewers: new Set(),
              dates: new Set(),
            };
          }
          acc[categoryId].viewCount++;
          acc[categoryId].uniqueViewers.add(view.viewer_id);
          acc[categoryId].dates.add(format(new Date(view.viewed_at), 'yyyy-MM-dd'));
          return acc;
        }, {});

        const processedData = Object.values(categoryCounts).map((category: any) => ({
          ...category,
          uniqueViewers: category.uniqueViewers.size,
          dates: Array.from(category.dates).sort(),
        }));
        
        console.log("Processed stats data:", processedData);
        return processedData;
      } catch (error) {
        console.error('Error fetching policy view stats:', error);
        toast({
          title: "Error",
          description: "Failed to load policy statistics",
          variant: "destructive",
        });
        throw error; // Re-throw to let React Query handle it
      }
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    retry: 1,
  });

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
        </div>
        
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <h3 className="text-lg font-medium">Error Loading Statistics</h3>
          <p>There was a problem loading the policy statistics. Please try again later.</p>
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Reload Page
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
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mb-2"></div>
          <p>Loading statistics...</p>
        </div>
      ) : viewStats && viewStats.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {viewStats.map((stat: any) => (
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
                <div className="mt-2 text-xs text-muted-foreground">
                  Last viewed: {stat.dates[stat.dates.length - 1]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
          <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
          <p className="text-gray-500 max-w-md mx-auto mt-1">
            There are no policy views recorded for this time period. Try selecting a different date range.
          </p>
        </div>
      )}
    </div>
  );
}
