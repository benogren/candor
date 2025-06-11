// components/MonthlyMetricsCards.tsx
'use client';

import { useState, useEffect } from 'react';
import { MoveDownRight, MoveRight, MoveUpRight, TrendingUp, BarChart3, ChartScatter, HeartPulse, MessageCircleQuestion } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import supabase from '@/lib/supabase/client';

interface WeeklySentimentData {
  week: string;
  receivedSentiment: number | null;
  providedSentiment: number | null;
}

interface MonthlyMetrics {
  feedbackReceived: {
    current: number;
    previous: number;
    trend: number;
  };
  participationRate: {
    current: number;
    previous: number;
    trend: number;
  };
  healthScore: {
    current: number;
    previous: number;
    trend: number;
  };
  weeklySentiment: WeeklySentimentData[];
}

interface MonthlyMetricsCardsProps {
  userId: string;
  mode: 'personal' | 'team';
  selectedMemberId?: string;
}

// Types for recharts Tooltip
interface TooltipPayload {
  color: string;
  name: string;
  value: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

export function MonthlyMetricsCards({ userId, mode, selectedMemberId }: MonthlyMetricsCardsProps) {
  const [metrics, setMetrics] = useState<MonthlyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
    
        if (!token) {
            throw new Error('Authentication required');
        }

        const params = new URLSearchParams({
          userId,
          mode,
        });

        if (selectedMemberId) {
            params.append('selectedMemberId', selectedMemberId);
        } 

        const response = await fetch(`/api/dashboard/monthly-metrics?${params}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching monthly metrics:', err);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [userId, mode, selectedMemberId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-center h-24">
              <LoadingSpinner />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <p className="text-red-600">
          {error || 'Failed to load monthly metrics'}
        </p>
      </div>
    );
  }

  const getTitle = (baseTitle: string) => {
    if (mode === 'team') {
      if (selectedMemberId === 'all' || !selectedMemberId) {
        return `${baseTitle} (Team)`;
      } else {
        return baseTitle; // Individual employee view
      }
    }
    return baseTitle; // Personal view
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Feedback Received Card */}
      <MetricCard
        title={getTitle('Feedback this Month')}
        subtitle="Total feedback received"
        value={metrics.feedbackReceived.current}
        previousValue={metrics.feedbackReceived.previous}
        trend={metrics.feedbackReceived.trend}
        icon={<MessageCircleQuestion className="h-4 w-4 text-cerulean-400 mr-2 flex-shrink-0" />}
        iconColor="text-cerulean-500"
        iconBgColor="bg-cerulean-100"
      />

      {/* Feedback Health Score Card */}
      <MetricCard
        title={getTitle('Feedback Health Score')}
        subtitle="Running monthly health score"
        value={metrics.healthScore.current}
        previousValue={metrics.healthScore.previous}
        trend={metrics.healthScore.trend}
        icon={<HeartPulse className="h-4 w-4 text-cerulean-400 mr-2 flex-shrink-0" />}
        iconColor="text-amber-600"
        iconBgColor="bg-amber-100"
        isScore={true}
      />

      {/* Participation Rate Card */}
      <MetricCard
        title={getTitle('Participation Rate')}
        subtitle="Feedback cycles participated in"
        value={metrics.participationRate.current}
        previousValue={metrics.participationRate.previous}
        trend={metrics.participationRate.trend}
        icon={<TrendingUp className="h-4 w-4 text-cerulean-400 mr-2 flex-shrink-0" />}
        iconColor="text-berkeleyblue"
        iconBgColor="bg-berkeleyblue-100"
        isPercentage={true}
      />

      {/* Sentiment Trend Card */}
      <SentimentTrendCard
        title={getTitle('Sentiment Trends')}
        subtitle="Weekly sentiment over time"
        data={metrics.weeklySentiment}
        mode={mode}
        selectedMemberId={selectedMemberId}
      />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  subtitle: string;
  value: number;
  previousValue: number;
  trend: number;
  icon: React.ReactNode;
  iconColor: string;
  iconBgColor: string;
  isScore?: boolean;
  isPercentage?: boolean;
}

function MetricCard({
  title,
  subtitle,
  value,
  previousValue,
  trend,
  icon,
  isScore = false,
  isPercentage = false
}: MetricCardProps) {
  const formatValue = (val: number) => {
    if (isScore) {
      return val.toFixed(1);
    }
    if (isPercentage) {
      return val.toFixed(0);
    }
    return val.toString();
  };

  const formatTrend = (trendValue: number) => {
    if (trendValue === 0) return '0%';
    const sign = trendValue > 0 ? '+' : '';
    return `${sign}${trendValue.toFixed(1)}%`;
  };

  const getTrendColor = (trendValue: number) => {
    if (trendValue > 0) return 'text-green-600 items-center flex';
    if (trendValue < 0) return 'text-red-600 items-center flex';
    return 'text-gray-500 items-center flex';
  };

  const getTrendArrow = (trendValue: number) => {
    if (trendValue > 0) return <MoveUpRight className='h-3 w-3 mr-2' />;
    if (trendValue < 0) return <MoveDownRight className='h-3 w-3 mr-2' />;
    return <MoveRight className='h-3 w-3 mr-2' />;
  };

  const getTrendText = () => {
    if (previousValue === 0 && value > 0) {
      return <span className="text-green-600 items-center flex"><MoveUpRight className='h-3 w-3 mr-2' /> new this month</span>;
    }
    if (previousValue === 0 && value === 0) {
      return <span className="text-gray-500 items-center flex"><MoveRight className='h-3 w-3 mr-2' /> no change</span>;
    }
    
    return (
      <span className={getTrendColor(trend)}>
        {getTrendArrow(trend)} {formatTrend(trend)} from last month
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <div className="">
        <div className="flex items-center min-w-0 flex-1 mb-10">
          {icon}
          <h3 className='text-base font-light text-cerulean'>
            {title}
          </h3>
        </div>
        <div className="">
            <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-berkeleyblue">
                {formatValue(value)}
                </span>
                {isScore && <span className="text-sm text-gray-500">/100</span>}
                {isPercentage && <span className="text-sm text-gray-500">%</span>}
            </div>
            <div className="text-sm text-gray-500 mb-2">
                {subtitle}
            </div>
            <div className="text-sm">
                {getTrendText()}
            </div>
        </div>
      </div>
    </div>
  );
}

interface SentimentTrendCardProps {
  title: string;
  subtitle: string;
  data: WeeklySentimentData[];
  mode: 'personal' | 'team';
  selectedMemberId?: string;
}

function SentimentTrendCard({
  title,
  data
}: SentimentTrendCardProps) {
  const formatTooltipValue = (value: number | null) => {
    if (value === null) return 'No data';
    
    // Round to nearest standard sentiment value for consistent display
    const roundedValue = Math.round(value * 2) / 2; // Rounds to nearest 0.5
    
    // Convert sentiment value to readable label
    if (roundedValue === -1) return 'Very Negative';
    if (roundedValue === -0.5) return 'Negative';
    if (roundedValue === 0) return 'Neutral';
    if (roundedValue === 0.5) return 'Positive';
    if (roundedValue === 1) return 'Very Positive';
    
    // Fallback for unexpected values
    return `${value.toFixed(1)} (${value > 0 ? 'Positive' : value < 0 ? 'Negative' : 'Neutral'})`;
  };

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{`Week of ${label}`}</p>
          {payload.map((entry: TooltipPayload, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${formatTooltipValue(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatYAxisTick = (value: number) => {
    if (value === -1) return 'Very Neg';
    if (value === -0.5) return 'Neg';
    if (value === 0) return 'Neutral';
    if (value === 0.5) return 'Pos';
    if (value === 1) return 'Very Pos';
    return value.toString();
  };

  const hasData = data.some(item => 
    item.receivedSentiment !== null || item.providedSentiment !== null
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <div className="">
        <div className="flex items-center min-w-0 flex-1 mb-6">
          <ChartScatter className="h-4 w-4 text-cerulean-400 mr-2 flex-shrink-0" />
          <h3 className='text-base font-light text-cerulean'>
            {title}
          </h3>
        </div>
        
        {hasData ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                  tick={{ fontSize: 8 }}
                  tickFormatter={formatYAxisTick}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="receivedSentiment" 
                  stroke="#0891b2" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  name="Received"
                />
                <Line 
                  type="monotone" 
                  dataKey="providedSentiment" 
                  stroke="#1e40af" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  name="Provided"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No sentiment data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}