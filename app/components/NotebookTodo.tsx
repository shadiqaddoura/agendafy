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

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() {
  return localDateStr(new Date())
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localDateStr(d)
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return localDateStr(d)
}

function pageLabel(dateStr: string): string {
  const today = todayStr()
  const tomorrow = tomorrowStr()
  const yesterday = shiftDate(today, -1)
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function pageSubLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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
            cursor: todo.completed ? 'default' : 'text',
            wordBreak: 'break-word',
            transition: 'color 0.2s',
            textDecorationLine: todo.completed ? 'line-through' : 'none',
            textDecorationColor: 'rgba(77, 184, 106, 0.5)',
            textDecorationThickness: 3,
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
  const [inlineAddFocused, setInlineAddFocused] = useState(false)
  const [currentPage, setCurrentPage] = useState(todayStr())
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

  function navigatePage(delta: number) {
    setCurrentPage(prev => {
      const next = shiftDate(prev, delta)
      setInputDate(next)
      return next
    })
  }

  function goToToday() {
    const today = todayStr()
    setCurrentPage(today)
    setInputDate(today)
  }

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
  const pageTodos = todos.filter(t => (t.date || todayStr()) === currentPage)
  const pageFilteredTodos = (activeTagFilter
    ? pageTodos.filter(t => t.tags.includes(activeTagFilter))
    : pageTodos
  ).slice().sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })
  const completedCount = todos.filter(t => t.completed).length
  const isToday = currentPage === todayStr()

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

        {/* Left panel — stats + legend + tag filter */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            overflowY: 'auto',
            padding: '20px 24px 32px 20px',
            borderRight: '1.5px dashed #c4daf5',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
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
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Page flip navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 32px 10px 28px',
              borderBottom: '1.5px solid #c4daf5',
              flexShrink: 0,
              background: 'rgba(253,248,239,0.95)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <button
              onClick={() => navigatePage(-1)}
              style={{
                background: 'none',
                border: '1.5px solid #c4daf5',
                borderRadius: 8,
                padding: '4px 14px',
                fontSize: 22,
                fontFamily: "'Caveat', cursive",
                color: '#3d5a80',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Prev
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2c3e50', lineHeight: 1.1 }}>
                {pageLabel(currentPage)}
              </div>
              <div style={{ fontSize: 14, color: '#aaa', marginTop: 2 }}>
                {pageSubLabel(currentPage)}
              </div>
              {!isToday && (
                <button
                  onClick={goToToday}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3d5a80',
                    fontSize: 13,
                    fontFamily: "'Caveat', cursive",
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    marginTop: 2,
                    padding: 0,
                  }}
                >
                  Back to Today
                </button>
              )}
            </div>

            <button
              onClick={() => navigatePage(1)}
              style={{
                background: 'none',
                border: '1.5px solid #c4daf5',
                borderRadius: 8,
                padding: '4px 14px',
                fontSize: 22,
                fontFamily: "'Caveat', cursive",
                color: '#3d5a80',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Next →
            </button>
          </div>

          {/* Todo list for this page */}
          <div style={{ padding: '20px 32px 32px 28px', flex: 1 }}>
            {pageFilteredTodos.length === 0 && !inlineAddFocused ? (
              activeTagFilter ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb', fontSize: 22, lineHeight: 2 }}>
                  <div style={{ fontSize: 48 }}>🏷️</div>
                  <div>No tasks tagged <strong>#{activeTagFilter}</strong> on this page</div>
                </div>
              ) : (
                <div
                  style={{ textAlign: 'center', padding: '60px 0 20px', color: '#bbb', fontSize: 22, lineHeight: 2, cursor: 'pointer' }}
                  onClick={() => inputRef.current?.focus()}
                >
                  <div style={{ fontSize: 56 }}>📓</div>
                  <div>{isToday ? 'Nothing planned for today.' : `Nothing planned for ${pageLabel(currentPage)}.`}</div>
                  <div style={{ fontSize: 17 }}>Click the line below to add a task.</div>
                </div>
              )
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pageFilteredTodos.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {pageFilteredTodos.map(todo => (
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
                </SortableContext>

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

            {/* Inline add row — always at bottom of list, looks like a notebook line */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                marginTop: 4,
                borderRadius: 6,
                background: inlineAddFocused ? 'rgba(255,255,255,0.7)' : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              {/* Main line: drag handle space + checkbox circle + priority dot + text input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 4px',
                  borderBottom: '1px solid rgba(196,218,245,0.6)',
                  cursor: 'text',
                }}
                onClick={() => inputRef.current?.focus()}
              >
                {/* Spacer matching drag handle width */}
                <div style={{ width: 18, flexShrink: 0 }} />
                {/* Empty checkbox */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: `2px dashed ${PRIORITY_COLORS[inputPriority]}`,
                    flexShrink: 0,
                    opacity: 0.4,
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onFocus={() => setInlineAddFocused(true)}
                  onBlur={() => { if (!inputText.trim()) { setInlineAddFocused(false); setInputTags([]); setInputTagText('') } }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { addTodo(); setInlineAddFocused(false) }
                    if (e.key === 'Escape') { setInputText(''); setInputTags([]); setInputTagText(''); setInlineAddFocused(false) }
                  }}
                  placeholder="＋  Write a new task..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 22,
                    fontFamily: "'Caveat', cursive",
                    color: inlineAddFocused ? '#2c3e50' : '#aaa',
                  }}
                />
              </div>

              {/* Metadata row — only shown when focused */}
              {inlineAddFocused && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 50px',
                    flexWrap: 'wrap',
                    borderBottom: '1px solid rgba(196,218,245,0.6)',
                  }}
                >
                  {/* Tag chips */}
                  {inputTags.map(tag => {
                    const { bg, text } = tagColor(tag)
                    return (
                      <span key={tag} style={{ background: bg, color: text, borderRadius: 12, padding: '2px 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                        #{tag}
                        <button onMouseDown={e => { e.preventDefault(); removeInputTag(tag) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: text, fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                      </span>
                    )
                  })}

                  {/* Tag input + dropdown */}
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={inputTagText}
                      onChange={e => { setInputTagText(e.target.value); setTagDropdownOpen(true) }}
                      onFocus={() => setTagDropdownOpen(true)}
                      onBlur={() => setTimeout(() => { commitTag(inputTagText); setTagDropdownOpen(false) }, 150)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); commitTag(inputTagText); setTagDropdownOpen(false) }
                        else if (e.key === 'Escape') setTagDropdownOpen(false)
                        else if (e.key === 'Backspace' && !inputTagText && inputTags.length > 0) setInputTags(prev => prev.slice(0, -1))
                      }}
                      placeholder="# tag..."
                      style={{ border: 'none', borderBottom: '1px dashed #c4daf5', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: "'Caveat', cursive", color: '#888', width: 70 }}
                    />
                    {tagDropdownOpen && (() => {
                      const query = inputTagText.trim().toLowerCase()
                      const suggestions = allTags.filter(t => !inputTags.includes(t) && (query === '' || t.includes(query)))
                      if (suggestions.length === 0) return null
                      return (
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1.5px solid #c4daf5', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 20, marginTop: 4, minWidth: 160, overflow: 'hidden' }}>
                          <div style={{ padding: '4px 10px', fontSize: 11, color: '#bbb', letterSpacing: 2, textTransform: 'uppercase', borderBottom: '1px solid #f0f0f0' }}>Existing tags</div>
                          {suggestions.map(tag => {
                            const { bg, text } = tagColor(tag)
                            return (
                              <div key={tag} onMouseDown={e => { e.preventDefault(); setInputTags(prev => [...new Set([...prev, tag])]); setInputTagText(''); setTagDropdownOpen(false); tagInputRef.current?.focus() }} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 16, fontFamily: "'Caveat', cursive", display: 'flex', alignItems: 'center', gap: 8, color: '#444' }} onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ background: bg, color: text, borderRadius: 10, padding: '1px 8px', fontSize: 14 }}>#{tag}</span>
                                <span style={{ color: '#bbb', fontSize: 13 }}>{todos.filter(t => t.tags.includes(tag)).length} task{todos.filter(t => t.tags.includes(tag)).length !== 1 ? 's' : ''}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Date */}
                  <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} style={{ border: 'none', borderBottom: '1px dashed #c4daf5', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: "'Caveat', cursive", color: '#555', padding: '2px 4px', cursor: 'pointer' }} />

                  {/* Priority dots */}
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (
                      <button key={p} onMouseDown={e => { e.preventDefault(); setInputPriority(p) }} title={PRIORITY_LABELS[p]} style={{ width: 16, height: 16, borderRadius: '50%', border: inputPriority === p ? '2.5px solid #333' : '2px solid transparent', background: PRIORITY_COLORS[p], cursor: 'pointer', transition: 'transform 0.15s', transform: inputPriority === p ? 'scale(1.2)' : 'scale(1)', padding: 0 }} />
                    ))}
                  </div>

                  {/* Add button */}
                  <button
                    onMouseDown={e => { e.preventDefault(); addTodo(); setInlineAddFocused(false) }}
                    disabled={!inputText.trim()}
                    style={{ marginLeft: 'auto', background: inputText.trim() ? '#3d5a80' : '#ccc', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 18px', fontSize: 17, fontFamily: "'Caveat', cursive", cursor: inputText.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s', flexShrink: 0 }}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
