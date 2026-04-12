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
          <span class="stats">{{ sp.episodes.length }}集 · {{ totalScenes }}场 · {{ totalChars }}字</span>
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
        @enter="tab='editor'"
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
      />
    </div>

    <!-- 剧本正文 -->
    <div class="main" v-else-if="tab==='editor' && activeProject">
      <aside class="sidebar">
        <NavPanel :episodes="sp.episodes" :activeSceneId="activeSceneId" @select="jumpTo" @add-scene="addScene" @remove-ep="removeEpisode" />
      </aside>
      <div class="editor-pane">
        <EditorPanel
          :sp="sp"
          :characters="sp.characters"
          @update="onUpdate"
          @set-active="activeSceneId=$event"
        />
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
      <span v-if="lastSaved" class="saved">已保存 {{ fmtTime(lastSaved) }}</span>
    </footer>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { createScreenplay, createEpisode, createScene, exportToText, renumberAll } from './model.js'
import { listProjects, getProject, saveProject, deleteProject, getActiveProjectId, setActiveProjectId, createProject, syncEpisodeCount, exportProjectJSON, exportAllProjectsJSON, importProjectJSON, migrateFromLocalStorage } from './store.js'
import { readFile, parseScreenplay } from './import-screenplay.js'
import { exportDocx } from './export-docx.js'
import MetaPanel from './components/MetaPanel.vue'
import NavPanel from './components/NavPanel.vue'
import EditorPanel from './components/EditorPanel.vue'
import ProjectsPanel from './components/ProjectsPanel.vue'

export default {
  components: { MetaPanel, NavPanel, EditorPanel, ProjectsPanel },
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
      // 先保存当前项目
      if (activeProject.value) await doSave()
      // 加载新项目
      const p = await getProject(id)
      if (!p) return
      activeProject.value = p
      activeProjectId.value = id
      await setActiveProjectId(id)
      // 同步到reactive sp
      Object.assign(sp, p.data)
      if (sp.episodes.length && sp.episodes[0].scenes.length) {
        activeSceneId.value = sp.episodes[0].scenes[0].id
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
        Object.assign(sp, createScreenplay())
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

    function onUpdate() { debouncedSave() }

    function onUpdateProject(fields) {
      if (!activeProject.value) return
      Object.assign(activeProject.value, fields)
      debouncedSave()
    }

    function onEpCountChange(n) {
      if (!activeProject.value) return
      activeProject.value.totalEpisodes = n
      syncEpisodeCount(activeProject.value)
      Object.assign(sp, activeProject.value.data)
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
          Object.assign(sp, imported)
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
          Object.assign(sp, p.data)
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

    return {
      tab, sp, activeSceneId, showExport, lastSaved, isDark, importing,
      projectList, activeProjectId, activeProject,
      totalScenes, totalChars,
      toggleTheme, onUpdate, onUpdateProject, onEpCountChange,
      selectProject, createNewProject, deleteProjectById,
      removeEpisode, addScene, jumpTo,
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
.saved{color:var(--accent-ok)}
.btn-theme{width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-card);border-radius:50%;color:var(--text-secondary);line-height:1}
.btn-theme:hover{background:var(--bg-hover);transform:rotate(20deg)}
#mobile-tip{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#0d0d18;color:#e0e0f0;font-family:'PingFang SC','Microsoft YaHei',sans-serif;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
#mobile-tip .icon{font-size:48px;margin-bottom:20px}
#mobile-tip h2{font-size:20px;font-weight:700;margin-bottom:12px;color:#7c5ce7}
#mobile-tip p{font-size:14px;line-height:1.8;color:#8888a8;margin-bottom:24px;max-width:320px}
#mobile-tip .m-btn{padding:10px 28px;font-size:13px;background:transparent;color:#555570;border:1px solid #333;border-radius:8px;cursor:pointer}
@media(max-width:768px){#mobile-tip{display:flex}}
</style>
