import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import { type Assessment } from '../types';
import CodeRunner, { type CodeRunnerRef } from '../components/CodeRunner';
import { 
  Play, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  Code, 
  Save, 
  Timer,
  Award,
  Target,
  Lightbulb,
  FileText,
  User,
  BarChart3,
  Eye,
  RefreshCw,
  AlertCircle,
  Zap,
  BookOpen,
  Monitor,
  Coffee,
  Activity,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReactQuestion {
  id: string;
  title: string;
  description: string;
  instructions: string;
  starterCode: string | Record<string, string>;
  solutionCode: string | Record<string, string>;
  multiple?: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  testCases: Array<{
    name: string;
    description: string;
    expectedBehavior: string;
    weight: number;
  }>;
  hints: string[];
  timeLimit: number;
  tags: string[];
}

function AssessmentRunner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<ReactQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [questionScores, setQuestionScores] = useState<number[]>([]);
  const [completedQuestions, setCompletedQuestions] = useState<boolean[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showExpectedOutput, setShowExpectedOutput] = useState(true);
  const [testResults, setTestResults] = useState<any>(null);
  const [lastTestedCode, setLastTestedCode] = useState<string>('');

  // Submission overlay state
  const [showSubmissionOverlay, setShowSubmissionOverlay] = useState(false);
  const [finalSubmissionSummary, setFinalSubmissionSummary] = useState<null | {
    totalScore: number;
    avgScore: number;
    highest: number;
    lowest: number;
    perfectCount: number;
    questions: Array<{ title: string; score: number; difficulty: string }>;
  }>(null);
  
  const codeRunnerRef = useRef<CodeRunnerRef>(null);

  const currentQuestion = useMemo(() => {
    return questions[currentQuestionIndex];
  }, [questions, currentQuestionIndex]);

  // Fetch assessment and questions
  useEffect(() => {
    const fetchAssessmentAndQuestions = async () => {
      if (!id) return;
      
      try {
        toast.loading('Loading assessment...', { id: 'loading' });
        
        const docRef = doc(db, 'assessments', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const assessmentData = { id: docSnap.id, ...docSnap.data() } as Assessment;
          setAssessment(assessmentData);
          
          const questionIds = (assessmentData as any).questionIds || [];
          if (questionIds.length > 0) {
            const questionsData: ReactQuestion[] = [];
            
            for (const qid of questionIds) {
              const questionDoc = await getDoc(doc(db, 'react_questions', qid));
              if (questionDoc.exists()) {
                const q = questionDoc.data() as any;
                const normalized: ReactQuestion = {
                  id: questionDoc.id,
                  title: q.title || 'Untitled',
                  description: q.description || '',
                  instructions: q.instructions || '',
                  starterCode: q.starterCode || '',
                  solutionCode: q.solutionCode || '',
                  multiple: !!q.multiple || typeof q.starterCode === 'object',
                  difficulty: q.difficulty || 'easy',
                  category: q.category || 'General',
                  testCases: Array.isArray(q.testCases) ? q.testCases : [],
                  hints: Array.isArray(q.hints) ? q.hints : [],
                  timeLimit: q.timeLimit || 30,
                  tags: Array.isArray(q.tags) ? q.tags : [],
                };
                questionsData.push(normalized);
              }
            }
            
            setQuestions(questionsData);
            setQuestionScores(new Array(questionsData.length).fill(0));
            setCompletedQuestions(new Array(questionsData.length).fill(false));
            
            // After setQuestions, setQuestionScores, setCompletedQuestions...
if (questionsData.length > 0) {
  const first = questionsData;
  const secs = Number(first?.timeLimit ?? 0) * 60;
  setTimeLeft(Number.isFinite(secs) ? secs : 0);
}


            toast.success('✅ Assessment loaded successfully!', { id: 'loading' });
          } else {
            toast.error('❌ No questions found in this assessment', { id: 'loading' });
            setTimeout(() => navigate('/dashboard'), 2000);
          }
        } else {
          toast.error('❌ Assessment not found', { id: 'loading' });
          setTimeout(() => navigate('/dashboard'), 2000);
        }
      } catch (error) {
        console.error('Error fetching assessment:', error);
        toast.error('❌ Failed to load assessment', { id: 'loading' });
        setTimeout(() => navigate('/dashboard'), 3000);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessmentAndQuestions();
  }, [id, navigate]);

  // Timer effect
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            toast.error('⏰ Time is up for this question!', { duration: 4000 });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timerActive, timeLeft]);

  const formatTime = useCallback((seconds: number) => {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}, []);


  const startTimer = useCallback(() => {
    setTimerActive(true);
    toast.success(`⏱️ Timer started! You have ${formatTime(timeLeft)} remaining.`, { duration: 3000 });
  }, [timeLeft, formatTime]);

  const refreshExpectedOutput = useCallback(() => {
    toast.success('🔄 Expected output is now the rendered solution preview in CodeRunner', { duration: 2000 });
  }, []);

  const handleRunAndTest = useCallback(async () => {
    if (!currentQuestion) return;

    setTesting(true);
    setTestResults(null);

    const currentCode = codeRunnerRef.current?.getCurrentCode();
    const currentCodeString = typeof currentCode === 'string' ? currentCode : JSON.stringify(currentCode || {});

    if (!currentCodeString.trim() || currentCodeString.trim() === '{}') {
      toast.error('❌ Please write some code first!', { duration: 3000 });
      setTesting(false);
      return;
    }

    setLastTestedCode(currentCodeString);
    toast.loading('🧪 Running and testing your code...', { id: 'testing' });

    codeRunnerRef.current?.runCode();

    setTimeout(() => {
      const score = codeRunnerRef.current?.getAssessmentScore() ?? 0;
      const results = {
        structuralMatch: score >= 70,
        visualSimilarity: Math.min(100, Math.max(0, score)) / 100,
        score,
        diffs: [],
        userCode: currentCodeString,
        codeLength: currentCodeString.length,
        timestamp: new Date().toISOString()
      };

      setTestResults(results);
      toast.success(`✅ Test complete! Score: ${results.score}/100`, { id: 'testing', duration: 4000 });
      setTesting(false);
    }, 1100);
  }, [currentQuestion]);

  const handleSubmitCurrentQuestion = useCallback(async () => {
    if (!currentQuestion) return;

    const currentCode = codeRunnerRef.current?.getCurrentCode();
    const codeString = typeof currentCode === 'string' ? currentCode : JSON.stringify(currentCode || {});
    
    if (!codeString.trim() || codeString.trim() === '{}') {
      toast.error('❌ Please write some code before submitting!', { duration: 3000 });
      return;
    }

    const timeUsed = (currentQuestion.timeLimit * 60) - timeLeft;
    
    const confirmMessage = `🚀 Submit Answer for "${currentQuestion.title}"?\n\n` +
      `📝 Code Length: ${codeString.length} characters\n` +
      `⏰ Time Used: ${formatTime(timeUsed)} / ${formatTime(currentQuestion.timeLimit * 60)}\n` +
      `🧪 Last Test Score: ${testResults ? testResults.score : 'Not tested'}/100\n\n` +
      `⚠️ This action cannot be undone. Are you sure?`;

    const confirmSubmit = confirm(confirmMessage);
    if (!confirmSubmit) return;

    setSubmitting(true);
    
    try {
      toast.loading('📤 Submitting your answer...', { id: 'submit' });

      codeRunnerRef.current?.runCode();
      await new Promise(resolve => setTimeout(resolve, 1000));
      const finalScore = codeRunnerRef.current?.getAssessmentScore() ?? 0;

      const newScores = [...questionScores];
      const newCompleted = [...completedQuestions];
      newScores[currentQuestionIndex] = finalScore;
      newCompleted[currentQuestionIndex] = true;
      setQuestionScores(newScores);
      setCompletedQuestions(newCompleted);

      toast.success(`🎉 Question ${currentQuestionIndex + 1} submitted! Final Score: ${finalScore}/100`, { 
        id: 'submit', 
        duration: 4000 
      });
      
      if (currentQuestionIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
          const nextQuestion = questions[currentQuestionIndex + 1];
          setTimeLeft(nextQuestion.timeLimit * 60);
          setTimerActive(false);
          setShowHints(false);
          setTestResults(null);
          setLastTestedCode('');
          toast.success(`➡️ Moving to Question ${currentQuestionIndex + 2}...`, { duration: 2000 });
        }, 1200);
      } else {
        await submitFinalAssessment(newScores);
      }
      
    } catch (error) {
      console.error('Error submitting question:', error);
      toast.error('❌ Failed to submit question. Please try again.', { id: 'submit' });
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, currentQuestionIndex, questions, questionScores, completedQuestions, timeLeft, testResults, formatTime]);

  const submitFinalAssessment = useCallback(async (scores: number[]) => {
    if (!assessment) {
      toast.error('❌ Assessment data missing. Please refresh and try again.');
      return;
    }

    try {
      toast.loading('📋 Submitting final assessment...', { id: 'final-submit' });
      
      const totalScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

      const submissionData = {
        userEmail: userProfile?.email || 'anonymous@example.com',
        userName: userProfile?.displayName || userProfile?.email || 'Anonymous User',
        assessmentId: assessment.id,
        assessmentTitle: (assessment as any).title || 'Unknown Assessment',
        questionScores: scores,
        totalScore: totalScore,
        completedAt: new Date().toISOString(),
        submissionDate: new Date().toLocaleDateString(),
        submissionTime: new Date().toLocaleTimeString(),
        questions: questions.map((q, index) => ({
          questionId: q.id,
          questionTitle: q.title,
          score: scores[index],
          difficulty: q.difficulty,
          category: q.category,
          timeLimit: q.timeLimit
        })),
        statistics: {
          totalQuestions: questions.length,
          questionsCompleted: scores.filter(score => score > 0).length,
          averageScore: totalScore,
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores),
          perfectScores: scores.filter(score => score === 100).length
        },
        metadata: {
          completionTime: new Date().toISOString(),
          browserInfo: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          submissionSource: 'web-app'
        }
      };

      // Persist submission document
      await addDoc(collection(db, 'submissions'), submissionData);

      // Update user profile: legacy counters + append object to assessmentsCompleted array
      if (userProfile?.uid) {
        try {
       const userRef = doc(db, 'users', userProfile.uid);
       const completedDate = new Date().toISOString();
       const payload={
completed: true,
score: totalScore,
completedDate,
title: (assessment as any).title || 'React Assessment',
totalQuestions: questions.length
};
await updateDoc(userRef, {
[`assessmentsCompleted.${assessment.id}`]:payload
});
        } catch (userUpdateError) {
          console.warn('⚠️ Failed to update user profile, but submission was successful:', userUpdateError);
        }
      }

      // Prepare overlay summary
      const summary = {
        totalScore,
        avgScore: totalScore,
        highest: Math.max(...scores),
        lowest: Math.min(...scores),
        perfectCount: scores.filter(s => s === 100).length,
        questions: questions.map((q, i) => ({
          title: q.title,
          score: scores[i],
          difficulty: q.difficulty
        }))
      };
      setFinalSubmissionSummary(summary);
      setShowSubmissionOverlay(true);

      toast.success(`🎊 Assessment submitted! Total score: ${totalScore}/100`, { 
        id: 'final-submit',
        duration: 3000 
      });
      
    } catch (error) {
      console.error('❌ Error submitting final assessment:', error);
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          toast.error('❌ Permission denied. Please check your access rights.', { id: 'final-submit' });
        } else if (error.message.includes('invalid data')) {
          toast.error('❌ Invalid data detected. Please refresh and try again.', { id: 'final-submit' });
        } else if (error.message.includes('network')) {
          toast.error('❌ Network error. Please check your connection and try again.', { id: 'final-submit' });
        } else {
          toast.error(`❌ Submission failed: ${error.message}`, { id: 'final-submit' });
        }
      } else {
        toast.error('❌ Unknown error occurred during submission.', { id: 'final-submit' });
      }
    }
  }, [assessment, userProfile, questions, navigate]);

  const goToPreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      const prevQuestion = questions[currentQuestionIndex - 1];
setTimeLeft(Math.max(0, Number(prevQuestion?.timeLimit ?? 0) * 60));
      setTimerActive(false);
      setShowHints(false);
      setTestResults(null);
      setLastTestedCode('');
      toast.success(`⬅️ Moved to Question ${currentQuestionIndex}`, { duration: 2000 });
    }
  }, [currentQuestionIndex, questions]);

  const goToNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
     const nextQuestion = questions[currentQuestionIndex + 1];
setTimeLeft(Math.max(0, Number(nextQuestion?.timeLimit ?? 0) * 60));
      setTimerActive(false);
      setShowHints(false);
      setTestResults(null);
      setLastTestedCode('');
      toast.success(`➡️ Moved to Question ${currentQuestionIndex + 2}`, { duration: 2000 });
    }
  }, [currentQuestionIndex, questions]);

  const closeOverlay = useCallback(() => {
    setShowSubmissionOverlay(false);
  }, []);

  const goToDashboard = useCallback(() => {
    setShowSubmissionOverlay(false);
    navigate('/dashboard');
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-md p-8 text-center bg-white border border-blue-200 shadow-2xl rounded-2xl">
          <div className="w-20 h-20 mx-auto mb-6 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          <h2 className="mb-3 text-3xl font-bold text-gray-900">Loading Assessment</h2>
          <p className="mb-6 text-gray-600">Preparing your React coding challenge...</p>
          <div className="w-full h-3 overflow-hidden bg-gray-200 rounded-full">
            <div className="h-3 transition-all duration-1000 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse" style={{width: '70%'}}></div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Please wait while we fetch your questions</p>
        </div>
      </div>
    );
  }

  if (!assessment || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-md p-8 text-center bg-white border border-red-200 shadow-2xl rounded-2xl">
          <FileText className="w-24 h-24 mx-auto mb-6 text-gray-400" />
          <h2 className="mb-4 text-3xl font-bold text-gray-900">Assessment Not Available</h2>
        </div>
      </div>
    );
  }

  const alreadyCompleted = (userProfile as any)?.assessmentCompleted?.includes(assessment.id);
  const allQuestionsCompleted = completedQuestions.every(c => c);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="container max-w-full px-4 py-6 mx-auto">
        {/* Assessment Header */}
        <div className="p-6 mb-6 bg-white border-l-4 shadow-xl rounded-2xl border-gradient-to-b from-blue-500 to-purple-600">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="mb-3 text-2xl font-bold text-transparent text-gray-900 lg:text-4xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                {(assessment as any).title || 'React Assessment'}
              </h1>
              <p className="mb-4 text-base leading-relaxed text-gray-600 lg:text-lg">{(assessment as any).description || 'Solve the questions below.'}</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-full bg-blue-50">
                  <Monitor className="w-4 h-4 mr-2" />
                  React Assessment
                </div>
                <div className="flex items-center px-3 py-1 text-sm text-purple-600 border border-purple-200 rounded-full bg-purple-50">
                  <Coffee className="w-4 h-4 mr-2" />
                  Interactive Coding
                </div>
                <div className="flex items-center px-3 py-1 text-sm text-green-600 border border-green-200 rounded-full bg-green-50">
                  <Activity className="w-4 h-4 mr-2" />
                  Live Testing
                </div>
                {userProfile && (
                  <div className="flex items-center px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-full bg-gray-50">
                    <User className="w-4 h-4 mr-2" />
                    {userProfile.email || userProfile.displayName || 'User'}
                  </div>
                )}
              </div>
            </div>
            {alreadyCompleted && (
              <div className="flex items-center px-6 py-3 text-green-600 border-2 border-green-200 rounded-full shadow-lg bg-green-50">
                <CheckCircle className="w-6 h-6 mr-3" />
                <span className="text-lg font-bold">Assessment Completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-4 mb-6 bg-white border border-gray-200 shadow-xl lg:p-6 rounded-2xl">
          <div className="flex flex-col mb-6 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center mb-2 text-lg font-bold lg:text-xl sm:mb-0">
              <BarChart3 className="w-6 h-6 mr-3 text-blue-600" />
              Assessment Progress
            </h3>
            <div className="flex items-center space-x-4">
              <span className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 border border-gray-300 rounded-full lg:text-base">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="px-3 py-1 text-sm text-purple-600 border border-purple-200 rounded-full bg-purple-50">
                {Math.round(((currentQuestionIndex + (completedQuestions[currentQuestionIndex] ? 1 : 0)) / questions.length) * 100)}% Complete
              </span>
            </div>
          </div>
          <div className="w-full h-4 mb-4 overflow-hidden bg-gray-200 rounded-full shadow-inner">
            <div 
              className="h-4 transition-all duration-700 rounded-full shadow-lg bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
              style={{ width: `${((currentQuestionIndex + (completedQuestions[currentQuestionIndex] ? 1 : 0)) / questions.length) * 100}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {questions.map((_, index) => (
              <div key={index} className={`text-center px-3 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all duration-300 cursor-pointer hover:scale-105 ${
                completedQuestions[index] ? 'text-green-600 bg-gradient-to-r from-green-100 to-green-200 border-2 border-green-300 shadow-lg' : 
                index === currentQuestionIndex ? 'text-blue-600 bg-gradient-to-r from-blue-100 to-blue-200 border-2 border-blue-300 shadow-lg' : 
                'text-gray-400 bg-gray-100 border border-gray-300 hover:bg-gray-200'
              }`}>
                Q{index + 1}
                {completedQuestions[index] && (
                  <div className="mt-1 text-xs text-green-600">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Question Info */}
        <div className="p-4 mb-6 bg-white border-l-4 border-purple-500 shadow-xl lg:p-8 rounded-2xl">
          <div className="flex flex-col mb-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex-1 mb-6 xl:mb-0 xl:mr-8">
              <h2 className="mb-6 text-xl font-bold leading-tight text-gray-900 lg:text-4xl">
                {currentQuestion.title}
              </h2>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <span className={`px-6 py-3 rounded-full text-sm font-bold border-2 shadow-lg transition-all duration-200 hover:scale-105 ${
                  currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800 border-green-300' :
                  currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                  'bg-red-100 text-red-800 border-red-300'
                }`}>
                  {currentQuestion.difficulty.toUpperCase()}
                </span>
                <span className="flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 border-2 border-gray-300 rounded-full shadow-lg">
                  <Code className="w-5 h-5 mr-3" />
                  {currentQuestion.category}
                </span>
                {currentQuestion.tags && currentQuestion.tags.length > 0 && (
                  <span className="flex items-center px-6 py-3 text-sm text-blue-700 border-2 border-blue-200 rounded-full shadow-lg bg-blue-50">
                    <BookOpen className="w-5 h-5 mr-3" />
                    {currentQuestion.tags.slice(0, 2).join(', ')}
                    {currentQuestion.tags.length > 2 && '...'}
                  </span>
                )}
              </div>
              <p className="p-6 mb-8 text-base leading-relaxed text-gray-700 border border-gray-200 lg:text-xl bg-gray-50 rounded-xl">
                {currentQuestion.description}
              </p>
            </div>
            
            {/* Timer */}
            <div className="p-8 text-center border-2 border-blue-200 shadow-xl xl:text-right bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl">
              <div className={`text-4xl lg:text-6xl font-mono font-bold mb-4 ${
                timeLeft < 300 ? 'text-red-600' : timeLeft < 600 ? 'text-yellow-600' : 'text-blue-600'
              }`}>
                <div className="flex items-center justify-center xl:justify-end">
                  <Timer className="w-10 h-10 mr-4 lg:w-16 lg:h-16" />
                  {formatTime(timeLeft)}
                </div>
              </div>
              <div className="mb-6 text-sm font-semibold text-gray-600 lg:text-base">Time Remaining</div>
              {!timerActive && !completedQuestions[currentQuestionIndex] && (
                <button
                  onClick={startTimer}
                  className="flex items-center px-8 py-4 mx-auto font-bold text-white transition-all duration-300 transform shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl hover:from-green-700 hover:to-emerald-700 xl:mx-0 hover:shadow-2xl hover:scale-105"
                >
                  <Play className="w-6 h-6 mr-3" />
                  Start Timer
                </button>
              )}
              {timerActive && (
                <div className="flex items-center justify-center px-4 py-2 font-bold text-green-600 border border-green-200 rounded-full xl:justify-end bg-green-50">
                  <Zap className="w-5 h-5 mr-2 animate-pulse" />
                  Timer Active
                </div>
              )}
            </div>
          </div>
          
          {/* Instructions */}
          <div className="p-8 mb-8 border-2 border-blue-200 shadow-lg rounded-2xl bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
            <h4 className="flex items-center mb-6 text-xl font-bold text-blue-900">
              <Target className="w-8 h-8 mr-4" />
              Instructions:
            </h4>
            <p className="p-6 text-base leading-relaxed text-blue-800 bg-white border border-blue-200 lg:text-lg rounded-xl">
              {currentQuestion.instructions}
            </p>
          </div>

          {/* Hints */}
          {currentQuestion.hints && currentQuestion.hints.length > 0 && (
            <div className="mb-8">
              <button
                onClick={() => setShowHints(!showHints)}
                className="flex items-center px-6 py-3 text-lg font-bold text-yellow-700 transition-colors border-2 border-yellow-200 shadow-lg hover:text-yellow-800 bg-yellow-50 rounded-xl hover:shadow-xl"
              >
                <Lightbulb className="w-6 h-6 mr-3" />
                <span>
                  {showHints ? 'Hide Hints' : `Show ${currentQuestion.hints.length} Helpful Hints`}
                </span>
              </button>
              
              {showHints && (
                <div className="mt-6 space-y-6">
                  {currentQuestion.hints.map((hint, index) => (
                    <div key={index} className="p-6 transition-shadow border-l-4 border-yellow-400 shadow-lg bg-yellow-50 rounded-2xl hover:shadow-xl">
                      <div className="flex items-start">
                        <Lightbulb className="flex-shrink-0 w-8 h-8 mt-2 mr-6 text-yellow-600" />
                        <div>
                          <div className="mb-3 text-lg font-bold text-yellow-800">💡 Hint #{index + 1}</div>
                          <div className="p-4 text-base leading-relaxed text-yellow-700 bg-white border border-yellow-200 lg:text-lg rounded-xl">
                            {hint}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-4">
          {/* Code Editor */}
          <div className="xl:col-span-3">
            <div className="overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-2xl">
              <div className="p-6 border-b bg-gradient-to-r from-purple-50 via-blue-50 to-green-50">
                <h2 className="flex items-center text-xl font-bold text-gray-800 lg:text-2xl">
                  <Code className="w-8 h-8 mr-4 text-purple-600" />
                  Monaco Code Editor
                  <span className="px-3 py-1 ml-4 text-sm text-gray-500 bg-gray-100 rounded-full">
                    React • JavaScript • ES6
                  </span>
                </h2>
              </div>
              <div className="h-[500px] sm:h-[600px] lg:h-[800px]">
                <CodeRunner
                  ref={codeRunnerRef}
                  starterCode={currentQuestion.starterCode}
                  solutionCode={currentQuestion.solutionCode}
                  multiple={!!currentQuestion.multiple}
                  questionId={currentQuestion.id}
                />
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-8 xl:col-span-1">
            {/* Expected Output */}
            <div className="overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-2xl">
              <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
                <h2 className="flex items-center text-lg font-bold text-gray-800 lg:text-xl">
                  <Target className="w-6 h-6 mr-3 text-green-600" />
                  Expected Output
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowExpectedOutput(!showExpectedOutput)}
                    className="p-3 text-gray-600 transition-all duration-200 border border-gray-300 hover:text-gray-800 rounded-xl hover:bg-gray-100"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={refreshExpectedOutput}
                    className="p-3 text-gray-600 transition-all duration-200 border border-gray-300 hover:text-gray-800 rounded-xl hover:bg-gray-100"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {showExpectedOutput && (
                <div className="p-6">
                  <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 min-h-[150px] max-h-[400px] overflow-auto shadow-inner">
                    <div className="text-sm text-gray-600">
                      The expected output is rendered from the solution code. Use the “Solution” toggle in the CodeRunner preview to view it next to your output.
                    </div>
                  </div>
                  <p className="p-3 mt-4 text-xs font-semibold text-center text-gray-500 border border-blue-200 bg-blue-50 rounded-xl">
                    ↑ Toggle Solution in the CodeRunner preview to see expected output
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 bg-white border border-gray-200 shadow-2xl rounded-2xl lg:p-8">
              <div className="space-y-6">
                <button
                  onClick={handleRunAndTest}
                  disabled={testing}
                  className="flex items-center justify-center w-full px-8 py-6 text-base font-bold text-white transition-all duration-300 transform shadow-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-2xl hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-3xl lg:text-lg hover:scale-105"
                >
                  {testing ? (
                    <div className="w-8 h-8 mr-4 border-4 border-white rounded-full border-t-transparent animate-spin"></div>
                  ) : (
                    <Play className="w-8 h-8 mr-4" />
                  )}
                  {testing ? 'Running Tests...' : 'Run & Test My Code'}
                </button>

                <button
                  onClick={handleSubmitCurrentQuestion}
                  disabled={submitting || completedQuestions[currentQuestionIndex]}
                  className="flex items-center justify-center w-full px-8 py-6 text-base font-bold text-white transition-all duration-300 transform shadow-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 rounded-2xl hover:from-green-700 hover:via-emerald-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-3xl lg:text-lg hover:scale-105"
                >
                  {submitting ? (
                    <div className="w-8 h-8 mr-4 border-4 border-white rounded-full border-t-transparent animate-spin"></div>
                  ) : (
                    <Save className="w-8 h-8 mr-4" />
                  )}
                  {submitting ? 'Submitting Answer...' : 
                   completedQuestions[currentQuestionIndex] ? '✅ Answer Submitted' : 
                   'Submit Final Answer'}
                </button>

                <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={goToPreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center justify-center px-6 py-4 text-sm font-bold transition-all duration-200 border-2 border-gray-300 shadow-lg rounded-2xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed lg:text-base hover:shadow-xl"
                  >
                    <ArrowLeft className="w-6 h-6 mr-3" />
                    Previous Question
                  </button>
                  
                  <button
                    onClick={goToNextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="flex items-center justify-center px-6 py-4 text-sm font-bold transition-all duration-200 border-2 border-gray-300 shadow-lg rounded-2xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed lg:text-base hover:shadow-xl"
                  >
                    Next Question
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Score Summary */}
        <div className="p-6 mt-10 bg-white border border-gray-200 shadow-2xl lg:p-10 rounded-2xl">
          <h3 className="flex items-center mb-10 text-2xl font-bold text-gray-800 lg:text-4xl">
            <Award className="w-10 h-10 mr-6 text-yellow-600 lg:w-12 lg:h-12" />
            Assessment Scorecard
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-8">
            {questions.map((question, index) => (
              <div key={question.id} className={`p-6 lg:p-8 border-2 rounded-2xl transition-all duration-300 hover:shadow-2xl cursor-pointer transform hover:scale-105 ${
                completedQuestions[index] ? 'border-green-400 bg-gradient-to-br from-green-50 via-green-100 to-green-200 shadow-xl' : 
                index === currentQuestionIndex ? 'border-blue-400 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 shadow-xl' : 
                'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <div className="mb-4 text-sm font-bold leading-tight text-gray-700 lg:text-base">
                  Question {index + 1}: {question.title}
                </div>
                <div className="mb-4 text-4xl font-bold lg:text-5xl">
                  {completedQuestions[index] ? (
                    <span className="text-green-600">{questionScores[index]}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                  <span className="text-xl text-gray-500 lg:text-2xl">/100</span>
                </div>
                <div className="flex items-center justify-between text-xs lg:text-sm">
                  <span className={`px-3 py-2 rounded-full font-bold border-2 ${
                    question.difficulty === 'easy' ? 'bg-green-100 text-green-700 border-green-300' :
                    question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                    'bg-red-100 text-red-700 border-red-300'
                  }`}>
                    {question.difficulty}
                  </span>
                  <span className="flex items-center px-3 py-2 font-bold text-gray-600 bg-gray-100 rounded-full">
                    <Clock className="w-4 h-4 mr-2" />
                    {question.timeLimit}min
                  </span>
                </div>
                {completedQuestions[index] && (
                  <div className="mt-4 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto text-green-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {allQuestionsCompleted && (
            <div className="p-10 mt-12 border-4 border-green-400 bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 rounded-3xl shadow-3xl">
              <div className="text-center">
                <Award className="w-24 h-24 mx-auto mb-8 text-yellow-500 animate-bounce" />
                <div className="mb-6 text-4xl font-bold text-green-800 lg:text-5xl">
                  🎉 Assessment Complete! 🎉
                </div>
                <div className="mb-6 text-6xl font-bold text-transparent lg:text-8xl bg-clip-text bg-gradient-to-r from-green-600 via-blue-600 to-purple-600">
                  {Math.round(questionScores.reduce((sum, score) => sum + score, 0) / questionScores.length)}/100
                </div>
                <div className="mb-4 text-xl font-bold text-green-700 lg:text-2xl">
                  Outstanding! You've completed all questions! 🏆
                </div>
                <div className="mb-6 text-base text-gray-600 lg:text-lg">
                  Submit your final answer to record your scores.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submission Overlay */}
      {showSubmissionOverlay && finalSubmissionSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-3xl overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-blue-50">
              <div className="text-xl font-bold text-gray-800">
                Submission Summary
              </div>
              <button onClick={closeOverlay} className="p-2 text-gray-600 transition-colors rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="p-4 text-center border rounded-xl bg-gray-50">
                  <div className="text-sm text-gray-500">Average</div>
                  <div className="text-3xl font-extrabold text-blue-700">{finalSubmissionSummary.avgScore}</div>
                </div>
                <div className="p-4 text-center border rounded-xl bg-gray-50">
                  <div className="text-sm text-gray-500">Highest</div>
                  <div className="text-3xl font-extrabold text-green-700">{finalSubmissionSummary.highest}</div>
                </div>
                <div className="p-4 text-center border rounded-xl bg-gray-50">
                  <div className="text-sm text-gray-500">Lowest</div>
                  <div className="text-3xl font-extrabold text-red-600">{finalSubmissionSummary.lowest}</div>
                </div>
                <div className="p-4 text-center border rounded-xl bg-gray-50">
                  <div className="text-sm text-gray-500">Perfect</div>
                  <div className="text-3xl font-extrabold text-emerald-700">{finalSubmissionSummary.perfectCount}</div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 text-sm font-semibold text-gray-600">
                  Per-question scores
                </div>
                <div className="space-y-2 overflow-auto max-h-64">
                  {finalSubmissionSummary.questions.map((q, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 pr-4">
                        <div className="font-semibold text-gray-800 line-clamp-1">{q.title}</div>
                        <div className="text-xs text-gray-500 capitalize">{q.difficulty}</div>
                      </div>
                      <div className={`px-3 py-1 text-sm font-bold rounded-full ${
                        q.score >= 80 ? 'bg-green-100 text-green-800' :
                        q.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {q.score}/100
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={closeOverlay}
                className="px-4 py-2 text-sm font-semibold text-gray-700 transition-colors bg-white border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={goToDashboard}
                className="px-5 py-2 text-sm font-bold text-white transition-colors rounded-lg bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}

export default AssessmentRunner;
