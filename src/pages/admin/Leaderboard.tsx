import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { type User } from '../../types';
import { Trophy, Medal, Award, Calendar, Target, Users, Star, Crown, Zap } from 'lucide-react';
import { formatDate, formatRelativeTime } from '../../utils/helpers';

function Leaderboard() {
  const [participants, setParticipants] = useState<User[]>([]);
  const [totalAssessments, setTotalAssessments] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Utility: coerce Firestore Timestamp | string | number | Date to ms
  const toMs = (v: any): number => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return new Date(v).getTime() || 0;
    if (v instanceof Date) return v.getTime() || 0;
    if (typeof v?.toMillis === 'function') return v.toMillis() || 0;
    return 0;
  };

  // Realtime users
  useEffect(() => {
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      qUsers,
      (snap) => {
        const items: User[] = [];
        snap.forEach((d) => items.push({ ...(d.data() as User) }));
        setParticipants(items);
        setLoading(false);
      },
      (err) => {
        console.error('users onSnapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Realtime assessments (optional denominator)
  useEffect(() => {
    const qAsmt = query(collection(db, 'assessments'));
    const unsub = onSnapshot(
      qAsmt,
      (snap) => setTotalAssessments(snap.size),
      (err) => console.error('assessments onSnapshot error', err)
    );
    return () => unsub();
  }, []);

  // Build leaderboard for React course only
  useEffect(() => {
    const data = participants
      .filter((u: any) => {
        const arr = Array.isArray(u?.enrolledCourses) ? u.enrolledCourses : [];
        const lower = arr.map((x: any) => String(x).toLowerCase());
        return lower.includes('react');
      })
      .map((user: any) => {
        // assessmentsCompleted is an object map keyed by assessmentId (per your screenshot)
        const acRaw =
          user?.assessmentsCompleted && typeof user.assessmentsCompleted === 'object'
            ? user.assessmentsCompleted
            : {};

        // Normalize into array of { assessmentId, title, score, completedDate }
        const entries = Object.entries(acRaw).map(([assessmentId, val]: any) => {
          const title = String(val?.title ?? '');
          const score = Number(val?.score ?? 0) || 0;
          const completedDate =
            val?.completedDate ?? val?.completedAt ?? val?.submittedAt ?? val?.createdAt ?? null;
          return { assessmentId, title, score, completedDate };
        });

        // React-only entries by title
        const reactEntries = entries.filter((e) => /react/i.test(String(e.title || '')));

        // Best React score
        const bestScore = reactEntries.reduce((max, e) => (e.score > max ? e.score : max), 0);

        // Last active timestamp normalized to ISO string (avoids getTime on non-Date)
        const lastMs = Math.max(
          0,
          ...entries.map((e) => toMs(e.completedDate)).filter(Boolean),
          toMs(user?.updatedAt),
          toMs(user?.lastActive),
          toMs(user?.createdAt)
        );
        const lastActiveISO = lastMs ? new Date(lastMs).toISOString() : new Date().toISOString();

        // Simple badge tiers
        let badge = 'Beginner';
        if (bestScore >= 90) badge = 'Expert';
        else if (bestScore >= 75) badge = 'Advanced';
        else if (bestScore >= 50) badge = 'Intermediate';

        return {
          ...user,
          derivedTotalScore: bestScore,
          derivedCompletedCount: reactEntries.length,
          averageScore: bestScore,
          completionRate: reactEntries.length > 0 ? 100 : 0,
          recentSubmissions: reactEntries.length,
          lastActive: lastActiveISO,
          badge,
          rank: 0,
        };
      });

    // Sort by React score desc and rank
    data.sort((a: any, b: any) => (b.derivedTotalScore || 0) - (a.derivedTotalScore || 0));
    const ranked = data.map((e: any, i: number) => ({ ...e, rank: i + 1 }));

    setLeaderboard(ranked);
  }, [participants, totalAssessments]);

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
      (e) => new Date(e.lastActive).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length,
    topPerformerScore: leaderboard?.derivedTotalScore || 0, // fixed
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
            React Leaderboard
          </h1>
          <p className="text-gray-600">Top scores from the React track</p>
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
            {topPerformers[1] && (
              <div className="text-center">
                <div className="p-6 mb-4 transition-transform transform bg-white rounded-lg shadow-lg hover:scale-105">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 bg-gray-400 rounded-full">
                    <span className="text-xl font-bold text-white">
                      {topPerformers[1].name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{topPerformers[1].name}</h3>
                  <p className="mt-2 text-2xl font-bold text-gray-700">
                    {topPerformers[1].derivedTotalScore}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 border ${getBadgeColor(
                      topPerformers[1].badge
                    )}`}
                  >
                    {topPerformers[1].badge}
                  </span>
                </div>
                <div className="flex items-center justify-center w-20 h-24 bg-gray-400 rounded-t-lg">
                  <Medal className="w-8 h-8 text-white" />
                </div>
                <div className="px-4 py-2 font-bold text-white bg-gray-500 rounded-b-lg">2nd</div>
              </div>
            )}

            {/* 1st */}
            {topPerformers && (
              <div className="text-center">
                <div className="p-6 mb-4 transition-transform transform bg-white border-2 border-yellow-300 rounded-lg shadow-xl hover:scale-105">
                  <div className="flex items-center justify-center w-20 h-20 mx-auto mb-3 bg-yellow-500 rounded-full">
                    <span className="text-2xl font-bold text-white">
                      {topPerformers[0].name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{topPerformers[0].name}</h3>
                  <p className="mt-2 text-3xl font-bold text-yellow-600">
                    {topPerformers[0].derivedTotalScore}
                  </p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 border ${getBadgeColor(
                      topPerformers[0].badge
                    )}`}
                  >
                    {topPerformers[0].badge}
                  </span>
                </div>
                <div className="flex items-center justify-center w-20 h-32 bg-yellow-500 rounded-t-lg">
                  <Crown className="w-10 h-10 text-white" />
                </div>
                <div className="px-4 py-2 font-bold text-white bg-yellow-600 rounded-b-lg">1st</div>
              </div>
            )}

            {/* 3rd */}
            {topPerformers[2] && (
              <div className="text-center">
                <div className="p-6 mb-4 transition-transform transform bg-white rounded-lg shadow-lg hover:scale-105">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 rounded-full bg-amber-600">
                    <span className="text-xl font-bold text-white">
                      {topPerformers[2].name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{topPerformers[2].name}</h3>
                  <p className="mt-2 text-2xl font-bold text-amber-600">
                    {topPerformers[2].derivedTotalScore}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 border ${getBadgeColor(
                      topPerformers[2].badge
                    )}`}
                  >
                    {topPerformers[2].badge}
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
                  React Score
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
                <tr
                  key={entry.uid}
                  className={`hover:bg-gray-50 ${entry.rank <= 3 ? 'bg-yellow-50' : ''}`}
                >
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
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getBadgeColor(
                        entry.badge
                      )}`}
                    >
                      {entry.badge}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-yellow-400" />
                      <span className="text-lg font-bold text-gray-900">
                        {entry.derivedTotalScore || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{entry.derivedCompletedCount}</span>
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
            <p className="text-gray-600">
              The leaderboard will populate as students complete React assessments.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
