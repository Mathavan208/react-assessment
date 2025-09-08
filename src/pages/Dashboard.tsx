import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import { type Assessment } from '../types';
import { BookOpen, Clock, CheckCircle, Award } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

function Dashboard() {
  const { userProfile } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useGSAP(() => {
    gsap.fromTo(
      '.dashboard-card',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
    );
  }, [assessments]);

  useEffect(() => {
    // Keep query simple to avoid composite index requirement; filter/sort on client.
    const base = collection(db, 'assessments');
    const q = query(base);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assessmentData: Assessment[] = [];
      snapshot.forEach((docSnap) => {
        assessmentData.push({ id: docSnap.id, ...docSnap.data() } as Assessment);
      });
      setAssessments(assessmentData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // React-only filter + sort by createdAt desc (client-side)
  const reactAssessments = useMemo(
    () =>
      assessments
        .filter((a) => {
          const t = String((a as any)?.type ?? '');
          const cat = String((a as any)?.category ?? '');
          const title = String((a as any)?.title ?? '');
          return t.toLowerCase() === 'react' || /react/i.test(cat) || /react/i.test(title);
        })
        .sort((a: any, b: any) => {
          const as = a?.createdAt?.seconds ?? 0;
          const bs = b?.createdAt?.seconds ?? 0;
          if (bs !== as) return bs - as;
          return String(b?.title || '').localeCompare(String(a?.title || ''));
        }),
    [assessments]
  );

  // Single source of truth:
  // userProfile.assessmentsCompleted is an object map: { [assessmentId]: { completed: true, score?: number, ... } }
  const acMap = (userProfile as any)?.assessmentsCompleted as Record<
    string,
    { completed?: boolean; score?: number }
  > | undefined;

  // Count completed React assessments using only the object map
  const completedCount = useMemo(() => {
    if (!acMap) return 0;
    return reactAssessments.reduce((acc, a) => {
      const entry = acMap[a.id];
      return acc + (entry?.completed === true ? 1 : 0);
    }, 0);
  }, [acMap, reactAssessments]);

  const total = reactAssessments.length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-32 h-32 border-b-2 border-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {userProfile?.name || userProfile?.displayName || userProfile?.email || 'Learner'}!
        </h1>
        <p className="mt-2 text-gray-600">Continue the React track</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-md dashboard-card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Score</p>
              <p className="text-2xl font-bold text-gray-900">{userProfile?.totalScore || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md dashboard-card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed (React)</p>
              <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md dashboard-card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending (React)</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.max(total - completedCount, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md dashboard-card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completion</p>
              <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* React Assessments Grid */}
      <div className="mb-6">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">React Assessments</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reactAssessments.map((assessment) => {
            const entry = acMap?.[assessment.id];
            const isCompleted = entry?.completed === true;
            const score = typeof entry?.score === 'number' ? entry?.score : undefined;

            return (
              <div
                key={assessment.id}
                className="overflow-hidden transition-shadow bg-white rounded-lg shadow-md dashboard-card hover:shadow-lg"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        (assessment as any).difficulty === 'easy'
                          ? 'bg-green-100 text-green-800'
                          : (assessment as any).difficulty === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {(assessment as any).difficulty || 'easy'}
                    </span>
                    {isCompleted && (
                      <div className="flex items-center gap-2">
                        {typeof score === 'number' && (
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                              score >= 80
                                ? 'bg-green-100 text-green-800'
                                : score >= 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {score}/100
                          </span>
                        )}
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {(assessment as any).title}
                  </h3>
                  <p className="mb-4 text-sm text-gray-600 line-clamp-2">
                    {(assessment as any).description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {((assessment as any).testCases?.length as number) || 0} test cases
                    </span>
                    <Link
                      to={`/assessment/${assessment.id}`}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isCompleted ? 'Review' : 'Start'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {reactAssessments.length === 0 && (
          <div className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No React assessments</h3>
            <p className="text-gray-600">Check back later for new React challenges!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
