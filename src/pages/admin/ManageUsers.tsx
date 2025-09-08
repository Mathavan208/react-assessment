import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { type User } from '../../types';
import {
  Users,
  Shield,
  UserCheck,
  Trash2,
  Search,
  Filter,
  Award,
  Calendar,
  Plus,
  X,
} from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

type Role = 'admin' | 'user';
type CourseFilter = 'react' | 'all';

function ManageUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'totalScore' | 'createdAt'>('createdAt');

  // New: filter by course (default to only React enrollees)
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('react');

  // New: add-to-React modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userData: User[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as User;
          // Ensure there is a stable ID on each item; prefer embedded uid, fallback to doc.id
          const withUid = { ...data, uid: data.uid || d.id } as User;
          userData.push(withUid);
        });
        setUsers(userData);
        setLoading(false);
      },
      (err) => {
        console.error('onSnapshot error:', err);
        toast.error('Failed to fetch users');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  // New: add a user to the React course (enrolledCourses += 'react')
  const handleAddUserToReact = async (userId: string, userName?: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        enrolledCourses: arrayUnion('react'),
      });
      toast.success(`${userName || 'User'} added to React course`);
    } catch (error) {
      console.error('Error adding user to React course:', error);
      toast.error('Failed to add user to React course');
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const result = users
      .filter((u) => {
        const matchesSearch =
          u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;

        // Course filter: only show React enrollees unless "all" selected
        const enrolled = Array.isArray(u.enrolledCourses) ? u.enrolledCourses : [];
        const matchesCourse = courseFilter === 'all' || enrolled.includes('react');

        return matchesSearch && matchesRole && matchesCourse;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'email':
            return (a.email || '').localeCompare(b.email || '');
          case 'totalScore':
            return (b.totalScore || 0) - (a.totalScore || 0);
          case 'createdAt': {
            // createdAt may be a Timestamp or ISO string; normalize to ms
            const getMs = (v: any) =>
              v?.toMillis?.() ?? (typeof v === 'string' ? new Date(v).getTime() : Number(v) || 0);
            return getMs(b.createdAt as any) - getMs(a.createdAt as any);
          }
          default:
            return 0;
        }
      });

    return result;
  }, [users, searchTerm, roleFilter, sortBy, courseFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const regulars = users.filter((u) => u.role === 'user').length;
    const averageScore =
      total > 0
        ? Math.round(users.reduce((sum, u) => sum + (u.totalScore || 0), 0) / total)
        : 0;
    return { total, admins, users: regulars, averageScore };
  }, [users]);

  // Candidates for the Add-to-React modal (not yet in React)
  const addCandidates = useMemo(() => {
    const term = addSearch.trim().toLowerCase();
    return users
      .filter((u) => !((u.enrolledCourses || []) as string[]).includes('react'))
      .filter(
        (u) =>
          u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
      );
  }, [users, addSearch]);

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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">{stats.total} Total Users</span>
          </div>
          {/* New: Add to React button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add User to React
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Administrators</p>
              <p className="text-2xl font-bold text-gray-900">{stats.admins}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Regular Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.users}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats.averageScore}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            {/* New: Course filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value as CourseFilter)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="react">React Only</option>
                <option value="all">All Courses</option>
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="createdAt">Join Date</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="totalScore">Total Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Progress
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Score
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Joined
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedUsers.map((user) => {
                const enrolled = Array.isArray(user.enrolledCourses) ? user.enrolledCourses : [];
                return (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-purple-600 rounded-full">
                          <span className="font-medium text-white">
                            {user.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Courses: {enrolled.length > 0 ? enrolled.join(', ') : '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value as Role)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900">
                          {user.assessmentCompleted?.length || 0} completed
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Award className="w-4 h-4 mr-1 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {user.totalScore || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {!enrolled.includes('react') && (
                          <button
                            onClick={() => handleAddUserToReact(user.uid, user.name)}
                            className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                            title="Add to React"
                          >
                            Add to React
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(user.uid, user.name)}
                          className="p-1 text-red-600 rounded hover:text-red-900"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAndSortedUsers.length === 0 && (
          <div className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No users found</h3>
            <p className="text-gray-600">Try adjusting your search, role, or course filter.</p>
          </div>
        )}
      </div>

      {/* Add-to-React Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Add User to React</h2>
              <button
                className="p-2 text-gray-500 rounded hover:bg-gray-100"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <div className="relative">
                <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                <input
                  type="text"
                  placeholder="Search users to add..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="mt-4 overflow-y-auto border divide-y divide-gray-100 rounded max-h-80">
                {addCandidates.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No matching users</div>
                ) : (
                  addCandidates.map((u) => (
                    <div key={u.uid} className="flex items-center justify-between p-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                      <button
                        onClick={async () => {
                          await handleAddUserToReact(u.uid, u.name);
                        }}
                        className="px-3 py-1 text-sm text-white bg-purple-600 rounded hover:bg-purple-700"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageUsers;
