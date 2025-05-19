
import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface StatisticsChartProps {
  data: Array<{
    title: string;
    viewCount: number;
    uniqueViewers: number;
    lastViewed: string | null;
  }>;
}

export function StatisticsChart({ data }: StatisticsChartProps) {
  // Sort data by view count in descending order
  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) => b.viewCount - a.viewCount);
  }, [data]);

  // Chart configuration - removed uniqueViewers from config
  const chartConfig = {
    views: {
      label: "Views",
      theme: {
        light: '#319F43',
        dark: '#319F43',
      }
    }
  };

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No data available to display chart</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-md font-semibold mb-4">Policy Category View Metrics</h3>
      <div className="h-[400px]">
        <ChartContainer className="w-full h-full" config={chartConfig}>
          <RechartsBarChart
            data={sortedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="title" 
              angle={-45} 
              textAnchor="end"
              height={70}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar dataKey="viewCount" name="views" fill="var(--color-views)" />
          </RechartsBarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
