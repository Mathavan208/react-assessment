import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Editor } from '@monaco-editor/react';
import { Play, RotateCcw, Terminal, Eye, EyeOff, Maximize2, Minimize2, Code, AlertCircle, Plus, X, File, Folder } from 'lucide-react';
import * as Babel from '@babel/standalone';
import { createRoot, type Root } from 'react-dom/client';
import { structuralEqual, visualSimilarity, calculateAssessmentScore } from '../utils/domCompare';
import toast from 'react-hot-toast';

interface CodeRunnerProps {
  starterCode: string | Record<string, string>;
  solutionCode: string | Record<string, string>;
  questionId?: string;
  multiple?: boolean;
}

export interface CodeRunnerRef {
  getPreviewElement: () => HTMLElement | null;
  getCurrentCode: () => string | Record<string, string>;
  runCode: () => void;
  resetCode: () => void;
  getAssessmentScore: () => number;
}

interface FileStructure {
  [filename: string]: string;
}

const CodeRunner = forwardRef<CodeRunnerRef, CodeRunnerProps>(
  ({ starterCode, solutionCode, questionId, multiple = false }, ref) => {
    // Core state
    const [userFiles, setUserFiles] = useState<FileStructure>(() => {
      if (multiple && typeof starterCode === 'object') return starterCode;
      return { 'App.jsx': typeof starterCode === 'string' ? starterCode : '' };
    });
    
    const [solutionFiles, setSolutionFiles] = useState<FileStructure>(() => {
      if (multiple && typeof solutionCode === 'object') return solutionCode;
      return { 'App.jsx': typeof solutionCode === 'string' ? solutionCode : '' };
    });
    
    const [activeFile, setActiveFile] = useState<string>('App.jsx');
    const [lastQuestionId, setLastQuestionId] = useState<string>('');
    const [showConsole, setShowConsole] = useState(false);
    const [showPreview, setShowPreview] = useState(true);
    const [showSolutionPreview, setShowSolutionPreview] = useState(true); // show by default to display expected output
    const [isRunning, setIsRunning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
    const [hasUserChanges, setHasUserChanges] = useState(false);
    const [compilationError, setCompilationError] = useState<string>('');
    const [assessmentScore, setAssessmentScore] = useState<number>(0);
    const [newFileName, setNewFileName] = useState<string>('');
    const [showNewFileInput, setShowNewFileInput] = useState(false);
    
    const editorRef = useRef<any>(null);
    const userPreviewRef = useRef<HTMLDivElement>(null);
    const solutionPreviewRef = useRef<HTMLDivElement>(null);
    const userRootRef = useRef<Root | null>(null);
    const solutionRootRef = useRef<Root | null>(null);
    const previewElementRef = useRef<HTMLElement | null>(null);
    const solutionElementRef = useRef<HTMLElement | null>(null);

    // Initialize on question change
    useEffect(() => {
      if (questionId !== lastQuestionId && questionId) {
        // User files
        if (multiple && typeof starterCode === 'object') {
          setUserFiles(starterCode);
          setActiveFile(Object.keys(starterCode)[0] || 'App.jsx');
        } else {
          setUserFiles({ 'App.jsx': typeof starterCode === 'string' ? starterCode : '' });
          setActiveFile('App.jsx');
        }
        // Solution files
        if (multiple && typeof solutionCode === 'object') {
          setSolutionFiles(solutionCode);
        } else {
          setSolutionFiles({ 'App.jsx': typeof solutionCode === 'string' ? solutionCode : '' });
        }
        
        setLastQuestionId(questionId);
        setConsoleOutput([]);
        setHasUserChanges(false);
        setCompilationError('');
        setAssessmentScore(0);
        
        // Clear previews
        if (userRootRef.current) {
          userRootRef.current.unmount();
          userRootRef.current = null;
        }
        if (solutionRootRef.current) {
          solutionRootRef.current.unmount();
          solutionRootRef.current = null;
        }
      }
    }, [questionId, starterCode, solutionCode, lastQuestionId, multiple]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (userRootRef.current) {
          userRootRef.current.unmount();
          userRootRef.current = null;
        }
        if (solutionRootRef.current) {
          solutionRootRef.current.unmount();
          solutionRootRef.current = null;
        }
      };
    }, []);

    // Handle code changes from Monaco editor
    const handleEditorChange = useCallback((value: string | undefined) => {
      if (value !== undefined) {
        setUserFiles(prev => ({ ...prev, [activeFile]: value }));
        setHasUserChanges(true);
        setCompilationError('');
      }
    }, [activeFile]);

    // Get current code
    const getCurrentCode = useCallback(() => {
      return multiple ? userFiles : userFiles['App.jsx'] || '';
    }, [multiple, userFiles]);

    // Transform ES6 modules to executable code
    const transformCode = useCallback((code: string) => {
      try {
        let transformedCode = code;
        
        // Strip React imports (React will be provided as a global into the sandbox)
        transformedCode = transformedCode.replace(
          /import\s+React(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"];?\s*/g,
          '// React is available globally\n'
        );
        transformedCode = transformedCode.replace(
          /import\s+\{([^}]+)\}\s+from\s+['"]react['"];?\s*/g,
          (match, imports) => {
            const named = imports.split(',').map((imp: string) => imp.trim());
            return `// React hooks available: ${named.join(', ')}\n`;
          }
        );
        // Local file imports become window.<Module> lookups (handled in bundleFiles)
        transformedCode = transformedCode.replace(
          /import\s+.*?\s+from\s+['"]\.\/([^'"]+)['"];?\s*/g,
          (match, filename) => {
            const importName = filename.replace(/\.[^.]+$/, '');
            return `// Import: ${importName} from ${filename}\n`;
          }
        );
        // Convert `export default` to `return` so we can get a component factory
        transformedCode = transformedCode.replace(/export\s+default\s+/g, 'return ');

        const wrapped = `
          (function() {
            ${transformedCode}
            // Heuristics for default export if no return found
            if (typeof Component !== 'undefined') return Component;
            if (typeof App !== 'undefined') return App;
            if (typeof Counter !== 'undefined') return Counter;
            if (typeof TodoList !== 'undefined') return TodoList;
            if (typeof Form !== 'undefined') return Form;
            if (typeof HelloWorld !== 'undefined') return HelloWorld;
            if (typeof UserProfile !== 'undefined') return UserProfile;
            if (typeof LoginStatus !== 'undefined') return LoginStatus;
            if (typeof ProductCatalog !== 'undefined') return ProductCatalog;
            if (typeof ColorPicker !== 'undefined') return ColorPicker;
            if (typeof Timer !== 'undefined') return Timer;
            if (typeof UserSettings !== 'undefined') return UserSettings;
            if (typeof ShoppingCart !== 'undefined') return ShoppingCart;
            // Fallback
            return function DefaultComponent() {
              return React.createElement('div', {
                style: { padding: '20px', textAlign: 'center', color: '#666', border: '1px solid #ddd', borderRadius: '8px' }
              }, 'Component not found or exported properly');
            };
          })()
        `;
        return wrapped;
      } catch (error) {
        console.error('Code transformation error:', error);
        toast.error('Compilation failed during transform. Check imports/exports.');
        throw new Error(`Code transformation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, []);

    // Transpile JSX to JavaScript
    const transpileJSX = useCallback((code: string) => {
      try {
        const result = Babel.transform(code, {
          presets: [['react', { pragma: 'React.createElement', pragmaFrag: 'React.Fragment' }]],
          plugins: []
        });
        if (!result.code) throw new Error('JSX transpilation failed - no output');
        return result.code;
      } catch (error) {
        console.error('JSX transpilation error:', error);
        toast.error('Compilation failed while transpiling JSX.');
        throw new Error(`JSX transpilation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, []);

    // Bundle multi-file projects into a single program (works for user and solution)
    const bundleFiles = useCallback((files: FileStructure) => {
      const appFile = files['App.jsx'] || files['App.js'] || '';
      const otherFiles = Object.entries(files).filter(([name]) => !name.startsWith('App.'));

      let bundled = '';

      // Define other modules as window.<ModuleName> via export default replacement
      otherFiles.forEach(([filename, content]) => {
        const moduleName = filename.replace(/\.[^.]+$/, '');
        bundled += `\n// === ${filename} ===\n`;
        bundled += (content || '').replace(/export\s+default\s+/g, `window.${moduleName} = `);
        bundled += '\n';
      });

      // Replace imports in App to refer to window.<ModuleName>
      let processedApp = appFile || '';
      otherFiles.forEach(([filename]) => {
        const moduleName = filename.replace(/\.[^.]+$/, '');
        const importRegex = new RegExp(`import\\s+\\w+\\s+from\\s+['"]\\.\\/${moduleName}['"];?`, 'g');
        processedApp = processedApp.replace(importRegex, `const ${moduleName} = window.${moduleName};`);
      });

      bundled += `\n// === App.jsx ===\n`;
      bundled += processedApp;

      return bundled;
    }, []);

    // Execute and render (common for user and solution)
    const executeAndRenderCode = useCallback((
      files: FileStructure, 
      targetRef: React.RefObject<HTMLDivElement>, 
      targetRootRef: React.MutableRefObject<Root | null>,
      isUserCode: boolean = true
    ) => {
      try {
        const mockConsole = {
          log: (...args: any[]) => { setConsoleOutput(prev => [...prev, `LOG: ${args.join(' ')}`]); console.log(...args); },
          error: (...args: any[]) => { setConsoleOutput(prev => [...prev, `ERROR: ${args.join(' ')}`]); console.error(...args); toast.error(args.join(' ')); },
          warn: (...args: any[]) => { setConsoleOutput(prev => [...prev, `WARN: ${args.join(' ')}`]); console.warn(...args); }
        };

        // Build single-program source
        const programSource = multiple ? bundleFiles(files) : (files['App.jsx'] || '');
        const transformed = transformCode(programSource);
        const transpiled = transpileJSX(transformed);

        const makeComponent = new Function(
          'React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'console',
          `
            try {
              const Component = ${transpiled};
              return Component;
            } catch (error) {
              console.error('Execution error:', error);
              return function ErrorComponent() {
                return React.createElement('div', { 
                  style: { color: 'red', padding: '20px', border: '2px solid red', borderRadius: '8px', backgroundColor: '#fff5f5' }
                }, 
                  React.createElement('h3', null, 'Runtime Error'),
                  React.createElement('pre', { style: { fontSize: '12px', overflow: 'auto' } }, error.toString())
                );
              };
            }
          `
        );

        const ComponentFn = makeComponent(
          React,
          React.useState, React.useEffect, React.useCallback, React.useMemo, React.useRef,
          mockConsole
        );

        if (targetRef.current) {
          if (targetRootRef.current) targetRootRef.current.unmount();
          targetRootRef.current = createRoot(targetRef.current);
          targetRootRef.current.render(React.createElement(ComponentFn));
          
          if (isUserCode) previewElementRef.current = targetRef.current;
          else solutionElementRef.current = targetRef.current;
        }
        return true;
      } catch (error) {
        const msg = `Compilation Error: ${error instanceof Error ? error.message : String(error)}`;
        if (isUserCode) setCompilationError(msg);
        setConsoleOutput(prev => [...prev, `ERROR: ${msg}`]);
        toast.error(msg);

        if (targetRef.current) {
          if (targetRootRef.current) targetRootRef.current.unmount();
          targetRootRef.current = createRoot(targetRef.current);
          targetRootRef.current.render(
            React.createElement('div', {
              style: { padding: '20px', border: '2px solid #e74c3c', borderRadius: '8px', background: '#fdedec', color: '#c0392b', fontFamily: 'monospace' }
            },
              React.createElement('h3', null, '⚠️ Compilation Error'),
              React.createElement('pre', { style: { fontSize: '14px', overflow: 'auto', whiteSpace: 'pre-wrap', background: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #e74c3c' } }, msg)
            )
          );
        }
        return false;
      }
    }, [multiple, bundleFiles, transformCode, transpileJSX]);

    // Compare rendered outputs after both are mounted
    const compareOutputs = useCallback(() => {
      const userRoot = previewElementRef.current?.firstElementChild as HTMLElement | null;
      const solutionRoot = solutionElementRef.current?.firstElementChild as HTMLElement | null;

      if (!userRoot || !solutionRoot) {
        setAssessmentScore(0);
        return 0;
      }

      try {
        const structural = structuralEqual(solutionRoot, userRoot);
        const visual = visualSimilarity(solutionRoot, userRoot);
        const score = calculateAssessmentScore(structural, visual);
        setAssessmentScore(score);
        return score;
      } catch (e) {
        console.error('Error comparing outputs:', e);
        toast.error('Failed to compare outputs. Check rendering.');
        setAssessmentScore(0);
        return 0;
      }
    }, []);

    // Exposed helpers
    const getPreviewElement = useCallback(() => {
      return previewElementRef.current || userPreviewRef.current || null;
    }, []);
    const getAssessmentScore = useCallback(() => assessmentScore, [assessmentScore]);

    // Run code for both panes, then compare DOM
    const runCode = useCallback(() => {
      setIsRunning(true);
      setConsoleOutput([]);
      setAssessmentScore(0);
      
      const hasUserContent = Object.values(userFiles).some(code => (code || '').trim().length > 0);

      // Always render solution as expected output (even if user code is empty)
      executeAndRenderCode(solutionFiles, solutionPreviewRef, solutionRootRef, false);

      if (!hasUserContent) {
        if (userPreviewRef.current) {
          if (userRootRef.current) userRootRef.current.unmount();
          userRootRef.current = createRoot(userPreviewRef.current);
          userRootRef.current.render(
            React.createElement('div', {
              style: {
                padding: '30px', textAlign: 'center', color: '#7f8c8d',
                border: '2px dashed #bdc3c7', borderRadius: '10px', background: '#ecf0f1', fontFamily: 'Arial, sans-serif'
              }
            },
              React.createElement('h3', { style: { color: '#7f8c8d', marginBottom: '15px' } }, '📝 No Code to Run'),
              React.createElement('p', { style: { color: '#95a5a6', fontSize: '16px' } }, 'Write some React code in the editor and click "Run Code" to see the output.')
            )
          );
        }
        setIsRunning(false);
        return;
      }

      // Run user code and compare after both finished rendering
      setTimeout(() => {
        const userOk = executeAndRenderCode(userFiles, userPreviewRef, userRootRef, true);
        if (userOk) {
          setTimeout(() => { compareOutputs(); setIsRunning(false); }, 100);
        } else {
          setIsRunning(false);
        }
      }, 200);
    }, [userFiles, solutionFiles, executeAndRenderCode, compareOutputs]);

    // Reset user code and rerender solution
    const resetCode = useCallback(() => {
      if (userRootRef.current) { userRootRef.current.unmount(); userRootRef.current = null; }
      if (solutionRootRef.current) { solutionRootRef.current.unmount(); solutionRootRef.current = null; }
      
      if (multiple && typeof starterCode === 'object') {
        setUserFiles(starterCode);
        setActiveFile(Object.keys(starterCode)[0] || 'App.jsx');
      } else {
        setUserFiles({ 'App.jsx': typeof starterCode === 'string' ? starterCode : '' });
        setActiveFile('App.jsx');
      }
      
      setConsoleOutput([]);
      setHasUserChanges(false);
      setCompilationError('');
      setAssessmentScore(0);
      
      if (editorRef.current) {
        const currentContent = multiple && typeof starterCode === 'object' 
          ? starterCode[activeFile] || ''
          : typeof starterCode === 'string' 
            ? starterCode 
            : '';
        editorRef.current.setValue(currentContent);
      }
      // Re-render expected output
      setTimeout(() => { executeAndRenderCode(solutionFiles, solutionPreviewRef, solutionRootRef, false); }, 0);
    }, [starterCode, solutionFiles, multiple, activeFile, executeAndRenderCode]);

    // Multi-file file ops
    const createNewFile = () => {
      if (newFileName.trim() && !userFiles[newFileName]) {
        const extension = newFileName.includes('.') ? '' : '.jsx';
        const filename = newFileName + extension;
        setUserFiles(prev => ({
          ...prev,
          [filename]: `// New file: ${filename}\nimport React from 'react';\n\nexport default function ${filename.replace(/\.[^.]+$/, '')}() {\n  return (\n    <div>\n      {/* Your code here */}\n    </div>\n  );\n}`
        }));
        setActiveFile(filename);
        setNewFileName('');
        setShowNewFileInput(false);
        setHasUserChanges(true);
      }
    };
    const deleteFile = (filename: string) => {
      if (filename !== 'App.jsx' && Object.keys(userFiles).length > 1) {
        setUserFiles(prev => {
          const next = { ...prev };
          delete next[filename];
          return next;
        });
        if (activeFile === filename) setActiveFile('App.jsx');
        setHasUserChanges(true);
      }
    };

    // Toggles
    const togglePreview = useCallback(() => setShowPreview(p => !p), []);
    const toggleSolutionPreview = useCallback(() => setShowSolutionPreview(p => !p), []);
    const toggleConsole = useCallback(() => setShowConsole(p => !p), []);
    const toggleFullscreen = useCallback(() => setIsFullscreen(p => !p), []);

    useImperativeHandle(ref, () => ({
      getPreviewElement,
      getCurrentCode,
      runCode,
      resetCode,
      getAssessmentScore
    }), [getPreviewElement, getCurrentCode, runCode, resetCode, getAssessmentScore]);

    const editorOptions = useMemo(() => ({
      minimap: { enabled: false },
      fontSize: 14,
      lineHeight: 22,
      wordWrap: 'on' as const,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      contextmenu: false,
      folding: false,
      lineNumbers: 'on' as const,
      glyphMargin: false,
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      cursorStyle: 'line' as const,
      theme: 'vs-light',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false
    }), []);

    return (
      <div className={`flex flex-col border rounded-lg overflow-hidden bg-white transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'h-full'}`}>
        {/* Control Panel */}
        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-gray-50 to-blue-50">
          <div className="flex items-center space-x-3">
            <button onClick={runCode} disabled={isRunning} className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-white transition-all duration-200 bg-green-600 rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50 hover:shadow-lg">
              <Play className="w-4 h-4" />
              <span>{isRunning ? 'Running...' : 'Run Code'}</span>
            </button>
            <button onClick={resetCode} className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-white transition-all duration-200 bg-red-600 rounded-lg shadow-md hover:bg-red-700 hover:shadow-lg">
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            {hasUserChanges && <span className="px-2 py-1 text-xs font-medium text-orange-800 bg-orange-100 rounded-full">Modified</span>}
            {compilationError && (
              <span className="flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">
                <AlertCircle className="w-3 h-3 mr-1" />
                Error
              </span>
            )}
            {multiple && <span className="px-2 py-1 text-xs font-medium text-purple-800 bg-purple-100 rounded-full">Multi-File Project</span>}
            {assessmentScore > 0 && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${assessmentScore >= 80 ? 'bg-green-100 text-green-800' : assessmentScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                Score: {assessmentScore}%
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={toggleConsole} className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${showConsole ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              <Terminal className="w-4 h-4" />
              <span>Console</span>
              {consoleOutput.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">{consoleOutput.length}</span>}
            </button>
            <button onClick={togglePreview} className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${showPreview ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>Preview</span>
            </button>
            <button onClick={toggleSolutionPreview} className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${showSolutionPreview ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {showSolutionPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>Solution</span>
            </button>
            <button onClick={toggleFullscreen} className="flex items-center px-3 py-2 space-x-1 text-sm font-medium text-gray-700 transition-all duration-200 bg-gray-200 rounded-lg hover:bg-gray-300">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden lg:flex-row">
          {/* Editor Side */}
          <div className={`${showPreview || showSolutionPreview ? 'w-full lg:w-1/2 h-1/2 lg:h-full' : 'w-full h-full'} border-b lg:border-b-0 lg:border-r flex flex-col`}>
            {multiple && (
              <div className="border-b bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center text-sm font-semibold text-gray-700">
                      <Folder className="w-4 h-4 mr-2 text-purple-600" />
                      Project Files
                    </span>
                    <button onClick={() => setShowNewFileInput(true)} className="flex items-center px-2 py-1 text-xs text-white transition-colors bg-purple-600 rounded hover:bg-purple-700">
                      <Plus className="w-3 h-3 mr-1" />
                      New File
                    </button>
                  </div>
                  {showNewFileInput && (
                    <div className="flex items-center mb-2 space-x-2">
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="filename.jsx"
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && createNewFile()}
                        autoFocus
                      />
                      <button onClick={createNewFile} className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700">Create</button>
                      <button onClick={() => setShowNewFileInput(false)} className="px-2 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700">Cancel</button>
                    </div>
                  )}
                  <div className="space-y-1">
                    {Object.keys(userFiles).map((filename) => (
                      <div
                        key={filename}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs transition-colors ${activeFile === filename ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-100 text-gray-700'}`}
                        onClick={() => setActiveFile(filename)}
                      >
                        <div className="flex items-center">
                          <File className="w-3 h-3 mr-1" />
                          {filename}
                          {filename === 'App.jsx' && <span className="px-1 ml-1 text-xs text-blue-600 bg-blue-100 rounded">main</span>}
                        </div>
                        {filename !== 'App.jsx' && Object.keys(userFiles).length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFile(filename); }}
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

            <div className="flex items-center px-4 py-3 text-sm font-semibold text-gray-700 border-b bg-gradient-to-r from-purple-50 to-blue-50">
              <Code className="w-4 h-4 mr-2 text-purple-600" />
              Monaco Editor
              {multiple && activeFile && (
                <span className="px-2 py-1 ml-2 text-xs text-purple-800 bg-purple-100 rounded">{activeFile}</span>
              )}
              {hasUserChanges && <span className="w-2 h-2 ml-2 bg-orange-500 rounded-full"></span>}
              <span className="ml-auto text-xs text-gray-500">{(userFiles[activeFile] || '').length} chars</span>
            </div>

            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language="javascript"
                value={userFiles[activeFile] || ''}
                onChange={handleEditorChange}
                options={editorOptions}
                onMount={(editor) => { editorRef.current = editor; }}
                path={multiple ? activeFile : undefined}
              />
            </div>
          </div>

          {/* Previews */}
          {(showPreview || showSolutionPreview) && (
            <div className={`w-full lg:w-1/2 ${showConsole ? 'h-1/2 lg:h-full' : 'h-1/2 lg:h-full'} flex flex-col`}>
              {showPreview && (
                <div className={`${showSolutionPreview ? 'h-1/2 border-b' : 'h-full'} flex flex-col`}>
                  <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 border-b bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex items-center">
                      <Eye className="w-4 h-4 mr-2 text-green-600" />
                      Your Output
                      {isRunning && <div className="w-4 h-4 ml-2 border-2 border-green-600 rounded-full border-t-transparent animate-spin"></div>}
                    </div>
                    {assessmentScore > 0 && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${assessmentScore >= 80 ? 'bg-green-100 text-green-800' : assessmentScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {assessmentScore}%
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto bg-gray-50">
                    <div className="h-full p-4">
                      <div ref={userPreviewRef} className="w-full h-full overflow-auto" style={{ minHeight: '200px' }} />
                    </div>
                  </div>
                </div>
              )}

              {showSolutionPreview && (
                <div className={`${showPreview ? 'h-1/2' : 'h-full'} flex flex-col`}>
                  <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 border-b bg-gradient-to-r from-blue-50 to-green-50">
                    <div className="flex items-center">
                      <Eye className="w-4 h-4 mr-2 text-blue-600" />
                      Expected Output (Solution)
                    </div>
                    <span className="text-xs text-gray-500">Rendered from solution code</span>
                  </div>
                  <div className="flex-1 overflow-auto bg-blue-50">
                    <div className="h-full p-4">
                      <div ref={solutionPreviewRef} className="w-full h-full overflow-auto" style={{ minHeight: '200px' }} />
                    </div>
                  </div>
                </div>
              )}

              {showConsole && (
                <div className="overflow-hidden text-green-400 bg-gray-900 border-t max-h-48">
                  <div className="p-3 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <div className="flex items-center">
                        <Terminal className="w-4 h-4 mr-2" />
                        Console Output
                      </div>
                      <button onClick={() => setConsoleOutput([])} className="px-2 py-1 text-xs text-gray-400 transition-colors rounded hover:text-white hover:bg-gray-700">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="p-4 overflow-auto font-mono text-sm max-h-40">
                    {consoleOutput.length === 0 ? (
                      <div className="text-gray-500">Console is ready for output...</div>
                    ) : (
                      consoleOutput.map((log, i) => (
                        <div key={i} className={`mb-1 ${log.startsWith('ERROR:') ? 'text-red-400' : log.startsWith('WARN:') ? 'text-yellow-400' : 'text-green-400'}`}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

CodeRunner.displayName = 'CodeRunner';

export default React.memo(CodeRunner, (prevProps, nextProps) => {
  return prevProps.questionId === nextProps.questionId && 
         prevProps.starterCode === nextProps.starterCode &&
         prevProps.solutionCode === nextProps.solutionCode &&
         prevProps.multiple === nextProps.multiple;
});
