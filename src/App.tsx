import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AssessmentRunner from './pages/AssessmentRunner';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import ManageUsers from './pages/admin/ManageUsers';
import ManageAssessments from './pages/admin/ManageAssessment';
import ManageQuestions from './pages/admin/ManageQuestions';
import Submissions from './pages/admin/Submissions';
import Analytics from './pages/admin/Analytics';
import Leaderboard from './pages/admin/Leaderboard';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="pt-16">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/assessment/:id" element={<AssessmentRunner />} />
              </Route>

              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<ManageAssessments />} />
                  <Route path="users" element={<ManageUsers />} />
                  <Route path="questions" element={<ManageQuestions />} />
                  <Route path="submissions" element={<Submissions />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="leaderboard" element={<Leaderboard />} />
                </Route>
              </Route>
            </Routes>
          </div>
        </div>
        <Toaster position="top-right" />
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
