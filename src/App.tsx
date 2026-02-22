/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  X, 
  Zap,
  Anchor,
  Timer,
  ChevronDown
} from 'lucide-react';

// --- Types ---

type TimePreference = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';
type TaskType = 'Flexible' | 'Fixed';

interface Task {
  id: string;
  name: string;
  type: TaskType;
  duration?: number; // for Flexible
  preference?: TimePreference; // for Flexible
  startTime?: string; // for Fixed (HH:mm)
  endTime?: string; // for Fixed (HH:mm)
  completed: boolean;
}

interface ScheduledTask extends Task {
  displayStartTime: string;
  displayEndTime: string;
}

// --- Constants ---

const PREFERENCE_WINDOWS = {
  Morning: { start: 6, end: 12 },
  Afternoon: { start: 12, end: 17 },
  Evening: { start: 17, end: 22 },
  Anytime: { start: 6, end: 22 },
};

// --- Utils ---

const formatTimeFromMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const date = new Date();
  date.setHours(hours, minutes);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// --- Components ---

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);

  // Form State
  const [taskType, setTaskType] = useState<TaskType>('Flexible');
  const [taskName, setTaskName] = useState('');
  const [taskDuration, setTaskDuration] = useState(30);
  const [taskPref, setTaskPref] = useState<TimePreference>('Anytime');
  const [fixedStart, setFixedStart] = useState('');
  const [fixedEnd, setFixedEnd] = useState('');

  // Load data
  useEffect(() => {
    const savedTasks = localStorage.getItem('weekend-architect-v2');
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
    localStorage.setItem('weekend-architect-v2', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!taskName.trim()) return;
    
    const task: Task = {
      id: crypto.randomUUID(),
      name: taskName,
      type: taskType,
      duration: taskType === 'Flexible' ? taskDuration : undefined,
      preference: taskType === 'Flexible' ? taskPref : undefined,
      startTime: taskType === 'Fixed' ? fixedStart : undefined,
      endTime: taskType === 'Fixed' ? fixedEnd : undefined,
      completed: false,
    };

    setTasks([...tasks, task]);
    resetForm();
    setIsModalOpen(false);
  };

  const resetForm = () => {
    setTaskName('');
    setTaskDuration(30);
    setTaskPref('Anytime');
    setFixedStart('');
    setFixedEnd('');
    setTaskType('Flexible');
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
    
    setTimeout(() => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startOfPlan = Math.max(currentMinutes + 10, 6 * 60); // Start 10 mins from now or 6 AM

      const pendingTasks = tasks.filter(t => !t.completed);
      
      // 1. Separate Fixed and Flexible
      const fixedEvents = pendingTasks
        .filter(t => t.type === 'Fixed' && t.startTime && t.endTime)
        .sort((a, b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!));
      
      const flexibleTasks = pendingTasks.filter(t => t.type === 'Flexible');

      // 2. Initialize schedule with Fixed Events
      const schedule: ScheduledTask[] = fixedEvents.map(event => ({
        ...event,
        displayStartTime: formatTimeFromMinutes(timeToMinutes(event.startTime!)),
        displayEndTime: formatTimeFromMinutes(timeToMinutes(event.endTime!)),
      }));

      // 3. Slotting Flexible Tasks
      let timePointer = startOfPlan;
      const finalSchedule: ScheduledTask[] = [];
      
      // Sort flexible by preference window start, then duration
      const sortedFlexible = [...flexibleTasks].sort((a, b) => {
        const aStart = PREFERENCE_WINDOWS[a.preference!].start;
        const bStart = PREFERENCE_WINDOWS[b.preference!].start;
        if (aStart !== bStart) return aStart - bStart;
        return a.duration! - b.duration!;
      });

      // Simple greedy slotting
      const allEvents = [...schedule].sort((a, b) => timeToMinutes(a.startTime || '00:00') - timeToMinutes(b.startTime || '00:00'));
      
      const tempSchedule: ScheduledTask[] = [];
      
      sortedFlexible.forEach(task => {
        let placed = false;
        
        // Try to find a gap
        while (!placed && timePointer < 23 * 60) {
          const taskStart = timePointer;
          const taskEnd = timePointer + task.duration!;
          
          // Check for collision with fixed events
          const collision = fixedEvents.find(event => {
            const eStart = timeToMinutes(event.startTime!);
            const eEnd = timeToMinutes(event.endTime!);
            return (taskStart < eEnd && taskEnd > eStart);
          });

          if (collision) {
            // Jump to end of collision
            timePointer = timeToMinutes(collision.endTime!) + 5;
          } else {
            // Check if it fits in preference window (or later)
            // We allow it to move to next available gap if it's past preference
            tempSchedule.push({
              ...task,
              displayStartTime: formatTimeFromMinutes(taskStart),
              displayEndTime: formatTimeFromMinutes(taskEnd),
            });
            timePointer = taskEnd + 5;
            placed = true;
          }
        }
      });

      // Merge and sort final schedule
      const combined = [...schedule, ...tempSchedule].sort((a, b) => {
        const aStart = a.type === 'Fixed' ? timeToMinutes(a.startTime!) : timeToMinutes(a.displayStartTime.includes('AM') || a.displayStartTime.includes('PM') ? '00:00' : '00:00'); // This is tricky due to display format
        // Better to store minutes in ScheduledTask for sorting
        return 0; // Placeholder for now, will fix below
      });

      // Re-calculate minutes for proper sorting
      const finalWithMinutes = [...schedule, ...tempSchedule].map(t => ({
        ...t,
        sortMinutes: t.type === 'Fixed' ? timeToMinutes(t.startTime!) : timeToMinutes(t.displayStartTime.split(' ')[0]) // Rough
      })).sort((a, b) => {
        // Proper time comparison
        const getMins = (t: ScheduledTask) => {
          if (t.type === 'Fixed') return timeToMinutes(t.startTime!);
          // Convert "02:30 PM" back to minutes
          const [time, period] = t.displayStartTime.split(' ');
          let [h, m] = time.split(':').map(Number);
          if (period === 'PM' && h !== 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        };
        return getMins(a) - getMins(b);
      });

      setScheduledTasks(finalWithMinutes);
      setIsPlanning(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 px-6 py-6 flex justify-between items-center bg-transparent">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Weekend Architect</h1>
          <p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em] mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="glass-card w-12 h-12 flex items-center justify-center text-blue-300">
          <Calendar size={24} />
        </div>
      </header>

      <main className="px-6 space-y-8 max-w-md mx-auto">
        {/* Empty State */}
        {tasks.length === 0 && !scheduledTasks.length && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-12 flex flex-col items-center text-center space-y-6"
          >
            <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center text-white/20">
              <Zap size={48} />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Your day is a blank canvas</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Add fixed events and flexible tasks to build your perfect weekend blueprint.
              </p>
            </div>
          </motion.div>
        )}

        {/* Bento Grid: Scheduled Timeline */}
        {scheduledTasks.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">The Blueprint</h2>
              <button 
                onClick={() => setScheduledTasks([])}
                className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
              >
                Reset Plan
              </button>
            </div>
            
            <div className="grid gap-4">
              {scheduledTasks.map((task, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={task.id}
                  onClick={() => toggleComplete(task.id)}
                  className={`glass-card p-5 relative overflow-hidden group cursor-pointer transition-all active:scale-[0.98] ${
                    task.completed ? 'opacity-40 grayscale' : ''
                  } ${task.type === 'Fixed' ? 'border-blue-400/40 bg-blue-500/5' : ''}`}
                >
                  {/* Type Indicator */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {task.type === 'Fixed' ? (
                        <div className="bg-blue-500/20 text-blue-300 p-1.5 rounded-lg">
                          <Anchor size={14} />
                        </div>
                      ) : (
                        <div className="bg-white/10 text-white/60 p-1.5 rounded-lg">
                          <Timer size={14} />
                        </div>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                        {task.type}
                      </span>
                    </div>
                    {task.completed && <CheckCircle2 size={18} className="text-emerald-400" />}
                  </div>

                  <h3 className={`text-lg font-bold leading-tight mb-2 ${task.completed ? 'line-through' : ''}`}>
                    {task.name}
                  </h3>

                  <div className="flex items-center gap-4 text-xs font-bold text-white/60">
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-400" />
                      <span>{task.displayStartTime} — {task.displayEndTime}</span>
                    </div>
                    {task.duration && (
                      <span className="bg-white/5 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-tighter">
                        {task.duration}m
                      </span>
                    )}
                  </div>

                  {/* Highlight for Fixed */}
                  {task.type === 'Fixed' && (
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-400/50" />
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Bento Grid: Backlog */}
        {tasks.length > 0 && tasks.filter(t => !scheduledTasks.find(st => st.id === t.id)).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 px-2">The Backlog</h2>
            <div className="grid grid-cols-1 gap-3">
              {tasks.filter(t => !scheduledTasks.find(st => st.id === t.id)).map((task) => (
                <div 
                  key={task.id} 
                  className="glass-card p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${task.type === 'Fixed' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-white/40'}`}>
                      {task.type === 'Fixed' ? <Anchor size={18} /> : <Timer size={18} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{task.name}</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-0.5">
                        {task.type === 'Fixed' ? `${task.startTime} - ${task.endTime}` : `${task.preference} • ${task.duration}m`}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 px-6 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] z-40 flex gap-4 bg-gradient-to-t from-[#1e1b4b] to-transparent">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="glass-button flex-1 h-[56px] flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add Task
        </button>
        <button 
          onClick={planDay}
          disabled={tasks.length === 0 || isPlanning}
          className="flex-[1.5] h-[56px] bg-blue-600 rounded-2xl font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {isPlanning ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Zap size={20} />
              Plan Day
            </>
          )}
        </button>
      </nav>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 glass-card rounded-t-[40px] z-50 px-8 pt-10 pb-[calc(32px+env(safe-area-inset-bottom))] border-x-0 border-b-0"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-10" />
              
              <div className="space-y-8">
                {/* Type Selector */}
                <div className="flex bg-white/5 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setTaskType('Flexible')}
                    className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all ${taskType === 'Flexible' ? 'bg-white/10 text-white shadow-lg' : 'text-white/40'}`}
                  >
                    Flexible
                  </button>
                  <button 
                    onClick={() => setTaskType('Fixed')}
                    className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all ${taskType === 'Fixed' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40'}`}
                  >
                    Fixed Event
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 block">Task Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder={taskType === 'Flexible' ? "e.g. Read a book" : "e.g. Dinner with Sarah"}
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="glass-input w-full h-16 text-lg font-bold"
                  />
                </div>

                {taskType === 'Flexible' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 block">Duration</label>
                      <div className="relative">
                        <select 
                          value={taskDuration}
                          onChange={(e) => setTaskDuration(Number(e.target.value))}
                          className="glass-input w-full h-16 font-bold appearance-none"
                        >
                          <option value={15}>15 mins</option>
                          <option value={30}>30 mins</option>
                          <option value={45}>45 mins</option>
                          <option value={60}>1 hour</option>
                          <option value={90}>1.5 hours</option>
                          <option value={120}>2 hours</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 block">Preference</label>
                      <div className="relative">
                        <select 
                          value={taskPref}
                          onChange={(e) => setTaskPref(e.target.value as TimePreference)}
                          className="glass-input w-full h-16 font-bold appearance-none"
                        >
                          <option value="Anytime">Anytime</option>
                          <option value="Morning">Morning</option>
                          <option value="Afternoon">Afternoon</option>
                          <option value="Evening">Evening</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 block">Start Time</label>
                      <input 
                        type="time" 
                        value={fixedStart}
                        onChange={(e) => setFixedStart(e.target.value)}
                        className="glass-input w-full h-16 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 block">End Time</label>
                      <input 
                        type="time" 
                        value={fixedEnd}
                        onChange={(e) => setFixedEnd(e.target.value)}
                        className="glass-input w-full h-16 font-bold"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={addTask}
                  className="w-full h-[64px] bg-white text-indigo-950 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-4"
                >
                  Confirm Task
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
