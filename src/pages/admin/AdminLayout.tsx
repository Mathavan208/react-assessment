import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  HelpCircle, 
  Send, 
  BarChart3, 
  Trophy,
  Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

function AdminLayout() {
  const { userProfile } = useAuth();
  const location = useLocation();

  useGSAP(() => {
    gsap.fromTo('.admin-sidebar', 
      { x: -100, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
    );
    gsap.fromTo('.admin-content', 
      { opacity: 0, y: 20 }, 
      { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: 'power2.out' }
    );
  }, []);

  const navigation = [
    { name: 'Assessments', href: '/admin', icon: FileText },
    { name: 'Questions', href: '/admin/questions', icon: HelpCircle },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Submissions', href: '/admin/submissions', icon: Send },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Leaderboard', href: '/admin/leaderboard', icon: Trophy },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg admin-sidebar">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-center h-16 px-4 text-white bg-purple-600">
              <Shield className="w-8 h-8 mr-2" />
              <h1 className="text-xl font-bold">Admin Panel</h1>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-10 h-10 bg-purple-600 rounded-full">
                  <span className="font-medium text-white">
                    {userProfile?.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{userProfile?.name}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-purple-100 text-purple-700 border-r-2 border-purple-500'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
              <p className="text-xs text-center text-gray-500">
                Admin Panel v1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 ml-64">
          <div className="p-8 admin-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
