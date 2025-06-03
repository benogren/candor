// components/WeeklyMetricsCards.tsx
'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, MoveDownRight, MoveRight, MoveUpRight, Send, Star } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import supabase from '@/lib/supabase/client';

interface WeeklyMetrics {
  feedbackReceived: {
    current: number;
    previous: number;
    trend: number;
  };
  feedbackProvided: {
    current: number;
    previous: number;
    trend: number;
  };
  healthScore: {
    current: number;
    previous: number;
    trend: number;
  };
}

interface WeeklyMetricsCardsProps {
  userId: string;
  mode: 'personal' | 'team';
  selectedMemberId?: string;
}

export function WeeklyMetricsCards({ userId, mode, selectedMemberId }: WeeklyMetricsCardsProps) {
  const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null);
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

        // const response = await fetch(`/api/dashboard/weekly-metrics?${params}`);
        const response = await fetch(`/api/dashboard/weekly-metrics?${params}`, {
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
        console.error('Error fetching weekly metrics:', err);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [userId, mode, selectedMemberId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
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
          {error || 'Failed to load weekly metrics'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Health Score Card */}
      <MetricCard
        title={mode === 'team' ? "My Team's Feedback Health Score" : 'Feedback Health Score'}
        subtitle="Overall feedback health score"
        value={metrics.healthScore.current}
        previousValue={metrics.healthScore.previous}
        trend={metrics.healthScore.trend}
        icon={<Star className="h-6 w-6" />}
        iconColor="text-amber-600"
        iconBgColor="bg-amber-100"
        isScore={true}
      />
      
      {/* Feedback Received Card */}
      <MetricCard
        title={mode === 'team' ? "My Team's Feedback" : 'Feedback this Week'}
        subtitle="Total feedback received"
        value={metrics.feedbackReceived.current}
        previousValue={metrics.feedbackReceived.previous}
        trend={metrics.feedbackReceived.trend}
        icon={<MessageSquare className="h-6 w-6" />}
        iconColor="text-cerulean-500"
        iconBgColor="bg-cerulean-100"
      />

      {/* Feedback Provided Card */}
      <MetricCard
        title={mode === 'team' ? "My Team's Participation" : 'Participation this Week'}
        subtitle="Total feedback provided"
        value={metrics.feedbackProvided.current}
        previousValue={metrics.feedbackProvided.previous}
        trend={metrics.feedbackProvided.trend}
        icon={<Send className="h-6 w-6" />}
        iconColor="text-berkeleyblue"
        iconBgColor="bg-berkeleyblue-100"
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
}

function MetricCard({
  title,
  subtitle,
  value,
  previousValue,
  trend,
  isScore = false
}: MetricCardProps) {
  const formatValue = (val: number) => {
    if (isScore) {
      return val.toFixed(1);
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
      return <span className="text-green-600 items-center flex"><MoveUpRight className='h-3 w-3 mr-2' /> new this week</span>;
    }
    if (previousValue === 0 && value === 0) {
      return <span className="text-gray-500 items-center flex"><MoveRight className='h-3 w-3 mr-2' /> no change</span>;
    }
    
    return (
      <span className={getTrendColor(trend)}>
        {getTrendArrow(trend)} {formatTrend(trend)} from last week
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
      {/* <div className="flex items-center mb-4">
        <div className={`p-2 rounded-lg ${iconBgColor}`}>
          <div className={iconColor}>
            {icon}
          </div>
        </div>
      </div> */}

      <div className="">
        <h3 className='text-base font-light text-berkeleyblue mb-3'>
          {title}
        </h3>
        <div className="">
            <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-berkeleyblue">
                {formatValue(value)}
                </span>
                {isScore && <span className="text-sm text-gray-500">/100</span>}
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