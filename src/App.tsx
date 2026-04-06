import React, { useState, useRef, useEffect } from 'react';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import { useLocalStorage } from './hooks/useLocalStorage';
import { WordEntry } from './types';
import { processWord, translateArabicToEnglish, fetchWordDetails, GeminiResponse, ReverseTranslationResponse } from './lib/geminiService';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Badge } from './components/ui/badge';
import { Moon, Sun, Plus, Search, MoreVertical, Trash, Edit, FolderInput, Loader2, ChevronDown, ChevronUp, FolderPlus, BarChart2, BookOpen, Target, Volume2, Download, Upload, Trash2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export default function App() {
  const [words, setWords] = useLocalStorage<WordEntry[]>('vocabulary-words', []);
  const [categories, setCategories] = useLocalStorage<{name: string, icon: string}[]>('vocabulary-categories', [
    { name: 'Home', icon: '🏠' },
    { name: 'Food', icon: '🍔' },
    { name: 'Travel', icon: '✈️' },
    { name: 'Work', icon: '💼' },
    { name: 'Education', icon: '📚' },
    { name: 'Nature', icon: '🌳' },
    { name: 'Technology', icon: '💻' },
    { name: 'Health', icon: '🏥' },
    { name: 'General', icon: '📝' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [englishInput, setEnglishInput] = useState('');
  const [arabicInput, setArabicInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; data: GeminiResponse | null }>({ isOpen: false, data: null });
  const [reverseDialog, setReverseDialog] = useState<{ isOpen: boolean; data: ReverseTranslationResponse | null }>({ isOpen: false, data: null });
  const [createCatDialog, setCreateCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');
  const [showStats, setShowStats] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState<{ isOpen: boolean; word: WordEntry | null }>({ isOpen: false, word: null });
  const [moveDialog, setMoveDialog] = useState<{ isOpen: boolean; word: WordEntry | null }>({ isOpen: false, word: null });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; wordId: string | null }>({ isOpen: false, wordId: null });
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [highlightedWordId, setHighlightedWordId] = useState<string | null>(null);

  const getCategoryIcon = (catName: string) => {
    const cat = categories.find(c => c.name === catName);
    return cat ? cat.icon : '📁';
  };

  const englishInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    englishInputRef.current?.focus();
  }, []);

  const handleEnglishInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow English letters and spaces
    const value = e.target.value;
    if (/^[a-zA-Z\s]*$/.test(value)) {
      setEnglishInput(value);
    }
  };

  const handleAddWord = async () => {
    if (!englishInput.trim() && !arabicInput.trim()) return;

    setIsProcessing(true);
    try {
      // Reverse translation: Arabic to English
      if (!englishInput.trim() && arabicInput.trim()) {
        const result = await translateArabicToEnglish(arabicInput.trim());
        setReverseDialog({ isOpen: true, data: result });
        return;
      }

      // Normal translation/validation: English to Arabic
      const result = await processWord(englishInput.trim(), arabicInput.trim());
      
      if (result.has_error) {
        setErrorDialog({ isOpen: true, data: result });
      } else {
        saveWord(
          result.corrected_word || result.original_word, 
          result.translation || arabicInput.trim(), 
          result.category,
          result.example_sentence,
          result.example_translation,
          result.explanation
        );
      }
    } catch (error) {
      console.error("Error processing word:", error);
      // Fallback save if API fails
      if (englishInput.trim()) {
        saveWord(englishInput.trim(), arabicInput.trim(), 'General');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const saveWord = (word: string, translation: string, category: string, exampleSentence?: string, exampleTranslation?: string, explanation?: string) => {
    const newWord: WordEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      word,
      translation,
      category,
      exampleSentence,
      exampleTranslation,
      explanation,
      createdAt: Date.now(),
    };
    
    setWords(prev => [newWord, ...prev]);
    setCategories(prev => {
      if (!prev.some(c => c.name === category)) {
        return [...prev, { name: category, icon: '📁' }];
      }
      return prev;
    });
    setEnglishInput('');
    setArabicInput('');
    englishInputRef.current?.focus();
    
    // Auto-expand category and highlight
    setExpandedCategories(prev => ({ ...prev, [category]: true }));
    setHighlightedWordId(newWord.id);
    setTimeout(() => setHighlightedWordId(null), 2000);
  };

  const handleAcceptCorrection = () => {
    if (errorDialog.data) {
      saveWord(
        errorDialog.data.corrected_word || errorDialog.data.original_word,
        errorDialog.data.translation || arabicInput.trim(),
        errorDialog.data.category,
        errorDialog.data.example_sentence,
        errorDialog.data.example_translation,
        errorDialog.data.explanation
      );
      setErrorDialog({ isOpen: false, data: null });
    }
  };

  const handleIgnoreCorrection = () => {
    if (errorDialog.data) {
      saveWord(
        englishInput.trim(),
        arabicInput.trim(),
        errorDialog.data.category,
        errorDialog.data.example_sentence,
        errorDialog.data.example_translation,
        errorDialog.data.explanation
      );
      setErrorDialog({ isOpen: false, data: null });
    }
  };

  const handleAcceptReverseTranslation = () => {
    if (reverseDialog.data) {
      saveWord(
        reverseDialog.data.english_word,
        reverseDialog.data.arabic_translation,
        reverseDialog.data.category,
        reverseDialog.data.example_sentence,
        reverseDialog.data.example_translation
      );
      setReverseDialog({ isOpen: false, data: null });
    }
  };

  const handleViewDetails = async (word: WordEntry) => {
    if (word.exampleSentence && word.explanation) {
      setDetailsDialog({ isOpen: true, word });
      return;
    }

    setIsFetchingDetails(true);
    setDetailsDialog({ isOpen: true, word }); // Open dialog early to show loading state
    
    try {
      const details = await fetchWordDetails(word.word, word.translation);
      const updatedWord = {
        ...word,
        exampleSentence: details.example_sentence,
        exampleTranslation: details.example_translation,
        explanation: details.explanation
      };
      
      setWords(prev => prev.map(w => w.id === word.id ? updatedWord : w));
      setDetailsDialog({ isOpen: true, word: updatedWord });
    } catch (error) {
      console.error("Failed to fetch word details:", error);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const handleMoveWord = (id: string, newCategory: string) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, category: newCategory } : w));
    setExpandedCategories(prev => ({ ...prev, [newCategory]: true }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    if (!categories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      setCategories(prev => [...prev, { name: newCatName.trim(), icon: newCatIcon || '📁' }]);
    }
    setCreateCatDialog(false);
    setNewCatName('');
    setNewCatIcon('📁');
  };

  const playAudio = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyAllWords = async () => {
    if (words.length === 0) return;
    const wordsList = words.map(w => w.word).join('\n');
    try {
      await navigator.clipboard.writeText(wordsList);
      alert("تم نسخ جميع الكلمات بنجاح!");
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("حدث خطأ أثناء النسخ");
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(words));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "vocabulary-export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedWords = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedWords)) {
          setWords(importedWords);
        }
      } catch (err) {
        console.error("Failed to import words", err);
        alert("Failed to import vocabulary. Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAll = () => {
    setWords([]);
    setDeleteAllDialog(false);
  };

  const filteredWords = words.filter(w => 
    w.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
    w.translation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0.5">{part}</mark> : part
    );
  };

  const getLatestWordTime = (catName: string) => {
    const catWords = words.filter(w => w.category === catName);
    if (catWords.length === 0) return 0;
    return Math.max(...catWords.map(w => w.createdAt));
  };

  const visibleCategories = [...categories]
    .filter(cat => cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
    .sort((a, b) => {
      const timeA = getLatestWordTime(a.name);
      const timeB = getLatestWordTime(b.name);
      
      // If both have words, sort by newest word first
      if (timeA > 0 && timeB > 0) return timeB - timeA;
      
      // If only one has words, it goes first
      if (timeA > 0) return -1;
      if (timeB > 0) return 1;
      
      // If neither has words, sort alphabetically or keep original order
      return 0;
    });

  // Auto-expand categories if search query matches, or expand first category initially
  useEffect(() => {
    if (searchQuery) {
      const newExpanded: Record<string, boolean> = {};
      visibleCategories.forEach(cat => {
        if (filteredWords.some(w => w.category === cat.name)) {
          newExpanded[cat.name] = true;
        }
      });
      setExpandedCategories(prev => ({ ...prev, ...newExpanded }));
    } else if (visibleCategories.length > 0 && Object.keys(expandedCategories).length === 0) {
      // Expand the first (newest) category by default if nothing is expanded yet
      setExpandedCategories({ [visibleCategories[0].name]: true });
    }
  }, [searchQuery, words, visibleCategories.length]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground font-sans">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 shadow-sm">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight">Vocab Manager</h1>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImport}
                />
                <Button variant="ghost" size="icon" title="Import JSON" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" title="Export JSON Backup" onClick={handleExport}>
                  <Download className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" title="Copy Text List" onClick={handleCopyAllWords}>
                  <Copy className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" title="Delete All" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteAllDialog(true)}>
                  <Trash2 className="h-5 w-5" />
                </Button>
                <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
                <Button variant="ghost" size="icon" title="Focus Mode" onClick={() => { setShowFocusMode(!showFocusMode); setShowStats(false); }}>
                  <Target className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" title="Statistics" onClick={() => { setShowStats(!showStats); setShowFocusMode(false); }}>
                  <BarChart2 className="h-5 w-5" />
                </Button>
                <div className="relative w-64 hidden sm:block">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search words..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <ThemeToggle />
              </div>
            </div>
            
            {/* Mobile Search */}
            <div className="relative w-full sm:hidden">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search words..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Input Form */}
            <div className="flex gap-2 items-center">
              <Input
                ref={englishInputRef}
                placeholder="English word..."
                className="flex-1 sm:flex-[3] w-full"
                value={englishInput}
                onChange={handleEnglishInputChange}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                disabled={isProcessing}
              />
              <Input
                placeholder="Arabic (optional)"
                className="flex-1 sm:flex-[1] w-full"
                value={arabicInput}
                onChange={(e) => setArabicInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                disabled={isProcessing}
                dir="rtl"
              />
              <Button size="icon" onClick={handleAddWord} disabled={isProcessing || (!englishInput.trim() && !arabicInput.trim())} className="shrink-0">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto p-4 py-8 space-y-6">
          {showFocusMode ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Target className="h-6 w-6 text-primary" /> Focus Mode
                </h2>
                <Button variant="outline" onClick={() => setShowFocusMode(false)}>Exit Focus</Button>
              </div>
              <div className="space-y-6">
                {[...categories].reverse().map(categoryObj => {
                  const categoryWords = words.filter(w => w.category === categoryObj.name);
                  if (categoryWords.length === 0) return null;
                  
                  return (
                    <div key={categoryObj.name} className="space-y-2">
                      <h3 className="text-lg font-semibold border-b border-border pb-1 flex items-center gap-2 text-muted-foreground">
                        <span>{categoryObj.icon}</span> {categoryObj.name}
                      </h3>
                      <ul className="flex flex-col gap-1">
                        {categoryWords.map(word => (
                          <li key={word.id} className="flex justify-between items-center hover:bg-muted/50 px-2 py-1.5 rounded transition-colors group cursor-default">
                            <span className="font-medium text-base flex items-center gap-2">
                              {word.word}
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => playAudio(word.word, e)}>
                                <Volume2 className="h-3 w-3" />
                              </Button>
                            </span>
                            <span className="text-muted-foreground text-sm" dir="rtl">{word.translation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : showStats ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Statistics</h2>
                <Button variant="outline" onClick={() => setShowStats(false)}>Back to Vocabulary</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Words</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{words.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{categories.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Recently Added</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">
                      {words.filter(w => Date.now() - w.createdAt < 7 * 24 * 60 * 60 * 1000).length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">in the last 7 days</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Words per Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categories.map(cat => {
                      const count = words.filter(w => w.category === cat.name).length;
                      if (count === 0) return null;
                      const percentage = Math.round((count / Math.max(words.length, 1)) * 100);
                      return (
                        <div key={cat.name} className="flex items-center gap-4">
                          <div className="w-32 flex items-center gap-2 truncate">
                            <span>{cat.icon}</span>
                            <span className="text-sm font-medium truncate">{cat.name}</span>
                          </div>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                          </div>
                          <div className="w-12 text-right text-sm text-muted-foreground">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-[15px] sm:mb-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search categories..."
                    className="pl-8"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={() => setCreateCatDialog(true)} variant="outline" className="shrink-0">
                  <FolderPlus className="h-4 w-4 mr-2 hidden sm:block" />
                  <span className="hidden sm:inline">New Category</span>
                  <Plus className="h-4 w-4 sm:hidden" />
                </Button>
              </div>

              {visibleCategories.length === 0 && !searchQuery && !categorySearchQuery && (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="text-lg">No words added yet.</p>
                  <p className="text-sm">Start typing a word above to add it to your vocabulary!</p>
                </div>
              )}

              {visibleCategories.map(categoryObj => {
                const category = categoryObj.name;
                const categoryWords = filteredWords.filter(w => w.category === category);
                
                // Hide category if we are searching for words and it has no matches
                if (searchQuery && categoryWords.length === 0) return null;

                const isExpanded = expandedCategories[category];

                return (
                  <Card key={category} className="overflow-hidden transition-all duration-200">
                <CardHeader 
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex flex-row items-center justify-between space-y-0"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCategoryIcon(category)}</span>
                    <CardTitle className="text-lg font-medium">{category}</CardTitle>
                    <Badge variant="secondary" className="ml-2">{categoryWords.length}</Badge>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </CardHeader>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CardContent className="p-0 border-t border-border">
                        <ul className="divide-y divide-border">
                          <AnimatePresence>
                            {categoryWords.map(word => (
                              <motion.li
                                key={word.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ 
                                  opacity: 1, 
                                  y: 0,
                                  backgroundColor: highlightedWordId === word.id ? 'var(--highlight-color, rgba(59, 130, 246, 0.1))' : 'transparent'
                                }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-lg">{highlightText(word.word, searchQuery)}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => playAudio(word.word, e)}>
                                      <Volume2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {word.translation && (
                                    <span className="text-muted-foreground" dir="rtl">{highlightText(word.translation, searchQuery)}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleViewDetails(word)}>
                                    <BookOpen className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setMoveDialog({ isOpen: true, word })}>
                                    <FolderInput className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialog({ isOpen: true, wordId: word.id })}>
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
            </>
          )}
        </main>

        {/* Move Word Dialog */}
        <Dialog open={moveDialog.isOpen} onOpenChange={(isOpen) => !isOpen && setMoveDialog({ isOpen: false, word: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move Word</DialogTitle>
              <DialogDescription>Select a new category for "{moveDialog.word?.word}"</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4 max-h-[60vh] overflow-y-auto">
              {[...categories].filter(c => c.name !== moveDialog.word?.category).reverse().map(c => (
                <Button 
                  key={c.name} 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => {
                    if (moveDialog.word) {
                      handleMoveWord(moveDialog.word.id, c.name);
                      setMoveDialog({ isOpen: false, word: null });
                    }
                  }}
                >
                  <span className="mr-2">{c.icon}</span> {c.name}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.isOpen} onOpenChange={(isOpen) => !isOpen && setDeleteDialog({ isOpen: false, wordId: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Word</DialogTitle>
              <DialogDescription>Are you sure you want to delete this word? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteDialog({ isOpen: false, wordId: null })}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                if (deleteDialog.wordId) {
                  handleDeleteWord(deleteDialog.wordId);
                  setDeleteDialog({ isOpen: false, wordId: null });
                }
              }}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete All Confirmation Dialog */}
        <Dialog open={deleteAllDialog} onOpenChange={setDeleteAllDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete All Words</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <span className="font-bold text-destructive">ALL</span> saved words? This action cannot be undone. We recommend exporting a backup first.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteAllDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteAll}>Delete All</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Category Dialog */}
        <Dialog open={createCatDialog} onOpenChange={setCreateCatDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
              <DialogDescription>Add a custom category to organize your vocabulary.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Name</label>
                <Input className="col-span-3" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Sports" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Icon</label>
                <Input className="col-span-3" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="e.g. ⚽" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateCatDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateCategory} disabled={!newCatName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Error Dialog */}
        <Dialog open={errorDialog.isOpen} onOpenChange={(isOpen) => !isOpen && setErrorDialog({ isOpen: false, data: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Correction Suggested</DialogTitle>
              <DialogDescription>
                We noticed a potential error in your entry.
              </DialogDescription>
            </DialogHeader>
            
            {errorDialog.data && (
              <div className="space-y-4 my-4">
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p><strong>Message:</strong> {errorDialog.data.suggestion_message}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">You entered</p>
                    <p className="font-medium line-through text-destructive">{englishInput}</p>
                    <p className="text-muted-foreground" dir="rtl">{arabicInput}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Suggestion</p>
                    <p className="font-medium text-green-600 dark:text-green-400">{errorDialog.data.corrected_word || englishInput}</p>
                    <p className="text-muted-foreground" dir="rtl">{errorDialog.data.translation || arabicInput}</p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={handleIgnoreCorrection}>
                Ignore & Save
              </Button>
              <Button onClick={handleAcceptCorrection}>
                Accept Correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Reverse Translation Dialog */}
        <Dialog open={reverseDialog.isOpen} onOpenChange={(isOpen) => !isOpen && setReverseDialog({ isOpen: false, data: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Translation Found</DialogTitle>
              <DialogDescription>
                Here is the English translation for your Arabic word.
              </DialogDescription>
            </DialogHeader>
            
            {reverseDialog.data && (
              <div className="space-y-4 my-4">
                <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">English</p>
                    <p className="font-medium text-lg text-primary">{reverseDialog.data.english_word}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-xs text-muted-foreground uppercase">Arabic</p>
                    <p className="font-medium text-lg" dir="rtl">{reverseDialog.data.arabic_translation}</p>
                  </div>
                </div>
                
                <div className="space-y-2 border-l-2 border-primary/50 pl-4">
                  <p className="text-sm font-medium italic">"{reverseDialog.data.example_sentence}"</p>
                  <p className="text-sm text-muted-foreground" dir="rtl">{reverseDialog.data.example_translation}</p>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setReverseDialog({ isOpen: false, data: null })}>
                Cancel
              </Button>
              <Button onClick={handleAcceptReverseTranslation}>
                Add to Vocabulary
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Word Details Dialog */}
        <Dialog open={detailsDialog.isOpen} onOpenChange={(isOpen) => !isOpen && setDetailsDialog({ isOpen: false, word: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Word Details</DialogTitle>
            </DialogHeader>
            
            {isFetchingDetails ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating examples and explanation...</p>
              </div>
            ) : detailsDialog.word && (
              <div className="space-y-6 my-2">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold text-primary">{detailsDialog.word.word}</h3>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => playAudio(detailsDialog.word!.word, e)}>
                        <Volume2 className="h-5 w-5" />
                      </Button>
                    </div>
                    <p className="text-lg text-muted-foreground" dir="rtl">{detailsDialog.word.translation}</p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {getCategoryIcon(detailsDialog.word.category)} {detailsDialog.word.category}
                  </Badge>
                </div>
                
                {detailsDialog.word.explanation && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Explanation</h4>
                    <p className="text-base leading-relaxed bg-muted/50 p-3 rounded-md" dir="rtl">
                      {detailsDialog.word.explanation}
                    </p>
                  </div>
                )}

                {detailsDialog.word.exampleSentence && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Example</h4>
                    <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-md space-y-2">
                      <p className="text-lg font-medium italic text-foreground">"{detailsDialog.word.exampleSentence}"</p>
                      <p className="text-base text-muted-foreground" dir="rtl">{detailsDialog.word.exampleTranslation}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setDetailsDialog({ isOpen: false, word: null })}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}

