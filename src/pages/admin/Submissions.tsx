import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { type Submission, type User, type Assessment } from '../../types';
import {
  Send,
  Search,
  Filter,
  Eye,
  Download,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  X,
  Trash2,
} from 'lucide-react';
import { formatDate, formatRelativeTime, calculateGradeFromScore, exportToCSV } from '../../utils/helpers';

function Submissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [usersByUid, setUsersByUid] = useState<Record<string, User>>({});
  const [assessmentsById, setAssessmentsById] = useState<Record<string, Assessment>>({});
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [assessmentFilter, setAssessmentFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Listen to submissions (ordered)
  useEffect(() => {
    const q = query(collection(db, 'submissions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => {
        const items: Submission[] = [];
        snap.forEach(d => items.push({ id: d.id, ...(d.data() as Submission) }));
        setSubmissions(items);
        setLoading(false);
      },
      err => {
        console.error('submissions onSnapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Listen to users
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      snap => {
        const byId: Record<string, User> = {};
        const byUid: Record<string, User> = {};
        snap.forEach(d => {
          const data = d.data() as User;
          const withUid = { ...data, uid: (data as any).uid || d.id } as User;
          byId[d.id] = withUid;
          byUid[withUid.uid] = withUid;
        });
        setUsersById(byId);
        setUsersByUid(byUid);
      },
      err => console.error('users onSnapshot error', err)
    );
    return () => unsub();
  }, []);

  // Listen to assessments
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'assessments'),
      snap => {
        const byId: Record<string, Assessment> = {};
        snap.forEach(d => (byId[d.id] = { id: d.id, ...(d.data() as Assessment) }));
        setAssessmentsById(byId);
      },
      err => console.error('assessments onSnapshot error', err)
    );
    return () => unsub();
  }, []);

  const getUser = (uid?: string): User | undefined => {
    if (!uid) return undefined;
    return usersByUid[uid] || usersById[uid];
  };

  const handleViewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowDetails(true);
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
    } catch (e) {
      console.error('Failed to delete submission', e);
      alert('Failed to delete submission');
    }
  };

  const handleExportCSV = () => {
    const rows = submissions.map(s => {
      const u = getUser(s.uid);
      const a = assessmentsById[s.assessmentId || ''];
      return {
        id: s.id,
        studentName: u?.name || 'Unknown',
        studentEmail: u?.email || 'Unknown',
        assessmentTitle: a?.title || 'Unknown',
        score: s.score,
        grade: calculateGradeFromScore(s.score).grade,
        submittedAt: formatDate(s.createdAt),
      };
    });
    exportToCSV(rows, 'submissions');
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const u = getUser(s.uid);
      const a = assessmentsById[s.assessmentId || ''];
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        (u?.name || '').toLowerCase().includes(term) ||
        (u?.email || '').toLowerCase().includes(term) ||
        (a?.title || '').toLowerCase().includes(term);

      const matchesAssessment = assessmentFilter === 'all' || s.assessmentId === assessmentFilter;

      const sVal = s.score ?? 0;
      const matchesScore =
        scoreFilter === 'all' ||
        (scoreFilter === 'excellent' && sVal >= 90) ||
        (scoreFilter === 'good' && sVal >= 70 && sVal < 90) ||
        (scoreFilter === 'average' && sVal >= 50 && sVal < 70) ||
        (scoreFilter === 'poor' && sVal < 50);

      return matchesSearch && matchesAssessment && matchesScore;
    });
  }, [submissions, usersById, usersByUid, assessmentsById, searchTerm, assessmentFilter, scoreFilter]);

  // Group by assessmentId
  const groupedByAssessment = useMemo(() => {
    const groups: Record<string, Submission[]> = {};
    for (const s of filteredSubmissions) {
      const key = s.assessmentId || 'unknown';
      (groups[key] ||= []).push(s);
    }
    return groups;
  }, [filteredSubmissions]);

  const stats = {
    total: submissions.length,
    avgScore:
      submissions.length > 0
        ? Math.round(submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length)
        : 0,
    excellent: submissions.filter(s => (s.score || 0) >= 90).length,
    good: submissions.filter(s => (s.score || 0) >= 70 && (s.score || 0) < 90).length,
    average: submissions.filter(s => (s.score || 0) >= 50 && (s.score || 0) < 70).length,
    poor: submissions.filter(s => (s.score || 0) < 50).length,
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
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-600">View and analyze assessment submissions</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgScore}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Excellent</p>
              <p className="text-2xl font-bold text-gray-900">{stats.excellent}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Good</p>
              <p className="text-2xl font-bold text-gray-900">{stats.good}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Poor</p>
              <p className="text-2xl font-bold text-gray-900">{stats.poor}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 lg:space-x-4">
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search by student or assessment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={assessmentFilter}
                onChange={(e) => setAssessmentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Assessments</option>
                {Object.values(assessmentsById).map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Scores</option>
              <option value="excellent">Excellent (90-100)</option>
              <option value="good">Good (70-89)</option>
              <option value="average">Average (50-69)</option>
              <option value="poor">Poor (0-49)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grouped by Assessment */}
      {Object.entries(groupedByAssessment).map(([aid, items]) => {
        const assessment = assessmentsById[aid];
        return (
          <div key={aid} className="overflow-hidden bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {assessment?.title || 'Unknown Assessment'}
                  </div>
                  <div className="text-xs text-gray-500">Assessment ID: {aid}</div>
                </div>
                <div className="text-sm text-gray-600">{items.length} submissions</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((submission) => {
                    const u = getUser(submission.uid);
                    const gradeInfo = calculateGradeFromScore(submission.score);
                    return (
                      <tr key={submission.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-purple-600 rounded-full">
                              <span className="text-sm font-medium text-white">
                                {u?.name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {u?.name || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-500">{u?.email || 'Unknown Email'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full h-2 mr-3 bg-gray-200 rounded-full">
                              <div
                                className={`h-2 rounded-full ${
                                  submission.score >= 90
                                    ? 'bg-green-600'
                                    : submission.score >= 70
                                    ? 'bg-blue-600'
                                    : submission.score >= 50
                                    ? 'bg-yellow-600'
                                    : 'bg-red-600'
                                }`}
                                style={{ width: `${submission.score}%` }}
                              />
                            </div>
                            <span className="w-10 text-sm font-medium text-gray-900">
                              {submission.score}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              submission.score >= 90
                                ? 'bg-green-100 text-green-800'
                                : submission.score >= 70
                                ? 'bg-blue-100 text-blue-800'
                                : submission.score >= 50
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {gradeInfo.grade}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="w-4 h-4 mr-1" />
                            <div>
                              <div>{formatRelativeTime(submission.createdAt)}</div>
                              <div className="text-xs text-gray-400">{formatDate(submission.createdAt)}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => handleViewDetails(submission)}
                              className="flex items-center text-purple-600 hover:text-purple-900"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(submission.id)}
                              className="flex items-center text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {items.length === 0 && (
              <div className="py-12 text-center">
                <Send className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">No submissions in this assessment</h3>
                <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state across all groups */}
      {filteredSubmissions.length === 0 && (
        <div className="overflow-hidden bg-white rounded-lg shadow-md">
          <div className="py-12 text-center">
            <Send className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No submissions found</h3>
            <p className="text-gray-600">
              {searchTerm || assessmentFilter !== 'all' || scoreFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Submissions will appear here once students start completing assessments.'}
            </p>
          </div>
        </div>
      )}

      {/* Submission Details Modal */}
      {showDetails && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Submission Details</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteSubmission(selectedSubmission.id)}
                    className="inline-flex items-center px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Student & Assessment Info */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <h3 className="mb-2 font-semibold text-gray-900">Student Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Name:</strong> {getUser(selectedSubmission.uid)?.name || 'Unknown'}</div>
                      <div><strong>Email:</strong> {getUser(selectedSubmission.uid)?.email || 'Unknown'}</div>
                      <div><strong>Role:</strong> {getUser(selectedSubmission.uid)?.role || 'Unknown'}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50">
                    <h3 className="mb-2 font-semibold text-gray-900">Assessment Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Title:</strong> {assessmentsById[selectedSubmission.assessmentId || '']?.title || 'Unknown'}</div>
                      <div><strong>Difficulty:</strong> {assessmentsById[selectedSubmission.assessmentId || '']?.difficulty || 'Unknown'}</div>
                      <div><strong>Submitted:</strong> {formatDate(selectedSubmission.createdAt)}</div>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="p-4 rounded-lg bg-blue-50">
                  <h3 className="mb-2 font-semibold text-gray-900">Results</h3>
                  <div className="flex items-center space-x-6">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{selectedSubmission.score}/100</div>
                      <div className="text-sm text-gray-600">Score</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${calculateGradeFromScore(selectedSubmission.score).color}`}>
                        {calculateGradeFromScore(selectedSubmission.score).grade}
                      </div>
                      <div className="text-sm text-gray-600">Grade</div>
                    </div>
                  </div>
                </div>

                {/* Code */}
                <div>
                  <h3 className="mb-2 font-semibold text-gray-900">Submitted Code</h3>
                  <pre className="p-4 overflow-x-auto text-sm text-gray-100 bg-gray-900 rounded-lg">
                    <code>{selectedSubmission.code}</code>
                  </pre>
                </div>

                {/* Test Results */}
                {selectedSubmission.notes && (
                  <div>
                    <h3 className="mb-2 font-semibold text-gray-900">Test Results</h3>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <div className="space-y-2 text-sm">
                        <div><strong>Structural Match:</strong> {selectedSubmission.notes.structuralEqual ? '✅ Pass' : '❌ Fail'}</div>
                        <div><strong>Visual Similarity:</strong> {Math.round((selectedSubmission.notes.visualSimilarity || 0) * 100)}%</div>
                        {selectedSubmission.notes.diffs && selectedSubmission.notes.diffs.length > 0 && (
                          <div>
                            <strong>Differences Found:</strong>
                            <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                              {selectedSubmission.notes.diffs.map((diff: any, index: number) => (
                                <li key={index}>{diff.type}: Expected {JSON.stringify(diff.expected)}, Got {JSON.stringify(diff.actual)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Submissions;
