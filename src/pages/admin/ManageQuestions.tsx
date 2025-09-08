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
import { 
  Code, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  Save,
  X,
  FileText,
  Zap,
  Clock,
  Folder,
  File,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReactQuestion {
  id: string;
  title: string;
  description: string;
  instructions: string;
  starterCode: string | Record<string, string>;
  solutionCode: string | Record<string, string>; // Solution code per file
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
  createdAt: string;
}

interface QuestionFormData {
  title: string;
  description: string;
  instructions: string;
  starterCode: string | Record<string, string>;
  solutionCode: string | Record<string, string>;
  multiple: boolean;
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

function ManageQuestions() {
  const [questions, setQuestions] = useState<ReactQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ReactQuestion | null>(null);
  const [activeFile, setActiveFile] = useState<string>('App.jsx');
  const [newFileName, setNewFileName] = useState<string>('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [viewingSolutionCode, setViewingSolutionCode] = useState(false); // Toggle between starter and solution
  
  const [formData, setFormData] = useState<QuestionFormData>({
    title: '',
    description: '',
    instructions: '',
    starterCode: `import React, { useState } from 'react';

export default function Component() {
  // Your code here
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
}`,
    solutionCode: `import React, { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
    </div>
  );
}`,
    multiple: false,
    difficulty: 'easy',
    category: 'React Basics',
    testCases: [
      {
        name: 'Initial Render',
        description: 'Component renders with initial state',
        expectedBehavior: 'Shows counter starting at 0',
        weight: 30
      },
      {
        name: 'Increment Function',
        description: 'Increment button increases counter',
        expectedBehavior: 'Counter value increases by 1 when increment button clicked',
        weight: 35
      },
      {
        name: 'Decrement Function',
        description: 'Decrement button decreases counter',
        expectedBehavior: 'Counter value decreases by 1 when decrement button clicked',
        weight: 35
      }
    ],
    hints: [
      'Use useState hook to manage counter state',
      'Create event handlers for increment and decrement',
      'Make sure to update state immutably'
    ],
    timeLimit: 30,
    tags: ['React', 'useState', 'Events', 'State Management']
  });

  const categories = [
    'React Basics',
    'State Management',
    'Props & Components',
    'Hooks',
    'Event Handling',
    'Forms',
    'API Integration',
    'Routing',
    'Context API',
    'Custom Hooks',
    'Performance',
    'Testing'
  ];

  useEffect(() => {
    const q = query(collection(db, 'react_questions'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questionData: ReactQuestion[] = [];
      snapshot.forEach((doc) => {
        questionData.push({ id: doc.id, ...doc.data() } as ReactQuestion);
      });
      setQuestions(questionData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const questionData = {
        ...formData,
        createdAt: serverTimestamp(),
      };

      if (editingQuestion) {
        await updateDoc(doc(db, 'react_questions', editingQuestion.id), questionData);
        toast.success('React question updated successfully');
      } else {
        await addDoc(collection(db, 'react_questions'), questionData);
        toast.success('React question created successfully');
      }

      resetForm();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    }
  };

  const handleEdit = (question: ReactQuestion) => {
    setEditingQuestion(question);
    setFormData({
      title: question.title,
      description: question.description,
      instructions: question.instructions,
      starterCode: question.starterCode,
      solutionCode: question.solutionCode || (question.multiple ? {} : ''),
      multiple: question.multiple || false,
      difficulty: question.difficulty,
      category: question.category,
      testCases: [...question.testCases],
      hints: [...question.hints],
      timeLimit: question.timeLimit,
      tags: [...question.tags]
    });
    
    // Set active file for multi-file projects
    if (question.multiple && typeof question.starterCode === 'object') {
      setActiveFile(Object.keys(question.starterCode)[0] || 'App.jsx');
    }
    
    setShowForm(true);
  };

  const handleDelete = async (questionId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'react_questions', questionId));
      toast.success('Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      instructions: '',
      starterCode: `import React, { useState } from 'react';

export default function Component() {
  // Your code here
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
}`,
      solutionCode: '',
      multiple: false,
      difficulty: 'easy',
      category: 'React Basics',
      testCases: [
        {
          name: 'Initial Render',
          description: 'Component renders correctly',
          expectedBehavior: 'Shows expected initial state',
          weight: 50
        },
        {
          name: 'Functionality',
          description: 'All features work as expected',
          expectedBehavior: 'Interactive elements respond correctly',
          weight: 50
        }
      ],
      hints: [],
      timeLimit: 30,
      tags: []
    });
    setEditingQuestion(null);
    setShowForm(false);
    setActiveFile('App.jsx');
    setShowNewFileInput(false);
    setNewFileName('');
    setViewingSolutionCode(false);
  };

  // Multi-file management functions
  const createNewFile = () => {
    if (newFileName.trim() && typeof formData.starterCode === 'object') {
      const extension = newFileName.includes('.') ? '' : '.jsx';
      const filename = newFileName + extension;
      
      if (!formData.starterCode[filename]) {
        const newStarterCode = `// New file: ${filename}\nimport React from 'react';\n\nexport default function ${filename.replace(/\.[^.]+$/, '')}() {\n  return (\n    <div>\n      {/* Your code here */}\n    </div>\n  );\n}`;
        
        const newSolutionCode = `// Solution for: ${filename}\nimport React from 'react';\n\nexport default function ${filename.replace(/\.[^.]+$/, '')}() {\n  return (\n    <div>\n      {/* Solution code here */}\n    </div>\n  );\n}`;

        setFormData(prev => ({
          ...prev,
          starterCode: {
            ...(prev.starterCode as Record<string, string>),
            [filename]: newStarterCode
          },
          solutionCode: {
            ...(prev.solutionCode as Record<string, string>),
            [filename]: newSolutionCode
          }
        }));
        setActiveFile(filename);
      }
    }
    setNewFileName('');
    setShowNewFileInput(false);
  };

  const deleteFile = (filename: string) => {
    if (filename !== 'App.jsx' && typeof formData.starterCode === 'object') {
      const newStarterFiles = { ...formData.starterCode };
      const newSolutionFiles = { ...(formData.solutionCode as Record<string, string>) };
      
      delete newStarterFiles[filename];
      delete newSolutionFiles[filename];
      
      setFormData(prev => ({ 
        ...prev, 
        starterCode: newStarterFiles,
        solutionCode: newSolutionFiles
      }));
      
      if (activeFile === filename) {
        setActiveFile('App.jsx');
      }
    }
  };

  const updateFileContent = (filename: string, content: string, isStarterCode: boolean = true) => {
    if (formData.multiple) {
      if (isStarterCode && typeof formData.starterCode === 'object') {
        setFormData(prev => ({
          ...prev,
          starterCode: {
            ...(prev.starterCode as Record<string, string>),
            [filename]: content
          }
        }));
      } else if (!isStarterCode && typeof formData.solutionCode === 'object') {
        setFormData(prev => ({
          ...prev,
          solutionCode: {
            ...(prev.solutionCode as Record<string, string>),
            [filename]: content
          }
        }));
      }
    } else {
      if (isStarterCode) {
        setFormData(prev => ({ ...prev, starterCode: content }));
      } else {
        setFormData(prev => ({ ...prev, solutionCode: content }));
      }
    }
  };

  const toggleMultiple = () => {
    const newMultiple = !formData.multiple;
    
    if (newMultiple) {
      // Convert single file to multi-file
      const currentStarterCode = typeof formData.starterCode === 'string' ? formData.starterCode : '';
      const currentSolutionCode = typeof formData.solutionCode === 'string' ? formData.solutionCode : '';
      
      setFormData(prev => ({
        ...prev,
        multiple: true,
        starterCode: {
          'App.jsx': currentStarterCode
        },
        solutionCode: {
          'App.jsx': currentSolutionCode || currentStarterCode
        }
      }));
      setActiveFile('App.jsx');
    } else {
      // Convert multi-file to single file
      const appStarterCode = typeof formData.starterCode === 'object' 
        ? formData.starterCode['App.jsx'] || formData.starterCode[Object.keys(formData.starterCode)[0]] || ''
        : formData.starterCode;
      
      const appSolutionCode = typeof formData.solutionCode === 'object'
        ? formData.solutionCode['App.jsx'] || formData.solutionCode[Object.keys(formData.solutionCode)[0]] || ''
        : formData.solutionCode;
      
      setFormData(prev => ({
        ...prev,
        multiple: false,
        starterCode: appStarterCode,
        solutionCode: appSolutionCode || appStarterCode
      }));
    }
  };

  // Existing helper functions (addTestCase, updateTestCase, etc.) remain the same...
  const addTestCase = () => {
    setFormData(prev => ({
      ...prev,
      testCases: [...prev.testCases, { 
        name: '', 
        description: '', 
        expectedBehavior: '', 
        weight: 0 
      }]
    }));
  };

  const updateTestCase = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      testCases: prev.testCases.map((testCase, i) => 
        i === index ? { ...testCase, [field]: value } : testCase
      )
    }));
  };

  const removeTestCase = (index: number) => {
    setFormData(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== index)
    }));
  };

  const addHint = () => {
    setFormData(prev => ({
      ...prev,
      hints: [...prev.hints, '']
    }));
  };

  const updateHint = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      hints: prev.hints.map((hint, i) => i === index ? value : hint)
    }));
  };

  const removeHint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index)
    }));
  };

  const filteredQuestions = questions.filter(question => {
    const questionText = question?.title || '';
    const searchText = searchTerm || '';
    const matchesSearch = questionText.toLowerCase().includes(searchText.toLowerCase()) ||
                         (question?.description || '').toLowerCase().includes(searchText.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || question?.category === categoryFilter;
    const matchesDifficulty = difficultyFilter === 'all' || question?.difficulty === difficultyFilter;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const getCurrentFileContent = () => {
    if (formData.multiple && typeof formData.starterCode === 'object') {
      if (viewingSolutionCode && typeof formData.solutionCode === 'object') {
        return formData.solutionCode[activeFile] || '';
      }
      return formData.starterCode[activeFile] || '';
    }
    return viewingSolutionCode 
      ? (typeof formData.solutionCode === 'string' ? formData.solutionCode : '')
      : (typeof formData.starterCode === 'string' ? formData.starterCode : '');
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
      {/* Header - Same as before */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">React Coding Questions</h1>
          <p className="text-gray-600">Create and manage React coding challenges</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Question
        </button>
      </div>

      {/* Stats - Same as before */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Code className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Easy</p>
              <p className="text-2xl font-bold text-gray-900">
                {questions.filter(q => q.difficulty === 'easy').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Medium</p>
              <p className="text-2xl font-bold text-gray-900">
                {questions.filter(q => q.difficulty === 'medium').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Zap className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Hard</p>
              <p className="text-2xl font-bold text-gray-900">
                {questions.filter(q => q.difficulty === 'hard').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Folder className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Multi-File</p>
              <p className="text-2xl font-bold text-gray-900">
                {questions.filter(q => q.multiple).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Same as before */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 lg:space-x-4">
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
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

      {/* Question Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingQuestion ? 'Edit React Question' : 'Create New React Question'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Project Type Toggle */}
                <div className="p-4 rounded-lg bg-gray-50">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.multiple}
                      onChange={toggleMultiple}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Multi-file Project
                    </span>
                    <span className="text-xs text-gray-500">
                      (Enable for questions requiring multiple React components in separate files)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Question Title
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Counter Component with Hooks"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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

                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Category
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {categories.map(category => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Time Limit (minutes)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={formData.timeLimit}
                        onChange={(e) => setFormData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 30 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
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
                        placeholder="Brief description of what the student needs to build..."
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Instructions
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formData.instructions}
                        onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Detailed instructions for the student..."
                      />
                    </div>
                  </div>

                  {/* Code Sections */}
                  <div className="space-y-4">
                    {/* Multi-file File Manager */}
                    {formData.multiple && typeof formData.starterCode === 'object' && (
                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Project Files
                        </label>
                        <div className="p-3 border border-gray-300 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center text-sm font-medium text-gray-600">
                              <Folder className="w-4 h-4 mr-1" />
                              Files
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowNewFileInput(true)}
                              className="px-2 py-1 text-xs text-white bg-purple-600 rounded hover:bg-purple-700"
                            >
                              <Plus className="inline w-3 h-3 mr-1" />
                              Add File
                            </button>
                          </div>
                          
                          {showNewFileInput && (
                            <div className="flex items-center mb-2 space-x-2">
                              <input
                                type="text"
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="ComponentName.jsx"
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                onKeyPress={(e) => e.key === 'Enter' && createNewFile()}
                              />
                              <button
                                type="button"
                                onClick={createNewFile}
                                className="px-2 py-1 text-xs text-white bg-green-600 rounded"
                              >
                                Create
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowNewFileInput(false)}
                                className="px-2 py-1 text-xs text-white bg-gray-600 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          
                          <div className="space-y-1">
                            {Object.keys(formData.starterCode).map((filename) => (
                              <div
                                key={filename}
                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
                                  activeFile === filename 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : 'hover:bg-gray-100 text-gray-700'
                                }`}
                                onClick={() => setActiveFile(filename)}
                              >
                                <div className="flex items-center">
                                  <File className="w-3 h-3 mr-1" />
                                  {filename}
                                  {filename === 'App.jsx' && (
                                    <span className="px-1 ml-1 text-xs text-blue-600 bg-blue-100 rounded">main</span>
                                  )}
                                </div>
                                {filename !== 'App.jsx' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteFile(filename);
                                    }}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Code Editor with Toggle */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-gray-700">
                          {formData.multiple ? `${activeFile} - Code` : 'Code'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setViewingSolutionCode(!viewingSolutionCode)}
                          className={`flex items-center space-x-1 px-2 py-1 text-xs rounded ${
                            viewingSolutionCode 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {viewingSolutionCode ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{viewingSolutionCode ? 'Solution Code' : 'Starter Code'}</span>
                        </button>
                      </div>
                      
                      <textarea
                        required
                        rows={14}
                        value={getCurrentFileContent()}
                        onChange={(e) => {
                          if (formData.multiple && typeof formData.starterCode === 'object') {
                            updateFileContent(activeFile, e.target.value, !viewingSolutionCode);
                          } else {
                            updateFileContent('', e.target.value, !viewingSolutionCode);
                          }
                        }}
                        className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder={viewingSolutionCode ? "Solution code..." : "Starter code..."}
                      />
                      
                      <p className="mt-1 text-xs text-gray-500">
                        {viewingSolutionCode 
                          ? 'This is the solution code that will be used for comparison'
                          : 'This is the starter code students will see'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Test Cases, Hints, Tags sections remain the same... */}
                {/* Test Cases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Test Cases
                    </label>
                    <button
                      type="button"
                      onClick={addTestCase}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      + Add Test Case
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.testCases.map((testCase, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="grid grid-cols-12 gap-3">
                          <input
                            type="text"
                            placeholder="Test name"
                            value={testCase.name}
                            onChange={(e) => updateTestCase(index, 'name', e.target.value)}
                            className="col-span-3 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            placeholder="Description"
                            value={testCase.description}
                            onChange={(e) => updateTestCase(index, 'description', e.target.value)}
                            className="col-span-4 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            placeholder="Expected behavior"
                            value={testCase.expectedBehavior}
                            onChange={(e) => updateTestCase(index, 'expectedBehavior', e.target.value)}
                            className="col-span-3 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="Weight"
                            value={testCase.weight}
                            onChange={(e) => updateTestCase(index, 'weight', parseInt(e.target.value) || 0)}
                            className="col-span-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeTestCase(index)}
                            className="col-span-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hints */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Hints (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={addHint}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      + Add Hint
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {formData.hints.map((hint, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder={`Hint ${index + 1}`}
                          value={hint}
                          onChange={(e) => updateHint(index, e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeHint(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="React, useState, Events, etc."
                  />
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
                    {editingQuestion ? 'Update' : 'Create'} Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Questions Grid - Same as before */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredQuestions.map((question) => (
          <div key={question.id} className="p-6 transition-shadow bg-white rounded-lg shadow-md hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {question.difficulty}
                </span>
                {question.multiple && (
                  <span className="px-2 py-1 text-xs font-medium text-purple-800 bg-purple-100 rounded">
                    Multi-file
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(question)}
                  className="text-gray-600 hover:text-purple-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(question.id, question.title)}
                  className="text-gray-600 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <h3 className="mb-2 font-semibold text-gray-900">{question.title}</h3>
            <p className="mb-3 text-sm text-gray-600 line-clamp-2">{question.description}</p>
            
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span className="px-2 py-1 text-blue-800 bg-blue-100 rounded">
                  {question.category}
                </span>
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {question.timeLimit}min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{question.testCases?.length || 0} test cases</span>
                <span>
                  {question.multiple && typeof question.starterCode === 'object' 
                    ? `${Object.keys(question.starterCode).length} files` 
                    : 'Single file'
                  }
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="py-12 text-center">
          <Code className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No React questions found</h3>
          <p className="mb-4 text-gray-600">
            {searchTerm || categoryFilter !== 'all' || difficultyFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first React coding question.'
            }
          </p>
          {!searchTerm && categoryFilter === 'all' && difficultyFilter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Question
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ManageQuestions;
