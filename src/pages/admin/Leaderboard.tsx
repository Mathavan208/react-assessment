import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { type User } from '../../types';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Calendar,
  Target,
  Users,
  Star,
  Crown,
  Zap,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../../utils/helpers';

interface CompletedEntry {
  assessmentId: string;
  score: number;
  completedAt?: any; // Firestore Timestamp | string | number
  createdAt?: any;   // optional legacy alias
  submittedAt?: any; // optional legacy alias
}

interface LeaderboardEntry extends User {
  rank: number;
  recentSubmissions: number;
  lastActive: string | number | Date;
  completionRate: number;
  averageScore: number;
  badge: string;
  derivedTotalScore: number;
  derivedCompletedCount: number;
}

function Leaderboard() {
  const [participants, setParticipants] = useState<User[]>([]);
  const [totalAssessments, setTotalAssessments] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('all');
  const [viewMode, setViewMode] = useState<'score' | 'submissions' | 'recent'>('score');

  // Utility: normalize any Firestore Timestamp/string/number to ms
  const toMs = (v: any): number => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return new Date(v).getTime() || 0;
    if (typeof v?.toMillis === 'function') return v.toMillis() || 0;
    return 0;
  };

  // Utility: get date from a completion entry
  const completionDateMs = (entry: CompletedEntry): number => {
    return (
      toMs(entry.completedAt) ||
      toMs(entry.submittedAt) ||
      toMs(entry.createdAt)
    );
  };

  // Listen to users (role == 'user'); orderBy can be createdAt (sorting later in code)
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'user'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      snap => {
        const items: User[] = [];
        snap.forEach(d => items.push({ ...(d.data() as User) }));
        setParticipants(items);
        setLoading(false);
      },
      err => {
        console.error('users onSnapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Listen to assessments to compute completion rate denominator
  useEffect(() => {
    const q = query(collection(db, 'assessments'));
    const unsub = onSnapshot(
      q,
      snap => {
        setTotalAssessments(snap.size);
      },
      err => console.error('assessments onSnapshot error', err)
    );
    return () => unsub();
  }, []);

  // Compute leaderboard whenever inputs change
  useEffect(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const data: LeaderboardEntry[] = participants.map((user) => {
      const completedRaw = Array.isArray(user.assessmentsCompleted)
        ? (user.assessmentsCompleted as unknown as CompletedEntry[])
        : [];

      // Filter by time if completion timestamps exist
      const filtered = completedRaw.filter((entry) => {
        if (timeFilter === 'all') return true;
        const ms = completionDateMs(entry);
        if (!ms) return timeFilter === 'all';
        if (timeFilter === 'week') return ms >= oneWeekAgo;
        if (timeFilter === 'month') return ms >= oneMonthAgo;
        return true;
      });

      // Scores and counts
      const sumAll = completedRaw.reduce((s, e) => s + (e.score || 0), 0);
      const sumFiltered = filtered.reduce((s, e) => s + (e.score || 0), 0);
      const avgFiltered =
        filtered.length > 0 ? Math.round(sumFiltered / filtered.length) : 0;

      const lastMs = Math.max(
        0,
        ...completedRaw.map((e) => completionDateMs(e)).filter(Boolean),
        toMs((user as any).updatedAt),
        toMs((user as any).lastActive),
        toMs(user.createdAt)
      );

      // Completion rate vs total assessments
      const uniqueCompleted = new Set(
        completedRaw.map((e) => e.assessmentId).filter(Boolean)
      ).size;
      const completionRate =
        totalAssessments > 0
          ? Math.round((uniqueCompleted / totalAssessments) * 100)
          : 0;

      // Badge logic based on derived totals
      let badge = 'Beginner';
      const derivedTotal = sumAll;
      if (derivedTotal >= 500 && uniqueCompleted >= 5) badge = 'Expert';
      else if (derivedTotal >= 300 && uniqueCompleted >= 3) badge = 'Advanced';
      else if (derivedTotal >= 100 && uniqueCompleted >= 1) badge = 'Intermediate';

      return {
        ...user,
        derivedTotalScore: derivedTotal,
        derivedCompletedCount: uniqueCompleted,
        rank: 0, // provisional, set after sorting
        recentSubmissions: filtered.length, // activity per time filter
        lastActive: lastMs || user.createdAt || new Date().toISOString(),
        completionRate,
        averageScore: avgFiltered,
        badge,
      };
    });

    // Sort by viewMode
    let sorted = [...data];
    switch (viewMode) {
      case 'submissions':
        sorted.sort((a, b) => b.recentSubmissions - a.recentSubmissions);
        break;
      case 'recent':
        sorted.sort((a, b) => toMs(b.lastActive) - toMs(a.lastActive));
        break;
      case 'score':
      default:
        sorted.sort((a, b) => (b.derivedTotalScore || 0) - (a.derivedTotalScore || 0));
        break;
    }

    // Assign rank after sorting
    sorted = sorted.map((e, i) => ({ ...e, rank: i + 1 }));

    setLeaderboard(sorted);
  }, [participants, totalAssessments, timeFilter, viewMode]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'Expert':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Advanced':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Intermediate':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const topPerformers = leaderboard.slice(0, 3);
  const stats = {
    totalParticipants: leaderboard.length,
    averageScore:
      leaderboard.length > 0
        ? Math.round(
            leaderboard.reduce((s, e) => s + (e.derivedTotalScore || 0), 0) /
              Math.max(1, leaderboard.length)
          )
        : 0,
    activeThisWeek: leaderboard.filter(
      (e) => toMs(e.lastActive) >= Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length,
    topPerformerScore: leaderboard?.derivedTotalScore || 0,
  };

  if (loading) {
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
          <h1 className="flex items-center text-2xl font-bold text-gray-900">
            <Trophy className="w-8 h-8 mr-3 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-gray-600">Top performing students and their achievements</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
          </select>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="score">By Total Score</option>
            <option value="submissions">By Activity</option>
            <option value="recent">By Recency</option>
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Participants</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalParticipants}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageScore}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeThisWeek}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Crown className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Top Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats.topPerformerScore}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {topPerformers.length > 0 && (
        <div className="p-8 rounded-lg bg-gradient-to-r from-yellow-50 to-purple-50">
          <h2 className="mb-6 text-xl font-bold text-center text-gray-900">🏆 Top Performers</h2>
          <div className="flex items-end justify-center space-x-8">
            {/* 2nd */}
            {topPerformers[21] && (
              <div className="text-center">
                <div className="p-6 mb-4 transition-transform transform bg-white rounded-lg shadow-lg hover:scale-105">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 bg-gray-400 rounded-full">
                    <span className="text-xl font-bold text-white">
                      {topPerformers[21].name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{topPerformers[21].name}</h3>
                  <p className="mt-2 text-2xl font-bold text-gray-700">
                    {topPerformers[21].derivedTotalScore}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 border ${getBadgeColor(
                      topPerformers[21].badge
                    )}`}
                  >
                    {topPerformers[21].badge}
                  </span>
                </div>
                <div className="flex items-center justify-center w-20 h-24 bg-gray-400 rounded-t-lg">
                  <Medal className="w-8 h-8 text-white" />
                </div>
                <div className="px-4 py-2 font-bold text-white bg-gray-500 rounded-b-lg">2nd</div>
              </div>
            )}

            {/* 1st */}
            <div className="text-center">
              <div className="p-6 mb-4 transition-transform transform bg-white border-2 border-yellow-300 rounded-lg shadow-xl hover:scale-105">
                <div className="flex items-center justify-center w-20 h-20 mx-auto mb-3 bg-yellow-500 rounded-full">
                  <span className="text-2xl font-bold text-white">
                    {topPerformers.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{topPerformers.name}</h3>
                <p className="mt-2 text-3xl font-bold text-yellow-600">
                  {topPerformers.derivedTotalScore}
                </p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 border ${getBadgeColor(
                    topPerformers.badge
                  )}`}
                >
                  {topPerformers.badge}
                </span>
              </div>
              <div className="flex items-center justify-center w-20 h-32 bg-yellow-500 rounded-t-lg">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <div className="px-4 py-2 font-bold text-white bg-yellow-600 rounded-b-lg">1st</div>
            </div>

            {/* 3rd */}
            {topPerformers[22] && (
              <div className="text-center">
                <div className="p-6 mb-4 transition-transform transform bg-white rounded-lg shadow-lg hover:scale-105">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 rounded-full bg-amber-600">
                    <span className="text-xl font-bold text-white">
                      {topPerformers[22].name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{topPerformers[22].name}</h3>
                  <p className="mt-2 text-2xl font-bold text-amber-600">
                    {topPerformers[22].derivedTotalScore}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 border ${getBadgeColor(
                      topPerformers[22].badge
                    )}`}
                  >
                    {topPerformers[22].badge}
                  </span>
                </div>
                <div className="flex items-center justify-center w-20 h-20 rounded-t-lg bg-amber-600">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="px-4 py-2 font-bold text-white rounded-b-lg bg-amber-700">3rd</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="overflow-hidden bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Complete Rankings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Student
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Badge
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Total Score
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Avg Score
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Completed
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((entry) => (
                <tr key={entry.uid} className={`hover:bg-gray-50 ${entry.rank <= 3 ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">{getRankIcon(entry.rank)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-10 h-10 mr-3 bg-purple-600 rounded-full">
                        <span className="font-medium text-white">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.name}</div>
                        <div className="text-sm text-gray-500">{entry.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getBadgeColor(entry.badge)}`}>
                      {entry.badge}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-yellow-400" />
                      <span className="text-lg font-bold text-gray-900">{entry.derivedTotalScore || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{entry.averageScore}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {entry.derivedCompletedCount}
                      <div className="text-xs text-gray-500">{entry.completionRate}% complete</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      <div>
                        <div>{formatRelativeTime(entry.lastActive)}</div>
                        <div className="text-xs">{formatDate(entry.lastActive)}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leaderboard.length === 0 && (
          <div className="py-12 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No participants yet</h3>
            <p className="text-gray-600">The leaderboard will populate as students complete assessments.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
