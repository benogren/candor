'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/loading-spinner';
import { TrendingUp, Building2, AlertTriangle, Users, Calendar, BarChart3 } from 'lucide-react';
import { radley } from '../../../fonts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WeeklySentimentTrend {
  week: string;
  receivedSentiment: number | null;
  providedSentiment: number | null;
  feedbackVolume: number;
}

interface ThemeAnalysis {
  theme: string;
  totalMentions: number;
  avgSentiment: number;
  negativeInstances: number;
  trendScore: number;
  priorityScore: number;
  trainingRecommendation: string;
}

interface TrainingInsightsData {
  sentimentTrends: WeeklySentimentTrend[];
  trainingNeeds: ThemeAnalysis[];
  metadata: {
    companyId: string;
    dateRange: {
      start: string;
      end: string;
    };
    totalUsers: number;
    totalWeeks: number;
  };
}

// Custom tooltip for the chart
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

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const formatSentiment = (value: number | null) => {
      if (value === null) return 'No data';
      if (value >= 0.5) return `${value.toFixed(2)} (Positive)`;
      if (value >= 0) return `${value.toFixed(2)} (Neutral)`;
      return `${value.toFixed(2)} (Negative)`;
    };

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900">{`Week of ${label}`}</p>
        {payload.map((entry: TooltipPayload, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${formatSentiment(entry.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrainingInsightsPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [data, setData] = useState<TrainingInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get company info
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      if (!user) return;

      try {
        const { data: memberData, error: memberError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (memberError) throw memberError;
        
        if (memberData) {
          setCompanyId(memberData.company_id);

          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('name')
            .eq('id', memberData.company_id)
            .single();

          if (companyError) throw companyError;
          setCompanyName(companyData.name);
        }
      } catch (error) {
        console.error('Error fetching company info:', error);
        setError('Failed to load company information');
      }
    };

    fetchCompanyInfo();
  }, [user]);

  // Fetch training insights data
  useEffect(() => {
    const fetchTrainingInsights = async () => {
      if (!companyId) return;

      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          throw new Error('Authentication required');
        }

        const response = await fetch(`/api/admin/training-insights?companyId=${companyId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch training insights');
        }

        const insightsData = await response.json();
        setData(insightsData);
      } catch (err) {
        console.error('Error fetching training insights:', err);
        setError('Failed to load training insights');
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingInsights();
  }, [companyId]);

  if (!user) {
    return <div>Please log in to access this page.</div>;
  }

  const getPriorityColor = (score: number) => {
    if (score >= 0.35) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 0.25) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 0.35) return 'High Priority';
    if (score >= 0.25) return 'Medium Priority';
    return 'Low Priority';
  };

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
        <div className="flex items-center">
          <div className="bg-nonphotoblue-600 rounded-md p-2 mr-4 items-center">
            <TrendingUp className="h-12 w-12 text-nonphotoblue-100" />
          </div>
          <div>
            <h1 className={`text-4xl font-light text-nonphotoblue-600 ${radley.className}`}>
              Training Insights: <strong className="font-medium">{companyName}</strong>
            </h1>
            <p className="text-slate-500">
              Organizational training needs based on feedback trends
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
          <span className="ml-2 text-gray-600">Loading training insights...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-cerulean-400 mr-2" />
                <h3 className="text-lg font-medium text-berkeleyblue">Active Users</h3>
              </div>
              <p className="text-3xl font-bold text-nonphotoblue-600 mt-2">{data.metadata.totalUsers}</p>
              <p className="text-sm text-gray-500">Providing feedback data</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-cerulean-400 mr-2" />
                <h3 className="text-lg font-medium text-berkeleyblue">Data Period</h3>
              </div>
              <p className="text-3xl font-bold text-nonphotoblue-600 mt-2">{data.metadata.totalWeeks}</p>
              <p className="text-sm text-gray-500">Weeks analyzed</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-cerulean-400 mr-2" />
                <h3 className="text-lg font-medium text-berkeleyblue">Training Areas</h3>
              </div>
              <p className="text-3xl font-bold text-nonphotoblue-600 mt-2">{data.trainingNeeds.length}</p>
              <p className="text-sm text-gray-500">Themes identified</p>
            </div>
          </div>

          {/* Sentiment Trends Chart */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <div className="flex items-center mb-6">
              <BarChart3 className="h-5 w-5 text-cerulean-400 mr-2" />
              <h2 className="text-xl font-medium text-berkeleyblue">Company-wide Sentiment Trends</h2>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.sentimentTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[-1, 1]}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="receivedSentiment" 
                    stroke="#0891b2" 
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls={false}
                    name="Received Feedback"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="providedSentiment" 
                    stroke="#1e40af" 
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls={false}
                    name="Provided Feedback"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Training Needs Table */}
          <div className="bg-white rounded-lg shadow-md border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-cerulean-400 mr-2" />
                <h2 className="text-xl font-medium text-berkeleyblue">Recommended Training Areas</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Prioritized by frequency, negative sentiment, and declining trends
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Theme
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mentions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Training Recommendation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.trainingNeeds.map((theme, index) => (
                    <tr key={theme.theme} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {theme.theme}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(theme.priorityScore)}`}>
                          {getPriorityLabel(theme.priorityScore)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {theme.totalMentions}
                        <span className="text-gray-500 ml-1">
                          ({theme.negativeInstances} negative)
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {theme.avgSentiment.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {theme.trainingRecommendation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No training insights data available</p>
        </div>
      )}
    </div>
  );
}