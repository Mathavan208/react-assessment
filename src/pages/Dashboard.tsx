import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import { type Assessment } from '../types';
import { BookOpen, Clock, CheckCircle, Award } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

type CompletedEntry = {
  completed?: boolean;
  score?: number;
  completedDate?: string | number;
  totalQuestions?: number;
  title?: string;
  // allow extra fields
  [k: string]: unknown;
};

function Dashboard() {
  const { userProfile } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime fetch of all assessments
  useEffect(() => {
    const base = collection(db, 'assessments');
    const q = query(base);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Assessment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) } as Assessment);
      });
      // Sort by createdAt desc (if present), then by title
      list.sort((a: any, b: any) => {
        const as = a?.createdAt?.seconds ?? 0;
        const bs = b?.createdAt?.seconds ?? 0;
        if (bs !== as) return bs - as;
        return String(b?.title || '').localeCompare(String(a?.title || ''));
      });
      setAssessments(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  // Animate cards when list changes
  useGSAP(() => {
    gsap.fromTo(
      '.dashboard-card',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
    );
  }, [assessments]);

  // Normalize enrolledCourses
  const enrolledCourses = useMemo<string[]>(() => {
    const raw = (userProfile as any)?.enrolledCourses;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [userProfile]);
  // Normalize assessmentsCompleted into a map keyed by assessmentId
  const completedMap = useMemo<Record<string, CompletedEntry>>(() => {
    const raw = (userProfile as any)?.assessmentsCompleted;
    if (!raw) return {};

    // Case 1: already a map keyed by assessment id (matches your screenshot)
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, CompletedEntry>;
    }

    // Case 2: an array of completion entries; try to find an id field
    if (Array.isArray(raw)) {
      const map: Record<string, CompletedEntry> = {};
      for (const entry of raw as any[]) {
        const id =
          entry?.assessmentId ??
          entry?.id ??
          entry?.assessmentID ??
          entry?.assessment_id;
        if (typeof id === 'string' && id) {
          map[id] = entry as CompletedEntry;
        }
      }
      return map;
    }

    return {};
  }, [userProfile]);

  // Derived stats
  const completedCount = useMemo(() => {
    return assessments.reduce((acc, a) => {
      const e = completedMap[a.id];
      return acc + (e?.completed === true || typeof e?.score === 'number' ? 1 : 0);
    }, 0);
  }, [assessments, completedMap]);

  const total = assessments.length;
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
          Welcome back, {userProfile?.name || userProfile?.email || 'Learner'}!
        </h1>
        <p className="mt-2 text-gray-600">Continue your assessments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-md dashboard-card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Assessments</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md dashboard-card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
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
              <p className="text-sm font-medium text-gray-600">Pending</p>
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

      {/* All Assessments Grid */}
      <div className="mb-6">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">All Assessments</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assessments.map((assessment) => {
            const a: any = assessment as any;
            const courseId = String(a?.courseId ?? '');
            const isEnrolled =
              courseId.length > 0 ? enrolledCourses.includes(courseId) : false;

            const completion = completedMap[assessment.id];
            const isCompleted =
              completion?.completed === true || typeof completion?.score === 'number';
            const score =
              typeof completion?.score === 'number' ? completion?.score : undefined;

            return (
              <div
                key={assessment.id}
                className="overflow-hidden transition-shadow bg-white rounded-lg shadow-md dashboard-card hover:shadow-lg"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          a.difficulty === 'easy'
                            ? 'bg-green-100 text-green-800'
                            : a.difficulty === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {a.difficulty || 'easy'}
                      </span>
                      {courseId && (
                        <span className="px-2 py-1 text-xs font-medium text-blue-700 rounded bg-blue-50">
                          {courseId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {a.title}
                  </h3>
                  <p className="mb-4 text-sm text-gray-600 line-clamp-2">
                    {a.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {(a.testCases?.length as number) || 0} test cases
                    </span>

                    {isEnrolled ? (
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
                    ) : (
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg cursor-not-allowed"
                        title="Enroll in this course to access the assessment"
                        disabled
                      >
                        Enroll to access
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {assessments.length === 0 && (
          <div className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No assessments</h3>
            <p className="text-gray-600">Check back later for new challenges!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
