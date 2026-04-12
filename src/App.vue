<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar-left">
        <span class="logo">✎ 剧本工坊</span>
        <div class="tabs">
          <button :class="{active:tab==='projects'}" @click="tab='projects'">我的剧本</button>
          <button :class="{active:tab==='meta'}" @click="tab='meta'" :disabled="!activeProject">剧本信息</button>
          <button :class="{active:tab==='editor'}" @click="tab='editor'" :disabled="!activeProject">剧本正文</button>
        </div>
      </div>
      <div class="topbar-right">
        <template v-if="tab==='editor' && activeProject">
          <span class="current-title">{{ sp.title }}</span>
          <button class="btn-tool" @click="doUndo" :disabled="!undoMgr.state.canUndo" title="Ctrl+Z">↩ 撤销</button>
          <button class="btn-tool" @click="doRedo" :disabled="!undoMgr.state.canRedo" title="Ctrl+Y">↪ 重做</button>
          <button class="btn-tool" @click="showSearch=!showSearch" title="Ctrl+F">🔍 搜索</button>
          <button class="btn-tool" @click="showOutline=!showOutline" :class="{active:showOutline}">📋 大纲</button>
          <button class="btn-tool" @click="toggleZen" :class="{active:zenMode}">{{ zenMode ? '⊡ 退出沉浸' : '⊞ 沉浸写作' }}</button>
          <button class="btn-tool" @click="showVersions=!showVersions" :class="{active:showVersions}">🕐 版本</button>
          <button class="btn-sm" @click="addEpisode">+ 添加集</button>
        </template>
        <template v-if="tab==='meta' && activeProject">
          <span class="current-title">{{ sp.title }}</span>
        </template>
        <button class="btn-theme" @click="toggleTheme" :title="isDark?'切换亮色':'切换暗色'">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
        <template v-if="tab==='editor' && activeProject">
          <button class="btn-sm" @click="doSave">保存</button>
          <button class="btn-sm" @click="triggerImport" :disabled="importing">{{ importing ? '导入中...' : '📥 导入剧本' }}</button>
          <div class="dropdown-wrap">
            <button class="btn-primary" @click="showExport=!showExport">导出 ▾</button>
            <div class="dropdown" v-if="showExport">
              <button @click="doExportTxt();showExport=false">纯文本 TXT</button>
              <button @click="doExportDocx();showExport=false">Word DOCX</button>
              <button @click="doExportPdf();showExport=false">PDF（打印）</button>
            </div>
          </div>
        </template>
      </div>
    </header>

    <!-- 我的剧本 -->
    <div class="main" v-if="tab==='projects'">
      <ProjectsPanel
        :projects="projectList"
        :activeId="activeProjectId"
        :currentProject="activeProject"
        @select="selectProject"
        @create="createNewProject"
        @delete="deleteProjectById"
        @enter="tab='meta'"
        @import-archive="triggerImportArchive"
        @import-file="triggerImport"
        @export-all="doExportAll"
        @export-single="doExportSingle"
      />
    </div>

    <!-- 剧本信息 -->
    <div class="main" v-else-if="tab==='meta' && activeProject">
      <MetaPanel
        :sp="sp"
        :project="activeProject"
        @update="onUpdate"
        @update-project="onUpdateProject"
        @ep-count-change="onEpCountChange"
        @save="doSave"
      />
    </div>

    <!-- 剧本正文 -->
    <div class="main" v-else-if="tab==='editor' && activeProject" :class="{zen: zenMode}">
      <aside class="sidebar" v-if="!zenMode">
        <!-- 大纲模式 -->
        <div v-if="showOutline" class="outline-panel">
          <div class="outline-title">📋 大纲 · 分集统计</div>
          <div v-for="(ep, ei) in sp.episodes" :key="ep.id" class="outline-ep">
            <div class="outline-ep-row" @click="outlineCollapsed[ei]=!outlineCollapsed[ei]">
              <span class="outline-arrow">{{ outlineCollapsed[ei] ? '▸' : '▾' }}</span>
              <span class="outline-ep-name">{{ ep.title }}</span>
              <span class="outline-ep-stats">{{ epCharCount(ei) }}字 · {{ ep.scenes.length }}场</span>
            </div>
            <div v-if="!outlineCollapsed[ei]" class="outline-scenes">
              <div v-for="sc in ep.scenes" :key="sc.id" class="outline-sc" @click="jumpTo(sc.id)">
                {{ sc.label }} {{ sc.location || '' }}
              </div>
            </div>
          </div>
        </div>
        <!-- 场景导航 -->
        <NavPanel v-else :episodes="sp.episodes" :activeSceneId="activeSceneId" @select="jumpTo" @add-scene="addScene" @remove-ep="removeEpisode" />
      </aside>
      <div class="editor-pane">
        <SearchBar :visible="showSearch" :sp="sp" @close="showSearch=false" @navigate="jumpTo" @update="onUpdate" />
        <EditorPanel
          :sp="sp"
          :characters="sp.characters"
          @update="onUpdate"
          @set-active="activeSceneId=$event"
        />
      </div>

      <!-- 版本历史面板 -->
      <div class="version-panel" v-if="showVersions">
        <div class="version-title">🕐 版本历史</div>
        <div v-if="versionList.length===0" class="version-empty">暂无历史版本</div>
        <div v-for="(v, vi) in versionList" :key="vi" class="version-item" @click="restoreVersion(vi)">
          <span class="version-time">{{ v.time }}</span>
          <span class="version-info">{{ v.epCount }}集 · {{ v.charCount }}字</span>
        </div>
        <button class="version-save-btn" @click="saveVersion">💾 保存当前版本</button>
      </div>
    </div>

    <!-- 无项目提示 -->
    <div class="main empty-main" v-else>
      <p>请先在「我的剧本」中选择或新建一个剧本</p>
    </div>

    <!-- 移动端提示 -->
    <div id="mobile-tip">
      <div class="icon">✎</div>
      <h2>剧本工坊</h2>
      <p>本工具为桌面端设计，包含多栏编辑器、快捷键和结构化写作功能，建议使用电脑浏览器打开以获得最佳体验。</p>
      <button class="m-btn" onclick="document.getElementById('mobile-tip').style.display='none'">我知道了，继续使用</button>
    </div>

    <footer class="statusbar">
      <span>▲ = 动作描写 · 输入 <kbd>dz</kbd> 插入动作 · <kbd>db</kbd> 对白 · <kbd>jt</kbd> 镜头指示 · <kbd>os</kbd> 内心独白 · <kbd>rw</kbd> 人物行 · <kbd>Enter</kbd> 新行</span>
      <span class="statusbar-right">
        <span v-if="tab==='editor' && activeProject" class="stats">{{ sp.episodes.length }}集 · {{ totalScenes }}场 · {{ totalChars }}字</span>
        <span v-if="lastSaved" class="saved">已保存 {{ fmtTime(lastSaved) }}</span>
      </span>
    </footer>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { createScreenplay, createEpisode, createScene, exportToText, renumberAll } from './model.js'
import { listProjects, getProject, saveProject, deleteProject, getActiveProjectId, setActiveProjectId, createProject, syncEpisodeCount, exportProjectJSON, exportAllProjectsJSON, importProjectJSON, migrateFromLocalStorage } from './store.js'
import { readFile, parseScreenplay } from './import-screenplay.js'
import { exportDocx } from './export-docx.js'
import MetaPanel from './components/MetaPanel.vue'
import NavPanel from './components/NavPanel.vue'
import EditorPanel from './components/EditorPanel.vue'
import ProjectsPanel from './components/ProjectsPanel.vue'
import SearchBar from './components/SearchBar.vue'
import { createUndoManager } from './undo.js'

export default {
  components: { MetaPanel, NavPanel, EditorPanel, ProjectsPanel, SearchBar },
  setup() {
    const tab = ref('projects')
    const sp = reactive(createScreenplay())
    const activeSceneId = ref('')
    const showExport = ref(false)
    const lastSaved = ref(null)
    const isDark = ref(true)
    const importing = ref(false)

    const projectList = ref([])
    const activeProjectId = ref('')
    const activeProject = ref(null)

    // 新功能状态
    const showSearch = ref(false)
    const zenMode = ref(false)
    const showOutline = ref(false)
    const showVersions = ref(false)
    const outlineCollapsed = reactive({})
    const versionList = ref([])
    const undoMgr = createUndoManager()

    // 分集字数统计
    function epCharCount(ei) {
      let n = 0
      sp.episodes[ei]?.scenes.forEach(sc => sc.blocks.forEach(b => { n += (b.content || '').length }))
      return n
    }

    // 全屏沉浸模式
    function toggleZen() { zenMode.value = !zenMode.value }

    // 撤销/重做
    function doUndo() {
      const prev = undoMgr.undo(sp)
      if (prev) assignDeep(sp, prev)
    }
    function doRedo() {
      const next = undoMgr.redo(sp)
      if (next) assignDeep(sp, next)
    }

    // 版本历史
    function saveVersion() {
      const snap = {
        time: new Date().toLocaleString('zh-CN'),
        epCount: sp.episodes.length,
        charCount: totalChars.value,
        data: JSON.parse(JSON.stringify(sp)),
      }
      versionList.value.unshift(snap)
      if (versionList.value.length > 10) versionList.value.pop()
      alert('版本已保存')
    }
    function restoreVersion(vi) {
      if (!confirm('确定恢复到此版本？当前未保存的修改将丢失。')) return
      const v = versionList.value[vi]
      assignDeep(sp, v.data)
      debouncedSave()
    }

    // 键盘快捷键
    function onKeydown(e) {
      // Ctrl+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (tab.value === 'editor') { e.preventDefault(); doUndo() }
      }
      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (tab.value === 'editor') { e.preventDefault(); doRedo() }
      }
      // Ctrl+F 搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (tab.value === 'editor') { e.preventDefault(); showSearch.value = true }
      }
      // Escape 退出zen模式
      if (e.key === 'Escape') {
        if (zenMode.value) zenMode.value = false
        if (showSearch.value) showSearch.value = false
      }
    }

    // 深拷贝赋值到reactive sp（避免引用共享bug）
    function assignDeep(target, source) {
      const deep = JSON.parse(JSON.stringify(source))
      Object.keys(deep).forEach(k => { target[k] = deep[k] })
    }

    // 主题
    function toggleTheme() {
      isDark.value = !isDark.value
      document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
      try { localStorage.setItem('sp_theme', isDark.value ? 'dark' : 'light') } catch {}
    }
    const savedTheme = localStorage.getItem('sp_theme')
    if (savedTheme === 'light') { isDark.value = false; document.documentElement.setAttribute('data-theme', 'light') }

    // 统计
    const totalScenes = computed(() => sp.episodes.reduce((s,e) => s + e.scenes.length, 0))
    const totalChars = computed(() => {
      let n = 0
      sp.episodes.forEach(e => e.scenes.forEach(sc => sc.blocks.forEach(b => { n += (b.content||'').length })))
      return n
    })

    // ========== 项目管理 ==========

    async function refreshList() {
      projectList.value = await listProjects()
    }

    async function selectProject(id) {
      try {
        // 先保存当前项目（不刷新列表，避免竞态）
        if (activeProject.value) {
          activeProject.value.data = JSON.parse(JSON.stringify(sp))
          activeProject.value.name = sp.title
          await saveProject(activeProject.value)
        }
        // 加载新项目
        const p = await getProject(id)
        if (!p) { console.error('Project not found:', id); return }
        activeProject.value = p
        activeProjectId.value = id
        await setActiveProjectId(id)
        assignDeep(sp, p.data)
        undoMgr.init(sp)
        if (sp.episodes.length && sp.episodes[0].scenes.length) {
          activeSceneId.value = sp.episodes[0].scenes[0].id
        }
        await refreshList()
      } catch (err) {
        console.error('selectProject error:', err)
      }
    }

    async function createNewProject() {
      const p = createProject('未命名剧本')
      await saveProject(p)
      await refreshList()
      await selectProject(p.id)
      tab.value = 'meta'
    }

    async function deleteProjectById(id) {
      const p = projectList.value.find(x => x.id === id)
      if (!confirm(`确定删除剧本「${p?.name || ''}」？此操作不可恢复。`)) return
      await deleteProject(id)
      if (activeProjectId.value === id) {
        activeProject.value = null
        activeProjectId.value = ''
        assignDeep(sp, createScreenplay())
      }
      await refreshList()
    }

    // ========== 保存 ==========

    let timer = null
    function debouncedSave() { clearTimeout(timer); timer = setTimeout(doSave, 2000) }

    async function doSave() {
      if (!activeProject.value) return
      activeProject.value.data = JSON.parse(JSON.stringify(sp))
      activeProject.value.name = sp.title
      await saveProject(activeProject.value)
      lastSaved.value = new Date()
      await refreshList()
    }

    function onUpdate() { undoMgr.record(sp); debouncedSave() }

    function onUpdateProject(fields) {
      if (!activeProject.value) return
      Object.assign(activeProject.value, fields)
      debouncedSave()
    }

    function onEpCountChange(n) {
      if (!activeProject.value) return
      activeProject.value.totalEpisodes = n
      syncEpisodeCount(activeProject.value)
      assignDeep(sp, activeProject.value.data)
      debouncedSave()
    }

    // ========== 集/场次 ==========

    function removeEpisode(idx) {
      if (sp.episodes.length <= 1) return
      if (!confirm(`确定删除第${sp.episodes[idx].num}集？`)) return
      sp.episodes.splice(idx, 1)
      renumberAll(sp)
      if (activeProject.value) activeProject.value.totalEpisodes = sp.episodes.length
      debouncedSave()
    }

    function addEpisode() {
      const num = sp.episodes.length + 1
      sp.episodes.push(createEpisode(num, 2))
      renumberAll(sp)
      if (activeProject.value) activeProject.value.totalEpisodes = sp.episodes.length
      debouncedSave()
    }

    function addScene(epIdx) {
      const ep = sp.episodes[epIdx]
      const num = ep.scenes.length + 1
      ep.scenes.push(createScene(ep.num, num))
      renumberAll(sp)
      debouncedSave()
    }

    function jumpTo(sceneId) { activeSceneId.value = sceneId; tab.value = 'editor' }

    // ========== 导入导出 ==========

    function triggerImport() {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.txt,.docx,.doc,.pdf'
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!confirm(`将导入文件「${file.name}」到当前剧本。当前内容将被替换，确定？`)) return
        importing.value = true
        try {
          const text = await readFile(file)
          const imported = parseScreenplay(text)
          // 同步项目元信息
          if (imported._projectMeta && activeProject.value) {
            activeProject.value.ipType = imported._projectMeta.ipType
            activeProject.value.ipName = imported._projectMeta.ipName
          }
          delete imported._projectMeta
          assignDeep(sp, imported)
          if (activeProject.value) activeProject.value.totalEpisodes = sp.episodes.length
          doSave()
          tab.value = 'editor'
          if (sp.episodes.length && sp.episodes[0].scenes.length) {
            activeSceneId.value = sp.episodes[0].scenes[0].id
          }
          alert(`导入成功！共解析 ${sp.episodes.length} 集`)
        } catch (err) {
          alert('导入失败：' + err.message)
        } finally {
          importing.value = false
        }
      }
      input.click()
    }

    function triggerImportArchive() {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
          const result = await importProjectJSON(file)
          await refreshList()
          alert(`导入成功！共导入 ${result.count} 个剧本`)
          if (result.type === 'single' && result.project) {
            await selectProject(result.project.id)
          }
        } catch (err) {
          alert('导入失败：' + err.message)
        }
      }
      input.click()
    }

    async function doExportAll() { await exportAllProjectsJSON() }
    function doExportSingle() { if (activeProject.value) exportProjectJSON(activeProject.value) }

    function doExportTxt() {
      const txt = exportToText(sp)
      downloadFile(sp.title + '.txt', txt, 'text/plain')
    }
    async function doExportDocx() { await exportDocx(sp) }
    function doExportPdf() {
      const txt = exportToText(sp)
      const w = window.open('', '_blank')
      w.document.write(`<html><head><meta charset="utf-8"><title>${sp.title}</title><style>body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;white-space:pre-wrap;padding:40px;font-size:14px;line-height:2;color:#222}@media print{body{padding:20px}}</style></head><body>${escHtml(txt)}</body></html>`)
      w.document.close()
      setTimeout(() => w.print(), 500)
    }

    function downloadFile(name, content, mime) {
      const blob = new Blob([content], { type: mime + ';charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    }
    function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') }
    function fmtTime(d) { return d ? d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '' }

    // ========== Watch ==========

    watch(() => sp.episodes, debouncedSave, { deep: true })

    // ========== Init ==========

    onMounted(async () => {
      // 键盘快捷键
      window.addEventListener('keydown', onKeydown)

      // 先尝试迁移旧数据
      await migrateFromLocalStorage()
      await refreshList()

      // 恢复上次打开的项目
      const lastId = await getActiveProjectId()
      if (lastId) {
        const p = await getProject(lastId)
        if (p) {
          activeProject.value = p
          activeProjectId.value = lastId
          assignDeep(sp, p.data)
          if (sp.episodes.length && sp.episodes[0].scenes.length) {
            activeSceneId.value = sp.episodes[0].scenes[0].id
          }
        }
      }

      // 如果没有任何项目，停在projects页
      if (projectList.value.length === 0) {
        tab.value = 'projects'
      }
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeydown)
    })

    return {
      tab, sp, activeSceneId, showExport, lastSaved, isDark, importing,
      projectList, activeProjectId, activeProject,
      showSearch, zenMode, showOutline, showVersions, outlineCollapsed, versionList, undoMgr,
      totalScenes, totalChars, epCharCount,
      toggleTheme, toggleZen, doUndo, doRedo, saveVersion, restoreVersion,
      onUpdate, onUpdateProject, onEpCountChange,
      selectProject, createNewProject, deleteProjectById,
      removeEpisode, addEpisode, addScene, jumpTo,
      doSave, triggerImport, triggerImportArchive,
      doExportAll, doExportSingle, doExportTxt, doExportDocx, doExportPdf,
      fmtTime,
    }
  }
}
</script>

<style scoped>
.app{display:flex;flex-direction:column;height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-subtle);flex-shrink:0;z-index:50}
.topbar-left,.topbar-right{display:flex;align-items:center;gap:12px}
.logo{font-size:15px;font-weight:700;color:var(--accent2);letter-spacing:0.5px}
.tabs{display:flex;gap:2px}
.tabs button{padding:6px 16px;font-size:13px;background:transparent;color:var(--text-secondary);border-radius:var(--radius)}
.tabs button.active{background:var(--accent);color:#fff}
.tabs button:hover:not(.active):not(:disabled){background:var(--bg-hover)}
.tabs button:disabled{opacity:0.4;cursor:not-allowed}
.current-title{font-size:14px;font-weight:600;color:var(--accent2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stats{font-size:12px;color:var(--text-muted)}
.btn-sm{padding:5px 12px;font-size:12px;background:var(--bg-card);color:var(--text-secondary);border-radius:var(--radius)}
.btn-sm:hover{background:var(--bg-hover);color:var(--text-primary)}
.btn-primary{padding:5px 14px;font-size:12px;background:var(--accent);color:#fff;border-radius:var(--radius)}
.btn-primary:hover{background:#6a4bd6}
.dropdown-wrap{position:relative}
.dropdown{position:absolute;top:calc(100% + 4px);right:0;min-width:150px;background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:var(--radius);box-shadow:var(--shadow);z-index:100;overflow:hidden}
.dropdown button{display:block;width:100%;padding:10px 14px;font-size:13px;text-align:left;color:var(--text-primary);background:transparent}
.dropdown button:hover{background:var(--bg-hover)}
.main{flex:1;display:flex;overflow:hidden}
.empty-main{align-items:center;justify-content:center;color:var(--text-muted);font-size:14px}
.sidebar{width:230px;flex-shrink:0;background:var(--bg-secondary);border-right:1px solid var(--border-subtle);overflow-y:auto}
.editor-pane{flex:1;overflow:hidden;display:flex;flex-direction:column}
.statusbar{display:flex;align-items:center;justify-content:space-between;height:28px;padding:0 16px;background:var(--bg-secondary);border-top:1px solid var(--border-subtle);font-size:11px;color:var(--text-muted);flex-shrink:0}
.statusbar kbd{padding:0 4px;font-size:10px;font-family:monospace;background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:2px}
.statusbar-right{display:flex;align-items:center;gap:12px}
.stats{font-size:11px;color:var(--text-muted)}
.saved{color:var(--accent-ok)}
.btn-theme{width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-card);border-radius:50%;color:var(--text-secondary);line-height:1}
.btn-theme:hover{background:var(--bg-hover);transform:rotate(20deg)}
.btn-tool{display:flex;align-items:center;gap:3px;padding:4px 10px;font-size:12px;background:var(--bg-card);border-radius:var(--radius);color:var(--text-secondary);line-height:1;white-space:nowrap}
.btn-tool:hover{background:var(--bg-hover);color:var(--text-primary)}
.btn-tool:disabled{opacity:0.3;cursor:not-allowed}
.btn-tool.active{background:rgba(124,92,231,0.15);color:var(--accent)}

/* Zen Mode */
.main.zen .sidebar{display:none}
.main.zen .editor-pane{flex:1}
.main.zen{background:var(--bg-editor)}

/* Outline Panel */
.outline-panel{padding:12px 0;overflow-y:auto;height:100%}
.outline-title{padding:0 14px 10px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px}
.outline-ep{margin-bottom:2px}
.outline-ep-row{display:flex;align-items:center;gap:6px;padding:6px 14px;cursor:pointer;font-size:13px;transition:background 0.1s}
.outline-ep-row:hover{background:var(--bg-hover)}
.outline-arrow{font-size:10px;color:var(--text-muted);width:12px}
.outline-ep-name{font-weight:600;color:var(--text-primary);flex:1}
.outline-ep-stats{font-size:11px;color:var(--text-muted)}
.outline-scenes{padding-left:32px}
.outline-sc{padding:3px 14px;font-size:12px;color:var(--text-secondary);cursor:pointer;border-radius:3px}
.outline-sc:hover{background:var(--bg-hover);color:var(--accent)}

/* Version Panel */
.version-panel{width:220px;flex-shrink:0;background:var(--bg-secondary);border-left:1px solid var(--border-subtle);overflow-y:auto;padding:12px 0}
.version-title{padding:0 14px 10px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px}
.version-empty{padding:12px 14px;font-size:12px;color:var(--text-muted)}
.version-item{padding:8px 14px;cursor:pointer;transition:background 0.1s}
.version-item:hover{background:var(--bg-hover)}
.version-time{display:block;font-size:12px;color:var(--text-primary)}
.version-info{font-size:11px;color:var(--text-muted)}
.version-save-btn{width:calc(100% - 28px);margin:10px 14px;padding:8px;font-size:12px;background:var(--bg-card);color:var(--text-secondary);border:1px dashed var(--bg-hover);border-radius:var(--radius)}
.version-save-btn:hover{background:var(--bg-hover);border-color:var(--accent);color:var(--text-primary)}
#mobile-tip{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#0d0d18;color:#e0e0f0;font-family:'PingFang SC','Microsoft YaHei',sans-serif;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
#mobile-tip .icon{font-size:48px;margin-bottom:20px}
#mobile-tip h2{font-size:20px;font-weight:700;margin-bottom:12px;color:#7c5ce7}
#mobile-tip p{font-size:14px;line-height:1.8;color:#8888a8;margin-bottom:24px;max-width:320px}
#mobile-tip .m-btn{padding:10px 28px;font-size:13px;background:transparent;color:#555570;border:1px solid #333;border-radius:8px;cursor:pointer}
@media(max-width:768px){#mobile-tip{display:flex}}
</style>
