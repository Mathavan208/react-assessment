import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../utils/firebase';
import {type Assessment } from '../../types';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  Calendar,
  Code,
  Save,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface ReactQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  timeLimit: number;
  tags: string[];
}

interface AssessmentFormData {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  selectedQuestions: string[]; // Array of question IDs
}

function ManageAssessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<ReactQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [questionSearchTerm, setQuestionSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<AssessmentFormData>({
    title: '',
    description: '',
    difficulty: 'easy',
    timeLimit: 60,
    selectedQuestions: []
  });

  useEffect(() => {
    // Fetch assessments
    const assessmentsQuery = query(collection(db, 'assessments'), orderBy('createdAt', 'desc'));
    const unsubscribeAssessments = onSnapshot(assessmentsQuery, (snapshot) => {
      const assessmentData: Assessment[] = [];
      snapshot.forEach((doc) => {
        assessmentData.push({ id: doc.id, ...doc.data() } as Assessment);
      });
      setAssessments(assessmentData);
      setLoading(false);
    });

    // Fetch React questions
    const questionsQuery = query(collection(db, 'react_questions'), orderBy('title'));
    const unsubscribeQuestions = onSnapshot(questionsQuery, (snapshot) => {
      const questionData: ReactQuestion[] = [];
      snapshot.forEach((doc) => {
        questionData.push({ id: doc.id, ...doc.data() } as ReactQuestion);
      });
      setQuestions(questionData);
    });

    return () => {
      unsubscribeAssessments();
      unsubscribeQuestions();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.selectedQuestions.length === 0) {
      toast.error('Please select at least one question for the assessment');
      return;
    }

    try {
      const assessmentData = {
        title: formData.title,
        description: formData.description,
        difficulty: formData.difficulty,
        timeLimit: formData.timeLimit,
        questionIds: formData.selectedQuestions, // Store question IDs
        createdAt: serverTimestamp(),
      };

      if (editingAssessment) {
        await updateDoc(doc(db, 'assessments', editingAssessment.id), assessmentData);
        toast.success('Assessment updated successfully');
      } else {
        await addDoc(collection(db, 'assessments'), assessmentData);
        toast.success('Assessment created successfully');
      }

      resetForm();
    } catch (error) {
      console.error('Error saving assessment:', error);
      toast.error('Failed to save assessment');
    }
  };

  const handleEdit = (assessment: Assessment) => {
    setEditingAssessment(assessment);
    setFormData({
      title: assessment.title,
      description: assessment.description,
      difficulty: assessment.difficulty,
      timeLimit: assessment.timeLimit || 60,
      selectedQuestions: (assessment as any).questionIds || []
    });
    setShowForm(true);
  };

  const handleDelete = async (assessmentId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'assessments', assessmentId));
      toast.success('Assessment deleted successfully');
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast.error('Failed to delete assessment');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      difficulty: 'easy',
      timeLimit: 60,
      selectedQuestions: []
    });
    setEditingAssessment(null);
    setShowForm(false);
    setShowQuestionSelector(false);
    setQuestionSearchTerm('');
  };

  const toggleQuestionSelection = (questionId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedQuestions: prev.selectedQuestions.includes(questionId)
        ? prev.selectedQuestions.filter(id => id !== questionId)
        : [...prev.selectedQuestions, questionId]
    }));
  };

  const getSelectedQuestions = () => {
    return questions.filter(q => formData.selectedQuestions.includes(q.id));
  };

  const getAssessmentQuestions = (assessment: Assessment) => {
    const questionIds = (assessment as any).questionIds || [];
    return questions.filter(q => questionIds.includes(q.id));
  };

  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'all' || assessment.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const filteredQuestions = questions.filter(question => {
    return question.title.toLowerCase().includes(questionSearchTerm.toLowerCase()) ||
           question.description.toLowerCase().includes(questionSearchTerm.toLowerCase());
  });

  const getTotalTimeLimit = () => {
    const selectedQuestions = getSelectedQuestions();
    return selectedQuestions.reduce((total, question) => total + question.timeLimit, 0);
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
          <h1 className="text-2xl font-bold text-gray-900">Assessment Management</h1>
          <p className="text-gray-600">Create and manage coding assessments</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Assessment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Assessments</p>
              <p className="text-2xl font-bold text-gray-900">{assessments.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Code className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Questions</p>
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Easy</p>
              <p className="text-2xl font-bold text-gray-900">
                {assessments.filter(a => a.difficulty === 'easy').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Hard</p>
              <p className="text-2xl font-bold text-gray-900">
                {assessments.filter(a => a.difficulty === 'hard').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search assessments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assessment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingAssessment ? 'Edit Assessment' : 'Create New Assessment'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Assessment Title
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., React Fundamentals Assessment"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Describe what this assessment covers..."
                  />
                </div>

                {/* Question Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Questions ({formData.selectedQuestions.length} selected)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuestionSelector(!showQuestionSelector)}
                      className="flex items-center text-purple-600 hover:text-purple-700"
                    >
                      {showQuestionSelector ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                      {showQuestionSelector ? 'Hide' : 'Show'} Questions
                    </button>
                  </div>

                  {/* Selected Questions Summary */}
                  {formData.selectedQuestions.length > 0 && (
                    <div className="p-3 mb-3 border border-blue-200 rounded-lg bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-blue-900">Selected Questions</h4>
                        <span className="text-sm text-blue-700">Total Time: {getTotalTimeLimit()} min</span>
                      </div>
                      <div className="space-y-1">
                        {getSelectedQuestions().map(question => (
                          <div key={question.id} className="flex items-center justify-between text-sm">
                            <span className="text-blue-800">{question.title}</span>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {question.difficulty}
                              </span>
                              <span className="text-blue-600">{question.timeLimit}min</span>
                              <button
                                type="button"
                                onClick={() => toggleQuestionSelection(question.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question Selector */}
                  {showQuestionSelector && (
                    <div className="p-4 overflow-y-auto border border-gray-300 rounded-lg max-h-80">
                      <div className="mb-3">
                        <div className="relative">
                          <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                          <input
                            type="text"
                            placeholder="Search questions..."
                            value={questionSearchTerm}
                            onChange={(e) => setQuestionSearchTerm(e.target.value)}
                            className="w-full py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {filteredQuestions.map(question => (
                          <div
                            key={question.id}
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                              formData.selectedQuestions.includes(question.id) ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                            }`}
                            onClick={() => toggleQuestionSelection(question.id)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                  formData.selectedQuestions.includes(question.id) 
                                    ? 'border-purple-500 bg-purple-500' 
                                    : 'border-gray-300'
                                }`}>
                                  {formData.selectedQuestions.includes(question.id) && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <h4 className="font-medium text-gray-900">{question.title}</h4>
                              </div>
                              <p className="mt-1 text-sm text-gray-600">{question.description}</p>
                              <div className="flex items-center mt-2 space-x-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                  question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {question.difficulty}
                                </span>
                                <span className="text-xs text-blue-600">{question.category}</span>
                                <span className="text-xs text-gray-500">{question.timeLimit}min</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {filteredQuestions.length === 0 && (
                        <div className="py-8 text-center text-gray-500">
                          <Code className="w-8 h-8 mx-auto mb-2" />
                          <p>No questions found. Create some questions first!</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingAssessment ? 'Update' : 'Create'} Assessment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assessments Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAssessments.map((assessment) => {
          const assessmentQuestions = getAssessmentQuestions(assessment);
          return (
            <div key={assessment.id} className="p-6 transition-shadow bg-white rounded-lg shadow-md hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  assessment.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  assessment.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {assessment.difficulty}
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(assessment)}
                    className="text-gray-600 hover:text-purple-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(assessment.id, assessment.title)}
                    className="text-gray-600 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="mb-2 font-semibold text-gray-900">{assessment.title}</h3>
              <p className="mb-4 text-sm text-gray-600 line-clamp-2">{assessment.description}</p>
              
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Code className="w-4 h-4 mr-1" />
                    {assessmentQuestions.length} questions
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {assessmentQuestions.reduce((total, q) => total + q.timeLimit, 0)}min
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Created: {formatDate(assessment.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAssessments.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No assessments found</h3>
          <p className="mb-4 text-gray-600">
            {searchTerm || difficultyFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first assessment.'
            }
          </p>
          {!searchTerm && difficultyFilter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Assessment
            </button>
          )}
        </div>
      )}

      {questions.length === 0 && (
        <div className="p-4 text-center border border-yellow-200 rounded-lg bg-yellow-50">
          <Code className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
          <p className="text-yellow-800">
            No questions available. <a href="/admin/questions" className="underline">Create some questions first</a> to build assessments.
          </p>
        </div>
      )}
    </div>
  );
}

export default ManageAssessments;
