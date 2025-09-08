export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  assessmentCompleted: string[];
  totalScore: number;
  createdAt: string;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  expectedHTML: string;
  difficulty: 'easy' | 'medium' | 'hard';
  testCases: TestCase[];
  createdAt: string;
}

export interface TestCase {
  name: string;
  description: string;
  weight: number;
}

export interface Question {
  id: string;
  assessmentId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  createdAt?: string;
}

export interface Submission {
  id: string;
  uid: string;
  assessmentId: string;
  code: string;
  score: number;
  notes: {
    structuralEqual?: boolean;
    visualSimilarity?: number;
    diffs?: any[];
  };
  createdAt: string;
}

// Theme context types
export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Assessment runner types
export interface CodeRunnerProps {
  starterCode: string;
  onCodeChange?: (code: string) => void;
}

export interface CodeRunnerRef {
  getPreviewElement: () => HTMLElement | null;
}

// DOM comparison result types
export interface DOMComparisonResult {
  equal: boolean;
  diffs: any[];
}

export interface VisualSimilarityResult {
  score: number;
  details: {
    structuralMatch: boolean;
    styleMatch: number;
    contentMatch: boolean;
  };
}

// Analytics types
export interface AnalyticsData {
  totalUsers: number;
  totalAssessments: number;
  totalSubmissions: number;
  averageScore: number;
  completionRate: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  scoreDistribution: Record<string, number>;
  assessmentPerformance: AssessmentPerformance[];
  userEngagement: UserEngagement[];
  timeSeriesData: TimeSeriesData[];
}

export interface AssessmentPerformance {
  assessmentId: string;
  title: string;
  submissions: number;
  averageScore: number;
  difficulty: string;
}

export interface UserEngagement {
  userId: string;
  name: string;
  submissions: number;
  averageScore: number;
  lastSubmission: string;
}

export interface TimeSeriesData {
  date: string;
  submissions: number;
  averageScore: number;
}

// Leaderboard types
export interface LeaderboardEntry extends User {
  rank: number;
  recentSubmissions: number;
  lastActive: string;
  completionRate: number;
  averageScore: number;
  badge: string;
}

// Form data types
export interface AssessmentFormData {
  title: string;
  description: string;
  starterCode: string;
  expectedHTML: string;
  difficulty: 'easy' | 'medium' | 'hard';
  testCases: TestCase[];
}

export interface QuestionFormData {
  assessmentId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Common utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type SortDirection = 'asc' | 'desc';

export type FilterOptions = {
  searchTerm?: string;
  difficulty?: 'all' | 'easy' | 'medium' | 'hard';
  role?: 'all' | 'admin' | 'user';
  timeRange?: 'all' | 'week' | 'month';
};

// Component prop types
export interface ProtectedRouteProps {
  adminOnly?: boolean;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

// Event handler types
export type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
export type SubmitHandler = (e: React.FormEvent<HTMLFormElement>) => void;
export type ClickHandler = (e: React.MouseEvent<HTMLButtonElement>) => void;
