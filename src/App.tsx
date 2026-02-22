/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  X, 
  ChevronRight,
  LayoutGrid,
  ListTodo,
  Zap
} from 'lucide-react';

// --- Types ---

type TimePreference = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';

interface Task {
  id: string;
  name: string;
  duration: number; // in minutes
  preference: TimePreference;
  deadline?: string; // HH:mm
  completed: boolean;
}

interface ScheduledTask extends Task {
  startTime: string;
  endTime: string;
}

// --- Constants ---

const PREFERENCE_WINDOWS = {
  Morning: { start: 6, end: 12 },
  Afternoon: { start: 12, end: 17 },
  Evening: { start: 17, end: 22 },
  Anytime: { start: 6, end: 22 },
};

// --- Utils ---

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const date = new Date();
  date.setHours(hours, minutes);
  return formatTime(date);
};

// --- Components ---

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);

  // Form State
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(30);
  const [newTaskPref, setNewTaskPref] = useState<TimePreference>('Anytime');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Load data
  useEffect(() => {
    const savedTasks = localStorage.getItem('weekend-architect-tasks');
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Failed to parse tasks', e);
      }
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('weekend-architect-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!newTaskName.trim()) return;
    
    const task: Task = {
      id: crypto.randomUUID(),
      name: newTaskName,
      duration: newTaskDuration,
      preference: newTaskPref,
      deadline: newTaskDeadline || undefined,
      completed: false,
    };

    setTasks([...tasks, task]);
    resetForm();
    setIsModalOpen(false);
  };

  const resetForm = () => {
    setNewTaskName('');
    setNewTaskDuration(30);
    setNewTaskPref('Anytime');
    setNewTaskDeadline('');
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const toggleComplete = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    setScheduledTasks(scheduledTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const planDay = () => {
    setIsPlanning(true);
    
    // Artificial delay for "intelligence" feel
    setTimeout(() => {
      const now = new Date();
      let currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Buffer of 10 mins to start
      currentMinutes += 10;

      // Filter out completed tasks for the new plan
      const pendingTasks = tasks.filter(t => !t.completed);

      // Sort logic:
      // 1. Hard deadlines first
      // 2. Preference matching current time
      // 3. Duration (shorter first for quick wins)
      const sorted = [...pendingTasks].sort((a, b) => {
        if (a.deadline && !b.deadline) return -1;
        if (!a.deadline && b.deadline) return 1;
        if (a.deadline && b.deadline) return timeToMinutes(a.deadline) - timeToMinutes(b.deadline);
        
        const aPref = PREFERENCE_WINDOWS[a.preference];
        const bPref = PREFERENCE_WINDOWS[b.preference];
        
        const aIsNow = currentMinutes >= aPref.start * 60 && currentMinutes < aPref.end * 60;
        const bIsNow = currentMinutes >= bPref.start * 60 && currentMinutes < bPref.end * 60;
        
        if (aIsNow && !bIsNow) return -1;
        if (!aIsNow && bIsNow) return 1;
        
        return a.duration - b.duration;
      });

      const newSchedule: ScheduledTask[] = [];
      let timePointer = currentMinutes;

      sorted.forEach(task => {
        const start = timePointer;
        const end = timePointer + task.duration;
        
        newSchedule.push({
          ...task,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
        });
        
        timePointer = end + 5; // 5 min break between tasks
      });

      setScheduledTasks(newSchedule);
      setIsPlanning(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 pb-[calc(80px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Weekend Architect</h1>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
          <Calendar size={20} />
        </div>
      </header>

      <main className="px-6 py-8 max-w-md mx-auto">
        {/* Empty State */}
        {tasks.length === 0 && !scheduledTasks.length && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 text-slate-400">
              <ListTodo size={40} />
            </div>
            <h2 className="text-lg font-semibold mb-2">No tasks yet</h2>
            <p className="text-slate-500 text-sm px-8">
              Tap the plus button below to start building your perfect weekend schedule.
            </p>
          </div>
        )}

        {/* Scheduled Timeline */}
        {scheduledTasks.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Today's Blueprint</h2>
              <button 
                onClick={() => setScheduledTasks([])}
                className="text-xs font-semibold text-blue-600"
              >
                Clear Plan
              </button>
            </div>
            <div className="space-y-4">
              {scheduledTasks.map((task, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={task.id} 
                  className={`relative pl-8 pb-4 group ${idx === scheduledTasks.length - 1 ? '' : 'border-l-2 border-slate-200 ml-3'}`}
                >
                  {/* Timeline Dot */}
                  <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 bg-white z-10 transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-blue-500'}`} />
                  
                  <div 
                    onClick={() => toggleComplete(task.id)}
                    className={`p-4 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer ${
                      task.completed 
                        ? 'bg-emerald-50 border-emerald-100 opacity-75' 
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={`font-semibold text-base leading-tight ${task.completed ? 'line-through text-slate-500' : ''}`}>
                        {task.name}
                      </h3>
                      <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 uppercase">
                        {task.duration}m
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 font-medium">
                      <Clock size={12} className="mr-1" />
                      {task.startTime} — {task.endTime}
                      {task.deadline && (
                        <span className="ml-2 text-red-500 flex items-center">
                          <Zap size={10} className="mr-0.5" />
                          By {task.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Task List (Unscheduled) */}
        {tasks.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">The Backlog</h2>
            <div className="space-y-3">
              {tasks.filter(t => !scheduledTasks.find(st => st.id === t.id)).map((task) => (
                <div 
                  key={task.id} 
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleComplete(task.id)}
                      className="text-slate-300 hover:text-blue-500 transition-colors"
                    >
                      {task.completed ? <CheckCircle2 className="text-emerald-500" /> : <Circle />}
                    </button>
                    <div>
                      <h4 className={`font-medium text-sm ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{task.preference} • {task.duration}m</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-200 px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] z-40 flex gap-4">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex-1 h-14 bg-slate-100 text-slate-900 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Plus size={20} />
          Add Task
        </button>
        <button 
          onClick={planDay}
          disabled={tasks.length === 0 || isPlanning}
          className="flex-[1.5] h-14 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-50 disabled:shadow-none"
        >
          {isPlanning ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Zap size={20} />
              Plan My Day
            </>
          )}
        </button>
      </nav>

      {/* Slide-up Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-50 px-6 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Task Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Sketch living room layout"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-4 font-semibold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Duration (mins)</label>
                    <select 
                      value={newTaskDuration}
                      onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                      className="w-full h-14 bg-slate-50 border-none rounded-2xl px-4 font-semibold outline-none appearance-none"
                    >
                      <option value={15}>15 mins</option>
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Preference</label>
                    <select 
                      value={newTaskPref}
                      onChange={(e) => setNewTaskPref(e.target.value as TimePreference)}
                      className="w-full h-14 bg-slate-50 border-none rounded-2xl px-4 font-semibold outline-none appearance-none"
                    >
                      <option value="Anytime">Anytime</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Hard Deadline (Optional)</label>
                  <input 
                    type="time" 
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-4 font-semibold outline-none"
                  />
                </div>

                <button 
                  onClick={addTask}
                  className="w-full h-16 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-transform mt-4"
                >
                  Create Task
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
