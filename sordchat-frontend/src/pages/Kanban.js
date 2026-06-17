import React, { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, GripVertical, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const initialColumns = [
  {
    id: 'backlog',
    title: 'Backlog',
    color: '#2563eb',
    tasks: [
      {
        id: 'task-1',
        title: 'Revisar rotas do backend',
        description: 'Confirmar integrações e rotas ativas para a operação.',
        priority: 'high',
        category: 'Backend',
        dueDate: '2026-06-21',
      },
      {
        id: 'task-2',
        title: 'Mapear fluxo de tickets',
        description: 'Definir campos minimos para atendimento.',
        priority: 'medium',
        category: 'Produto',
        dueDate: '2026-06-24',
      },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    color: '#0f766e',
    tasks: [
      {
        id: 'task-3',
        title: 'Modernizar UI inicial',
        description: 'Limpar layout, estados e navegacao.',
        priority: 'medium',
        category: 'Frontend',
        dueDate: '2026-06-18',
      },
    ],
  },
  {
    id: 'review',
    title: 'Revisao',
    color: '#7c3aed',
    tasks: [
      {
        id: 'task-4',
        title: 'Validar build de producao',
        description: 'Rodar build e abrir app em navegador local.',
        priority: 'high',
        category: 'QA',
        dueDate: '2026-06-19',
      },
    ],
  },
  {
    id: 'done',
    title: 'Concluido',
    color: '#16a34a',
    tasks: [
      {
        id: 'task-5',
        title: 'Instalar dependencias do frontend',
        description: 'Restaurar node_modules para permitir build.',
        priority: 'low',
        category: 'Setup',
        dueDate: '2026-06-17',
      },
    ],
  },
];

const STORAGE_KEY = 'sordchat:tasks-board';

const priorityMeta = {
  high: ['Alta', 'badge--danger'],
  medium: ['Media', 'badge--warning'],
  low: ['Baixa', 'badge--success'],
};

const loadStoredColumns = () => {
  if (typeof window === 'undefined') {
    return initialColumns;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : initialColumns;
  } catch (error) {
    return initialColumns;
  }
};

const findColumnByTask = (columns, taskId) =>
  columns.find((column) => column.tasks.some((task) => task.id === taskId));

const SortableTask = ({ task, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [priorityLabel, priorityClass] = priorityMeta[task.priority] || priorityMeta.medium;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card p-4 ${isDragging ? 'shadow-xl opacity-80' : ''}`}
    >
      <div className="mb-3 flex items-start gap-2">
        <button
          className="mt-0.5 text-slate-400 hover:text-slate-700"
          type="button"
          title="Arrastar"
          aria-label="Arrastar tarefa"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-sm font-extrabold text-slate-950">{task.title}</h4>
          <p className="m-0 mt-1 text-xs leading-5 text-slate-500">{task.description}</p>
        </div>
        <button
          className="text-slate-400 hover:text-red-600"
          type="button"
          onClick={() => onDelete(task.id)}
          title="Remover tarefa"
          aria-label="Remover tarefa"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${priorityClass}`}>{priorityLabel}</span>
        <span className="badge">{task.category}</span>
        {task.dueDate && (
          <span className="badge">
            <CalendarDays size={13} />
            {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </article>
  );
};

const Kanban = () => {
  const { user } = useAuth();
  const [columns, setColumns] = useState(loadStoredColumns);
  const [searchTerm, setSearchTerm] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskCategory, setNewTaskCategory] = useState('Operacao');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [targetColumn, setTargetColumn] = useState('backlog');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalTasks = columns.reduce((total, column) => total + column.tasks.length, 0);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  const visibleColumns = useMemo(() => {
    if (!searchTerm.trim()) {
      return columns;
    }

    const term = searchTerm.toLowerCase();
    return columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(term) ||
          task.description.toLowerCase().includes(term) ||
          task.category.toLowerCase().includes(term)
      ),
    }));
  }, [columns, searchTerm]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) {
      return;
    }

    setColumns((currentColumns) => {
      const sourceColumn = findColumnByTask(currentColumns, active.id);
      const destinationColumn =
        currentColumns.find((column) => column.id === over.id) || findColumnByTask(currentColumns, over.id);

      if (!sourceColumn || !destinationColumn) {
        return currentColumns;
      }

      const sourceIndex = sourceColumn.tasks.findIndex((task) => task.id === active.id);
      const destinationIndex = destinationColumn.tasks.findIndex((task) => task.id === over.id);

      if (sourceColumn.id === destinationColumn.id) {
        return currentColumns.map((column) =>
          column.id === sourceColumn.id
            ? {
                ...column,
                tasks: arrayMove(
                  column.tasks,
                  sourceIndex,
                  destinationIndex >= 0 ? destinationIndex : column.tasks.length - 1
                ),
              }
            : column
        );
      }

      const movingTask = sourceColumn.tasks[sourceIndex];
      return currentColumns.map((column) => {
        if (column.id === sourceColumn.id) {
          return { ...column, tasks: column.tasks.filter((task) => task.id !== active.id) };
        }

        if (column.id === destinationColumn.id) {
          const nextTasks = [...column.tasks];
          nextTasks.splice(destinationIndex >= 0 ? destinationIndex : nextTasks.length, 0, movingTask);
          return { ...column, tasks: nextTasks };
        }

        return column;
      });
    });
  };

  const handleAddTask = (event) => {
    event.preventDefault();

    if (!newTaskTitle.trim()) {
      toast.error('Informe o titulo da tarefa.');
      return;
    }

    const task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      description:
        newTaskDescription.trim() ||
        `Criada por ${user?.full_name || user?.username || 'usuario'} no quadro operacional.`,
      priority: newTaskPriority,
      category: newTaskCategory.trim() || 'Operacao',
      dueDate: newTaskDueDate,
    };

    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === targetColumn ? { ...column, tasks: [task, ...column.tasks] } : column
      )
    );
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setNewTaskCategory('Operacao');
    setNewTaskDueDate('');
    toast.success('Tarefa adicionada.');
  };

  const handleDeleteTask = (taskId) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => task.id !== taskId),
      }))
    );
  };

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="grid gap-5">
          <div>
            <span className="badge">Operacao</span>
            <h2 className="m-0 mt-3 text-2xl font-extrabold text-slate-950">Quadro de tarefas</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">
              Arraste tarefas entre colunas para organizar prioridades, execucao e revisoes do time.
            </p>
          </div>

          <form className="task-form" onSubmit={handleAddTask}>
            <input
              className="input"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Titulo da tarefa"
            />
            <input
              className="input"
              value={newTaskDescription}
              onChange={(event) => setNewTaskDescription(event.target.value)}
              placeholder="Descricao curta"
            />
            <select
              className="select"
              value={newTaskPriority}
              onChange={(event) => setNewTaskPriority(event.target.value)}
              aria-label="Prioridade"
            >
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baixa</option>
            </select>
            <input
              className="input"
              value={newTaskCategory}
              onChange={(event) => setNewTaskCategory(event.target.value)}
              placeholder="Categoria"
            />
            <input
              className="input"
              type="date"
              value={newTaskDueDate}
              onChange={(event) => setNewTaskDueDate(event.target.value)}
              aria-label="Prazo"
            />
            <select className="select" value={targetColumn} onChange={(event) => setTargetColumn(event.target.value)}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
            <button className="button-primary" type="submit">
              <Plus size={17} />
              Adicionar
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="input pl-10"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por titulo, categoria ou descricao"
          />
        </div>
        <span className="badge">{totalTasks} tarefas no quadro</span>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <section className="task-board">
          {visibleColumns.map((column) => (
            <div className="panel flex min-h-[480px] flex-col overflow-hidden" key={column.id}>
              <header className="border-b border-slate-200 p-4" style={{ boxShadow: `inset 0 3px 0 ${column.color}` }}>
                <div className="flex items-center justify-between">
                  <h3 className="m-0 text-sm font-extrabold text-slate-950">{column.title}</h3>
                  <span className="badge">{column.tasks.length}</span>
                </div>
              </header>

              <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                <div className="grid flex-1 content-start gap-3 bg-slate-50 p-3">
                  {column.tasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                      Sem tarefas
                    </div>
                  ) : (
                    column.tasks.map((task) => (
                      <SortableTask key={task.id} task={task} onDelete={handleDeleteTask} />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          ))}
        </section>
      </DndContext>
    </div>
  );
};

export default Kanban;
