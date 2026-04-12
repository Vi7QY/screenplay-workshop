// IndexedDB 存储层：多剧本管理
import { createScreenplay, createEpisode, renumberAll } from './model.js'

const DB_NAME = 'screenplay_workshop'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store)
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ========== 项目 CRUD ==========

// 获取所有项目列表（不含完整data，只有元信息）
export async function listProjects() {
  const db = await openDB()
  const all = await reqToPromise(tx(db, 'projects').getAll())
  db.close()
  return all.map(p => ({
    id: p.id,
    name: p.name,
    ipType: p.ipType || 'original',
    ipName: p.ipName || '',
    totalEpisodes: p.totalEpisodes || 0,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    episodeCount: p.data?.episodes?.length || 0,
    sceneCount: p.data?.episodes?.reduce((s, e) => s + e.scenes.length, 0) || 0,
  })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

// 获取单个项目完整数据
export async function getProject(id) {
  const db = await openDB()
  const p = await reqToPromise(tx(db, 'projects').get(id))
  db.close()
  return p || null
}

// 保存项目（新建或更新）
export async function saveProject(project) {
  const db = await openDB()
  const store = tx(db, 'projects', 'readwrite')
  project.updatedAt = new Date().toISOString()
  if (!project.createdAt) project.createdAt = project.updatedAt
  await reqToPromise(store.put(project))
  db.close()
}

// 删除项目
export async function deleteProject(id) {
  const db = await openDB()
  await reqToPromise(tx(db, 'projects', 'readwrite').delete(id))
  db.close()
}

// ========== 活跃项目 ==========

export async function getActiveProjectId() {
  const db = await openDB()
  const meta = await reqToPromise(tx(db, 'meta').get('activeProject'))
  db.close()
  return meta?.value || null
}

export async function setActiveProjectId(id) {
  const db = await openDB()
  await reqToPromise(tx(db, 'meta', 'readwrite').put({ key: 'activeProject', value: id }))
  db.close()
}

// ========== 新建项目 ==========

export function createProject(name = '未命名剧本') {
  const sp = createScreenplay()
  sp.title = name
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name,
    ipType: 'original',
    ipName: '',
    totalEpisodes: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: sp,
  }
}

// ========== 集数同步 ==========

// 根据totalEpisodes同步剧本的集数
export function syncEpisodeCount(project) {
  const target = project.totalEpisodes || 1
  const sp = project.data
  const current = sp.episodes.length

  if (target > current) {
    for (let i = current + 1; i <= target; i++) {
      sp.episodes.push(createEpisode(i, 2))
    }
  } else if (target < current) {
    sp.episodes.splice(target)
  }
  renumberAll(sp)
}

// ========== 导入/导出存档 ==========

// 导出单个项目为JSON
export function exportProjectJSON(project) {
  const data = JSON.stringify(project, null, 2)
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name || '剧本'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 导出全部项目为JSON
export async function exportAllProjectsJSON() {
  const db = await openDB()
  const all = await reqToPromise(tx(db, 'projects').getAll())
  db.close()
  const data = JSON.stringify({ version: 1, projects: all }, null, 2)
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `剧本工坊_全部存档_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 导入存档JSON
export async function importProjectJSON(file) {
  const text = await file.text()
  const parsed = JSON.parse(text)

  // 批量导入（全部存档）
  if (parsed.version && parsed.projects && Array.isArray(parsed.projects)) {
    for (const p of parsed.projects) {
      p.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      p.updatedAt = new Date().toISOString()
      await saveProject(p)
    }
    return { count: parsed.projects.length, type: 'batch' }
  }

  // 单个导入
  if (parsed.data && parsed.name) {
    parsed.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    parsed.updatedAt = new Date().toISOString()
    await saveProject(parsed)
    return { count: 1, type: 'single', project: parsed }
  }

  throw new Error('无法识别的存档格式')
}

// ========== 迁移旧数据 ==========

// 将localStorage中的旧数据迁移到IndexedDB
export async function migrateFromLocalStorage() {
  try {
    const old = localStorage.getItem('screenplay_v2')
    if (!old) return null
    const sp = JSON.parse(old)
    const project = createProject(sp.title || '迁移的剧本')
    project.data = sp
    project.totalEpisodes = sp.episodes?.length || 1
    await saveProject(project)
    await setActiveProjectId(project.id)
    // 不删除旧数据，以防万一
    return project
  } catch {
    return null
  }
}
