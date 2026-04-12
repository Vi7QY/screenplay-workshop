// 撤销/重做历史管理
import { reactive } from 'vue'

const MAX_HISTORY = 50

export function createUndoManager() {
  const state = reactive({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  })

  let _lastSnapshot = ''
  let _debounceTimer = null

  function snapshot(sp) {
    return JSON.stringify(sp)
  }

  // 记录当前状态（防抖，避免每次击键都记录）
  function record(sp) {
    clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      const snap = snapshot(sp)
      if (snap === _lastSnapshot) return
      state.undoStack.push(_lastSnapshot)
      if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift()
      state.redoStack = []
      _lastSnapshot = snap
      state.canUndo = state.undoStack.length > 0
      state.canRedo = false
    }, 500)
  }

  // 初始化（记录初始状态）
  function init(sp) {
    _lastSnapshot = snapshot(sp)
    state.undoStack = []
    state.redoStack = []
    state.canUndo = false
    state.canRedo = false
  }

  // 撤销
  function undo(sp) {
    if (state.undoStack.length === 0) return null
    const current = snapshot(sp)
    state.redoStack.push(current)
    const prev = state.undoStack.pop()
    _lastSnapshot = prev
    state.canUndo = state.undoStack.length > 0
    state.canRedo = true
    return JSON.parse(prev)
  }

  // 重做
  function redo(sp) {
    if (state.redoStack.length === 0) return null
    const current = snapshot(sp)
    state.undoStack.push(current)
    const next = state.redoStack.pop()
    _lastSnapshot = next
    state.canUndo = true
    state.canRedo = state.redoStack.length > 0
    return JSON.parse(next)
  }

  return { state, record, init, undo, redo }
}
