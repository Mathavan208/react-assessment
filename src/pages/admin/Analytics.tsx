import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../../utils/firebase';
import {type Submission,type User,type Assessment } from '../../types';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText,
  Award,
  Calendar,
  Target,
  Clock
} from 'lucide-react';
import { formatDate, groupBy, calculateAverage } from '../../utils/helpers';

interface AnalyticsData {
  totalUsers: number;
  totalAssessments: number;
  totalSubmissions: number;
  averageScore: number;
  completionRate: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  scoreDistribution: Record<string, number>;
  assessmentPerformance: Array<{
    assessmentId: string;
    title: string;
    submissions: number;
    averageScore: number;
    difficulty: string;
  }>;
  userEngagement: Array<{
    userId: string;
    name: string;
    submissions: number;
    averageScore: number;
    lastSubmission: string;
  }>;
  timeSeriesData: Array<{
    date: string;
    submissions: number;
    averageScore: number;
  }>;
}

function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Fetch all required data
    const usersQuery = query(collection(db, 'users'));
    const assessmentsQuery = query(collection(db, 'assessments'));
    const submissionsQuery = query(collection(db, 'submissions'), orderBy('createdAt', 'desc'));

    let users: User[] = [];
    let assessments: Assessment[] = [];
    let submissions: Submission[] = [];

    // Users listener
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      users = snapshot.docs.map(doc => ({ ...doc.data() } as User));
      if (users.length && assessments.length && submissions.length) {
        calculateAnalytics();
      }
    });
    unsubscribers.push(unsubUsers);

    // Assessments listener
    const unsubAssessments = onSnapshot(assessmentsQuery, (snapshot) => {
      assessments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment));
      if (users.length && assessments.length && submissions.length) {
        calculateAnalytics();
      }
    });
    unsubscribers.push(unsubAssessments);

    // Submissions listener
    const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      calculateAnalytics();
    });
    unsubscribers.push(unsubSubmissions);

    function calculateAnalytics() {
      if (!users.length || !assessments.length) return;

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Filter submissions based on time range
      const filteredSubmissions = submissions.filter(submission => {
        const submissionDate = new Date(submission.createdAt);
        switch (timeRange) {
          case 'week':
            return submissionDate >= oneWeekAgo;
          case 'month':
            return submissionDate >= oneMonthAgo;
          default:
            return true;
        }
      });

      // Basic stats
      const totalUsers = users.filter(u => u.role === 'user').length;
      const totalAssessments = assessments.length;
      const totalSubmissions = filteredSubmissions.length;
      const averageScore = filteredSubmissions.length > 0 
        ? calculateAverage(filteredSubmissions.map(s => s.score))
        : 0;

      // Completion rate (users who have completed at least one assessment)
      const usersWithSubmissions = new Set(filteredSubmissions.map(s => s.uid));
      const completionRate = totalUsers > 0 ? (usersWithSubmissions.size / totalUsers) * 100 : 0;

      // Recent submissions
      const submissionsThisWeek = submissions.filter(s => 
        new Date(s.createdAt) >= oneWeekAgo
      ).length;
      const submissionsThisMonth = submissions.filter(s => 
        new Date(s.createdAt) >= oneMonthAgo
      ).length;

      // Score distribution
      const scoreRanges = {
        'Excellent (90-100)': filteredSubmissions.filter(s => s.score >= 90).length,
        'Good (70-89)': filteredSubmissions.filter(s => s.score >= 70 && s.score < 90).length,
        'Average (50-69)': filteredSubmissions.filter(s => s.score >= 50 && s.score < 70).length,
        'Poor (0-49)': filteredSubmissions.filter(s => s.score < 50).length,
      };

      // Assessment performance
      const submissionsByAssessment = groupBy(filteredSubmissions, 'assessmentId');
      const assessmentPerformance = assessments.map(assessment => {
        const assessmentSubmissions = submissionsByAssessment[assessment.id] || [];
        return {
          assessmentId: assessment.id,
          title: assessment.title,
          submissions: assessmentSubmissions.length,
          averageScore: assessmentSubmissions.length > 0 
            ? calculateAverage(assessmentSubmissions.map(s => s.score))
            : 0,
          difficulty: assessment.difficulty
        };
      }).sort((a, b) => b.submissions - a.submissions);

      // User engagement
      const submissionsByUser = groupBy(filteredSubmissions, 'uid');
      const userEngagement = users
        .filter(user => user.role === 'user')
        .map(user => {
          const userSubmissions = submissionsByUser[user.uid] || [];
          const lastSubmission = userSubmissions.length > 0 
            ? userSubmissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
            : null;
          
          return {
            userId: user.uid,
            name: user.name,
            submissions: userSubmissions.length,
            averageScore: userSubmissions.length > 0 
              ? calculateAverage(userSubmissions.map(s => s.score))
              : 0,
            lastSubmission: lastSubmission ? lastSubmission.createdAt : ''
          };
        })
        .sort((a, b) => b.submissions - a.submissions)
        .slice(0, 10);

      // Time series data (last 30 days)
      const timeSeriesData: Array<{ date: string; submissions: number; averageScore: number }> = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const daySubmissions = submissions.filter(s => 
          s.createdAt.startsWith(dateStr)
        );
        
        timeSeriesData.push({
          date: dateStr,
          submissions: daySubmissions.length,
          averageScore: daySubmissions.length > 0 
            ? calculateAverage(daySubmissions.map(s => s.score))
            : 0
        });
      }

      setAnalytics({
        totalUsers,
        totalAssessments,
        totalSubmissions,
        averageScore: Math.round(averageScore),
        completionRate: Math.round(completionRate),
        submissionsThisWeek,
        submissionsThisMonth,
        scoreDistribution: scoreRanges,
        assessmentPerformance,
        userEngagement,
        timeSeriesData
      });
      
      setLoading(false);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [timeRange]);

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-32 h-32 border-b-2 border-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive insights into platform performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assessments</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.totalAssessments}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Submissions</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.totalSubmissions}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Award className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.averageScore}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.completionRate}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Target className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.submissionsThisWeek}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.submissionsThisMonth}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Score Distribution</h2>
        <div className="space-y-4">
          {Object.entries(analytics.scoreDistribution).map(([range, count]) => {
            const percentage = analytics.totalSubmissions > 0 
              ? (count / analytics.totalSubmissions) * 100 
              : 0;
            
            return (
              <div key={range} className="flex items-center">
                <div className="w-32 text-sm font-medium text-gray-700">{range}</div>
                <div className="flex-1 mx-4">
                  <div className="h-4 bg-gray-200 rounded-full">
                    <div 
                      className={`h-4 rounded-full ${
                        range.includes('Excellent') ? 'bg-green-500' :
                        range.includes('Good') ? 'bg-blue-500' :
                        range.includes('Average') ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 text-sm text-right text-gray-600">
                  {count} ({Math.round(percentage)}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assessment Performance */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Assessment Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Assessment
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Submissions
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Avg Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.assessmentPerformance.map((assessment) => (
                <tr key={assessment.assessmentId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {assessment.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      assessment.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                      assessment.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {assessment.difficulty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                    {assessment.submissions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 h-2 mr-2 bg-gray-200 rounded-full">
                        <div 
                          className="h-2 bg-blue-600 rounded-full"
                          style={{ width: `${assessment.averageScore}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-900">
                        {Math.round(assessment.averageScore)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Most Active Students</h2>
        <div className="space-y-3">
          {analytics.userEngagement.slice(0, 5).map((user, index) => (
            <div key={user.userId} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 mr-3 text-sm font-medium text-white bg-purple-600 rounded-full">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">
                    Last active: {user.lastSubmission ? formatDate(user.lastSubmission) : 'Never'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900">{user.submissions} submissions</div>
                <div className="text-sm text-gray-500">Avg: {Math.round(user.averageScore)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
