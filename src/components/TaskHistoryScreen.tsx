import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  RefreshCw,
  XCircle,
  Eye,
  Info,
  X,
} from 'lucide-react';
import { PdfFileRecord, TaskRecord, ToolId } from '../types/pdf';
import { formatDateShort } from '../storage/db';
import { EmptyState } from './EmptyState';

interface TaskHistoryScreenProps {
  tasks: TaskRecord[];
  files: PdfFileRecord[];
  onCancelTask: (taskId: string) => void;
  onRetryTask: (toolId: ToolId) => void;
  onDeleteTask: (taskId: string) => void;
  onClearHistory: () => void;
  onOpenOutputFile: (file: PdfFileRecord) => void;
  onCreatePdf: () => void;
}

export const TaskHistoryScreen: React.FC<TaskHistoryScreenProps> = ({
  tasks,
  files,
  onCancelTask,
  onRetryTask,
  onDeleteTask,
  onClearHistory,
  onOpenOutputFile,
  onCreatePdf,
}) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [errorModalTask, setErrorModalTask] = useState<TaskRecord | null>(null);

  const visibleTasks = tasks.filter((t) => filter === 'all' || t.status === filter);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124] dark:text-[#F3F4F6]">
            Processing & Task History
          </h1>
          <p className="text-xs text-[#777777] dark:text-[#9CA3AF] tabular-nums mt-0.5">
            {tasks.length} total {tasks.length === 1 ? 'task' : 'tasks'} recorded locally
          </p>
        </div>

        {tasks.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="px-3.5 py-2 min-h-[42px] rounded-xl bg-white dark:bg-[#1A1C20] border border-[#E6E6E6] dark:border-[#2A2D34] text-xs font-semibold text-[#777777] hover:text-[#E50920] cursor-pointer"
          >
            Clear Completed
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'all', label: `All (${tasks.length})` },
            { id: 'completed', label: `Completed (${tasks.filter((t) => t.status === 'completed').length})` },
            { id: 'processing', label: `Processing (${tasks.filter((t) => t.status === 'processing').length})` },
            { id: 'failed', label: `Failed (${tasks.filter((t) => t.status === 'failed').length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              filter === tab.id
                ? 'bg-[#E50920] text-white'
                : 'bg-white dark:bg-[#1A1C20] text-[#202124] dark:text-[#F3F4F6] border border-[#E6E6E6] dark:border-[#2A2D34]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyState
          title="No tasks in this category"
          description="When you create, merge, split, compress, or convert PDFs, each job will appear here with timestamps and status."
          actionLabel="Create PDF"
          onAction={onCreatePdf}
        />
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => {
            const linkedFile = task.outputFileId
              ? files.find((f) => f.id === task.outputFileId)
              : undefined;
            return (
              <div
                key={task.id}
                className="bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {task.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-[#25A55B] shrink-0" />
                      )}
                      {task.status === 'processing' && (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      {task.status === 'failed' && (
                        <AlertCircle className="w-4 h-4 text-[#E50920] shrink-0" />
                      )}
                      <h3 className="text-sm font-bold text-[#202124] dark:text-[#F3F4F6] truncate">
                        {task.taskName} — {task.outputFilename}
                      </h3>
                    </div>

                    <div className="mt-1.5 text-xs text-[#777777] dark:text-[#9CA3AF] space-y-0.5 tabular-nums">
                      <p className="truncate">
                        Input: {task.inputFiles.join(', ') || 'Selected files'}
                      </p>
                      <p>
                        Started: {formatDateShort(task.startTime)}
                        {task.completionTime
                          ? ` · Completed: ${formatDateShort(task.completionTime)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold capitalize ${
                        task.status === 'completed'
                          ? 'text-[#25A55B]'
                          : task.status === 'processing'
                          ? 'text-amber-600'
                          : 'text-[#E50920]'
                      }`}
                    >
                      {task.status} · {task.progress}%
                    </span>
                  </div>
                </div>

                {/* Progress bar for processing tasks */}
                {task.status === 'processing' && (
                  <div className="space-y-2">
                    <div className="w-full h-2 rounded-full bg-[#F5F5F7] dark:bg-[#24272E] overflow-hidden">
                      <div
                        className="h-full bg-[#E50920] rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onCancelTask(task.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-semibold text-[#E50920] cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Failed task controls */}
                {task.status === 'failed' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6E6E6] dark:border-[#2A2D34]">
                    <p className="text-xs text-[#E50920] truncate max-w-md">
                      {task.errorMessage || 'Task failed during offline processing.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRetryTask(task.toolId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-[#E50920] text-white text-xs font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setErrorModalTask(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] text-xs font-semibold cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>View Error</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="min-w-[36px] min-h-[36px] rounded-xl text-[#E50920] hover:bg-[#E50920]/10 flex items-center justify-center cursor-pointer"
                        aria-label="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed task quick actions */}
                {task.status === 'completed' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E6E6] dark:border-[#2A2D34]">
                    {linkedFile && (
                      <button
                        type="button"
                        onClick={() => onOpenOutputFile(linkedFile)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-xl bg-[#F5F5F7] dark:bg-[#24272E] hover:bg-[#EAEAEF] text-xs font-semibold text-[#202124] dark:text-[#F3F4F6] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#E50920]" />
                        <span>Open Output</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="min-w-[36px] min-h-[36px] rounded-xl text-[#777777] hover:text-[#E50920] flex items-center justify-center cursor-pointer"
                      aria-label="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error Detail Modal */}
      {errorModalTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setErrorModalTask(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A1C20] rounded-2xl border border-[#E6E6E6] dark:border-[#2A2D34] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202124] dark:text-[#F3F4F6]">
                Task Error Details
              </h3>
              <button
                type="button"
                onClick={() => setErrorModalTask(null)}
                className="p-1.5 text-[#777777] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#E50920] bg-[#E50920]/8 p-3.5 rounded-xl font-mono text-xs">
              {errorModalTask.errorMessage || 'Unknown processing error occurred.'}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setErrorModalTask(null)}
                className="px-4 py-2 rounded-xl bg-[#202124] dark:bg-[#F3F4F6] text-white dark:text-[#111215] text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
