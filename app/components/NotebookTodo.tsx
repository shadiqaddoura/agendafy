'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Priority = 'low' | 'medium' | 'high'

type Todo = {
  id: string
  text: string
  completed: boolean
  date: string // YYYY-MM-DD or ''
  priority: Priority
  tags: string[]
  createdAt: number
}

// Deterministic pastel color from tag string
function tagColor(tag: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return { bg: `hsl(${hue},55%,88%)`, text: `hsl(${hue},50%,32%)` }
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#6bcb77',
  medium: '#ffd166',
  high: '#ef476f',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High!',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function formatSectionDate(dateStr: string): string {
  if (!dateStr) return 'Someday'
  const today = todayStr()
  const tomorrow = tomorrowStr()
  if (dateStr === today) return '📅 Today'
  if (dateStr === tomorrow) return '🌅 Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function groupByDate(todos: Todo[]): [string, Todo[]][] {
  const map = new Map<string, Todo[]>()
  for (const todo of todos) {
    const key = todo.date || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(todo)
  }
  // Sort sections: today first, then ascending dates, then empty (Someday)
  const today = todayStr()
  const entries = [...map.entries()].sort(([a], [b]) => {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    return a.localeCompare(b)
  })
  return entries
}

type SortableTodoItemProps = {
  todo: Todo
  editingId: string | null
  editText: string
  activeTagFilter: string | null
  isDragOverlay?: boolean
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (todo: Todo) => void
  onSaveEdit: (id: string) => void
  onEditTextChange: (text: string) => void
  onCancelEdit: () => void
  onTagFilterToggle: (tag: string) => void
}

function SortableTodoItem({
  todo,
  editingId,
  editText,
  activeTagFilter,
  isDragOverlay = false,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onEditTextChange,
  onCancelEdit,
  onTagFilterToggle,
}: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 34,
        padding: '3px 6px',
        borderRadius: 6,
        background: isDragOverlay ? 'rgba(61,90,128,0.08)' : 'transparent',
        boxShadow: isDragOverlay ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
        cursor: 'default',
      }}
      onMouseEnter={e => { if (!isDragOverlay) e.currentTarget.style.background = 'rgba(61,90,128,0.06)' }}
      onMouseLeave={e => { if (!isDragOverlay) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          color: '#ccc',
          fontSize: 16,
          flexShrink: 0,
          lineHeight: 1,
          padding: '0 2px',
          userSelect: 'none',
          touchAction: 'none',
        }}
        title="Drag to reorder"
      >
        ⠿
      </div>

      {/* Priority dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: PRIORITY_COLORS[todo.priority],
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Checkbox */}
      <div
        onClick={() => onToggle(todo.id)}
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          border: todo.completed ? '2px solid #aaa' : '2px solid #3d5a80',
          background: todo.completed ? '#aaa' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.2s',
          fontSize: 14,
          color: '#fff',
        }}
      >
        {todo.completed ? '✓' : ''}
      </div>

      {/* Text / Edit */}
      {editingId === todo.id ? (
        <input
          autoFocus
          value={editText}
          onChange={e => onEditTextChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSaveEdit(todo.id)
            if (e.key === 'Escape') onCancelEdit()
          }}
          onBlur={() => onSaveEdit(todo.id)}
          style={{
            flex: 1,
            border: 'none',
            borderBottom: '2px solid #3d5a80',
            outline: 'none',
            background: 'transparent',
            fontSize: 22,
            fontFamily: "'Caveat', cursive",
            color: '#2c3e50',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => !todo.completed && onStartEdit(todo)}
          style={{
            flex: 1,
            fontSize: 22,
            color: todo.completed ? '#bbb' : '#2c3e50',
            textDecoration: todo.completed ? 'line-through' : 'none',
            cursor: todo.completed ? 'default' : 'text',
            wordBreak: 'break-word',
            transition: 'color 0.2s',
          }}
        >
          {todo.text}
        </span>
      )}

      {/* Tags */}
      {todo.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
          {todo.tags.map(tag => {
            const { bg, text } = tagColor(tag)
            return (
              <span
                key={tag}
                onClick={() => onTagFilterToggle(tag)}
                title={`Filter by #${tag}`}
                style={{
                  background: bg,
                  color: text,
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: todo.completed ? 0.5 : 1,
                  border: activeTagFilter === tag ? `1.5px solid ${text}` : '1.5px solid transparent',
                  transition: 'border 0.15s',
                }}
              >
                #{tag}
              </span>
            )
          })}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(todo.id)}
        title="Delete"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#ccc',
          fontSize: 20,
          flexShrink: 0,
          lineHeight: 1,
          padding: '0 4px',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef476f')}
        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
      >
        ×
      </button>
    </div>
  )
}

export default function NotebookTodo() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputText, setInputText] = useState('')
  const [inputDate, setInputDate] = useState(todayStr())
  const [inputPriority, setInputPriority] = useState<Priority>('medium')
  const [inputTags, setInputTags] = useState<string[]>([])
  const [inputTagText, setInputTagText] = useState('')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTodos(prev => {
      const oldIdx = prev.findIndex(t => t.id === active.id)
      const newIdx = prev.findIndex(t => t.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('agendafy-todos')
      if (saved) setTodos(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem('agendafy-todos', JSON.stringify(todos))
  }, [todos])

  function addTodo() {
    const text = inputText.trim()
    if (!text) return
    // commit any pending tag text
    const tags = inputTagText.trim()
      ? [...new Set([...inputTags, inputTagText.trim().toLowerCase()])]
      : inputTags
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      date: inputDate,
      priority: inputPriority,
      tags,
      createdAt: Date.now(),
    }
    setTodos(prev => [...prev, todo])
    setInputText('')
    setInputTags([])
    setInputTagText('')
    inputRef.current?.focus()
  }

  function commitTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/,/g, '')
    if (!tag) return
    setInputTags(prev => [...new Set([...prev, tag])])
    setInputTagText('')
  }

  function removeInputTag(tag: string) {
    setInputTags(prev => prev.filter(t => t !== tag))
  }

  function toggleTodo(id: string) {
    setTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  function saveEdit(id: string) {
    const text = editText.trim()
    if (!text) return
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, text } : t)))
    setEditingId(null)
  }

  function clearCompleted() {
    setTodos(prev => prev.filter(t => !t.completed))
  }

  const allTags = [...new Set(todos.flatMap(t => t.tags))].sort()
  const filteredTodos = activeTagFilter
    ? todos.filter(t => t.tags.includes(activeTagFilter))
    : todos
  const groups = groupByDate(filteredTodos)
  const completedCount = todos.filter(t => t.completed).length

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Caveat', cursive",
      }}
    >
      {/* Spiral rings strip */}
      <div
        style={{
          background: '#293241',
          display: 'flex',
          justifyContent: 'space-around',
          paddingLeft: 52,
          paddingRight: 0,
          flexShrink: 0,
          zIndex: 3,
          position: 'relative',
        }}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 18,
              border: '3px solid #555',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #888 0%, #444 100%)',
              position: 'relative',
              top: 9,
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Cover / Header */}
      <div
        style={{
          background: 'linear-gradient(180deg, #3d5a80 0%, #293241 100%)',
          padding: '20px 32px 16px 72px',
          color: '#e0e0e0',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -40,
            top: -40,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        <div>
          <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.6, marginBottom: 2 }}>
            Agenda
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 'bold', margin: 0, lineHeight: 1.1, letterSpacing: 1 }}>
            Agendafy
          </h1>
        </div>
        <div style={{ opacity: 0.5, fontSize: 15 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 15, opacity: 0.6 }}>
            {todos.length - completedCount} pending · {completedCount} done
          </div>
          {completedCount > 0 && (
            <button
              onClick={clearCompleted}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 20,
                padding: '4px 16px',
                fontSize: 15,
                fontFamily: "'Caveat', cursive",
                color: '#e0e0e0',
                cursor: 'pointer',
              }}
            >
              Clear {completedCount} done
            </button>
          )}
        </div>
      </div>

      {/* Page body — fills remaining height */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          background: '#fdf8ef',
          backgroundImage: `
            repeating-linear-gradient(
              transparent,
              transparent 31px,
              #c4daf5 31px,
              #c4daf5 32px
            )
          `,
          backgroundPositionY: 8,
        }}
      >
        {/* Binding column */}
        <div
          style={{
            width: 52,
            flexShrink: 0,
            background: 'linear-gradient(90deg, #e8ddd0 0%, #f0ebe0 100%)',
            borderRight: '2px solid #f4a0a0',
            zIndex: 1,
          }}
        />

        {/* Left panel — add entry + stats + legend */}
        <div
          style={{
            width: 340,
            flexShrink: 0,
            overflowY: 'auto',
            padding: '20px 24px 32px 20px',
            borderRight: '1.5px dashed #c4daf5',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* New entry form */}
          <div>
            <div style={{ fontSize: 12, color: '#aaa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
              New entry
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.65)',
                border: '1.5px dashed #aac4e0',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTodo()}
                placeholder="Write a task..."
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 22,
                  fontFamily: "'Caveat', cursive",
                  color: '#2c3e50',
                  marginBottom: 10,
                }}
              />
              {/* Tag chips input */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 5,
                    alignItems: 'center',
                    minHeight: 28,
                  }}
                >
                  {inputTags.map(tag => {
                    const { bg, text } = tagColor(tag)
                    return (
                      <span
                        key={tag}
                        style={{
                          background: bg,
                          color: text,
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        #{tag}
                        <button
                          onMouseDown={e => { e.preventDefault(); removeInputTag(tag) }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: text,
                            fontSize: 14,
                            lineHeight: 1,
                            padding: 0,
                            opacity: 0.7,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={inputTagText}
                    onChange={e => {
                      setInputTagText(e.target.value)
                      setTagDropdownOpen(true)
                    }}
                    onFocus={() => setTagDropdownOpen(true)}
                    onBlur={() => {
                      // delay so onMouseDown on suggestions fires first
                      setTimeout(() => {
                        commitTag(inputTagText)
                        setTagDropdownOpen(false)
                      }, 150)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                        e.preventDefault()
                        commitTag(inputTagText)
                        setTagDropdownOpen(false)
                      } else if (e.key === 'Escape') {
                        setTagDropdownOpen(false)
                      } else if (e.key === 'Backspace' && !inputTagText && inputTags.length > 0) {
                        setInputTags(prev => prev.slice(0, -1))
                      }
                    }}
                    placeholder={inputTags.length === 0 ? '# add tags...' : '# more...'}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 15,
                      fontFamily: "'Caveat', cursive",
                      color: '#888',
                      minWidth: 80,
                      flex: 1,
                    }}
                  />
                </div>

                {/* Existing tag suggestions dropdown */}
                {tagDropdownOpen && (() => {
                  const query = inputTagText.trim().toLowerCase()
                  const suggestions = allTags.filter(
                    t => !inputTags.includes(t) && (query === '' || t.includes(query))
                  )
                  if (suggestions.length === 0) return null
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1.5px solid #c4daf5',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        zIndex: 10,
                        marginTop: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ padding: '4px 10px', fontSize: 11, color: '#bbb', letterSpacing: 2, textTransform: 'uppercase', borderBottom: '1px solid #f0f0f0' }}>
                        Existing tags
                      </div>
                      {suggestions.map(tag => {
                        const { bg, text } = tagColor(tag)
                        return (
                          <div
                            key={tag}
                            onMouseDown={e => {
                              e.preventDefault()
                              setInputTags(prev => [...new Set([...prev, tag])])
                              setInputTagText('')
                              setTagDropdownOpen(false)
                              tagInputRef.current?.focus()
                            }}
                            style={{
                              padding: '7px 12px',
                              cursor: 'pointer',
                              fontSize: 16,
                              fontFamily: "'Caveat', cursive",
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              color: '#444',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ background: bg, color: text, borderRadius: 10, padding: '1px 8px', fontSize: 14 }}>
                              #{tag}
                            </span>
                            <span style={{ color: '#bbb', fontSize: 13 }}>
                              {todos.filter(t => t.tags.includes(tag)).length} task{todos.filter(t => t.tags.includes(tag)).length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={inputDate}
                  onChange={e => setInputDate(e.target.value)}
                  style={{
                    border: 'none',
                    borderBottom: '1.5px solid #aac4e0',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 15,
                    fontFamily: "'Caveat', cursive",
                    color: '#555',
                    padding: '2px 4px',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['low', 'medium', 'high'] as Priority[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setInputPriority(p)}
                      title={PRIORITY_LABELS[p]}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: inputPriority === p ? '3px solid #333' : '2px solid transparent',
                        background: PRIORITY_COLORS[p],
                        cursor: 'pointer',
                        transition: 'transform 0.15s',
                        transform: inputPriority === p ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={addTodo}
                  disabled={!inputText.trim()}
                  style={{
                    marginLeft: 'auto',
                    background: inputText.trim() ? '#3d5a80' : '#ccc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 20,
                    padding: '6px 20px',
                    fontSize: 18,
                    fontFamily: "'Caveat', cursive",
                    cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              background: 'rgba(61,90,128,0.06)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, color: '#aaa', letterSpacing: 2, textTransform: 'uppercase' }}>Progress</div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: '#e0e0e0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: todos.length > 0 ? `${Math.round((completedCount / todos.length) * 100)}%` : '0%',
                  background: 'linear-gradient(90deg, #3d5a80, #6bcb77)',
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 15, color: '#888', display: 'flex', justifyContent: 'space-between' }}>
              <span>{todos.length - completedCount} remaining</span>
              <span style={{ color: '#6bcb77' }}>
                {todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#aaa', letterSpacing: 2, textTransform: 'uppercase' }}>Priority</div>
            {(['high', 'medium', 'low'] as Priority[]).map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#666' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: PRIORITY_COLORS[p], flexShrink: 0 }} />
                {PRIORITY_LABELS[p]}
              </div>
            ))}
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#aaa', letterSpacing: 2, textTransform: 'uppercase' }}>Filter by tag</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allTags.map(tag => {
                  const { bg, text } = tagColor(tag)
                  const active = activeTagFilter === tag
                  return (
                    <button
                      key={tag}
                      onClick={() => setActiveTagFilter(active ? null : tag)}
                      style={{
                        background: active ? text : bg,
                        color: active ? '#fff' : text,
                        border: `1.5px solid ${text}`,
                        borderRadius: 12,
                        padding: '3px 10px',
                        fontSize: 15,
                        fontFamily: "'Caveat', cursive",
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
              {activeTagFilter && (
                <button
                  onClick={() => setActiveTagFilter(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#aaa',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: "'Caveat', cursive",
                    textDecoration: 'underline',
                    textAlign: 'left',
                    padding: 0,
                  }}
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          <div style={{ fontSize: 13, color: '#ccc', marginTop: 'auto' }}>
            Double-click a task to edit
          </div>
        </div>

        {/* Right panel — scrollable todo list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 32px 32px 28px',
          }}
        >
          {todos.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 0',
                color: '#bbb',
                fontSize: 22,
                lineHeight: 2,
              }}
            >
              <div style={{ fontSize: 56 }}>📓</div>
              <div>Your notebook is empty.</div>
              <div style={{ fontSize: 17 }}>Add your first task on the left!</div>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 0',
                color: '#bbb',
                fontSize: 22,
                lineHeight: 2,
              }}
            >
              <div style={{ fontSize: 48 }}>🏷️</div>
              <div>No tasks tagged <strong>#{activeTagFilter}</strong></div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredTodos.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {groups.map(([dateKey, groupTodos]) => (
                  <div key={dateKey} style={{ marginBottom: 28 }}>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 'bold',
                        color: '#3d5a80',
                        borderBottom: '2px solid #3d5a80',
                        paddingBottom: 4,
                        marginBottom: 8,
                        letterSpacing: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{formatSectionDate(dateKey)}</span>
                      <span style={{ fontSize: 14, fontWeight: 'normal', color: '#aaa' }}>
                        {groupTodos.filter(t => !t.completed).length} left
                      </span>
                    </div>

                    {groupTodos.map(todo => (
                      <SortableTodoItem
                        key={todo.id}
                        todo={todo}
                        editingId={editingId}
                        editText={editText}
                        activeTagFilter={activeTagFilter}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        onStartEdit={startEdit}
                        onSaveEdit={saveEdit}
                        onEditTextChange={setEditText}
                        onCancelEdit={() => setEditingId(null)}
                        onTagFilterToggle={tag => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                      />
                    ))}
                  </div>
                ))}
              </SortableContext>

              {/* Floating drag overlay */}
              <DragOverlay>
                {activeDragId ? (() => {
                  const dragged = todos.find(t => t.id === activeDragId)
                  if (!dragged) return null
                  return (
                    <SortableTodoItem
                      todo={dragged}
                      editingId={null}
                      editText=""
                      activeTagFilter={activeTagFilter}
                      isDragOverlay
                      onToggle={() => {}}
                      onDelete={() => {}}
                      onStartEdit={() => {}}
                      onSaveEdit={() => {}}
                      onEditTextChange={() => {}}
                      onCancelEdit={() => {}}
                      onTagFilterToggle={() => {}}
                    />
                  )
                })() : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )
}
