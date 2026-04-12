<template>
  <div class="projects-page">
    <aside class="projects-sidebar" :class="{collapsed: sidebarCollapsed}">
      <div class="sidebar-header">
        <span class="sidebar-title" v-if="!sidebarCollapsed">📁 我的剧本</span>
        <button class="collapse-btn" @click="sidebarCollapsed=!sidebarCollapsed" :title="sidebarCollapsed?'展开':'收起'">
          {{ sidebarCollapsed ? '▶' : '◀' }}
        </button>
      </div>

      <div class="project-list" v-if="!sidebarCollapsed">
        <div
          v-for="p in projects"
          :key="p.id"
          class="project-item"
          :class="{active: p.id === activeId}"
          @click="$emit('select', p.id)"
        >
          <div class="project-name">{{ p.name }}</div>
          <div class="project-meta">{{ p.episodeCount }}集 · {{ p.sceneCount }}场</div>
          <div class="project-date">{{ fmtDate(p.updatedAt) }}</div>
          <button class="project-del" @click.stop="$emit('delete', p.id)" title="删除">✕</button>
        </div>
      </div>

      <div class="sidebar-actions" v-if="!sidebarCollapsed">
        <button class="action-btn" @click="$emit('create')">+ 新建剧本</button>
        <button class="action-btn" @click="$emit('import-archive')">📥 导入存档</button>
        <button class="action-btn" @click="$emit('import-file')">📄 导入剧本文件</button>
        <button class="action-btn" @click="$emit('export-all')">📦 导出全部</button>
      </div>
    </aside>

    <div class="project-preview" v-if="currentProject">
      <div class="preview-header">
        <h2 class="preview-title">{{ currentProject.name }}</h2>
        <div class="preview-badges">
          <span class="badge" v-if="currentProject.ipType==='adaptation'">IP改编</span>
          <span class="badge original" v-else>原创</span>
          <span class="badge">{{ currentProject.totalEpisodes || 0 }}集</span>
        </div>
      </div>

      <div class="preview-info" v-if="currentProject.ipType==='adaptation' && currentProject.ipName">
        <span class="info-label">原IP：</span>
        <span>{{ currentProject.ipName }}</span>
      </div>

      <div class="preview-outline" v-if="currentProject.data?.outline">
        <div class="info-label">故事大纲</div>
        <p>{{ currentProject.data.outline }}</p>
      </div>

      <div class="preview-chars" v-if="currentProject.data?.characters?.length">
        <div class="info-label">人物小传</div>
        <div class="char-list">
          <span v-for="c in currentProject.data.characters" :key="c.id" class="char-badge">
            {{ c.name }}（{{ c.role }}）
          </span>
        </div>
      </div>

      <div class="preview-actions">
        <button class="btn-primary" @click="$emit('enter')">进入编辑 →</button>
        <button class="btn-sm" @click="$emit('export-single')">📤 导出存档</button>
      </div>
    </div>

    <div class="project-empty" v-else>
      <div class="empty-icon">✎</div>
      <p>选择一个剧本开始编辑，或新建一个剧本</p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
export default {
  props: {
    projects: Array,
    activeId: String,
    currentProject: Object,
  },
  emits: ['select', 'create', 'delete', 'enter', 'import-archive', 'import-file', 'export-all', 'export-single'],
  setup() {
    const sidebarCollapsed = ref(false)
    function fmtDate(d) {
      if (!d) return ''
      const dt = new Date(d)
      return dt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    return { sidebarCollapsed, fmtDate }
  }
}
</script>

<style scoped>
.projects-page{display:flex;flex:1;overflow:hidden}

.projects-sidebar{width:240px;flex-shrink:0;background:var(--bg-secondary);border-right:1px solid var(--border-subtle);display:flex;flex-direction:column;overflow:hidden;transition:width 0.2s}
.projects-sidebar.collapsed{width:40px}
.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border-subtle)}
.sidebar-title{font-size:13px;font-weight:700;color:var(--text-primary)}
.collapse-btn{padding:2px 6px;font-size:11px;background:transparent;color:var(--text-muted);border-radius:3px}
.collapse-btn:hover{background:var(--bg-hover);color:var(--text-primary)}

.project-list{flex:1;overflow-y:auto;padding:8px 0}
.project-item{padding:10px 14px;cursor:pointer;border-left:3px solid transparent;transition:all 0.15s;position:relative}
.project-item:hover{background:var(--bg-hover)}
.project-item.active{background:rgba(124,92,231,0.1);border-left-color:var(--accent)}
.project-name{font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:2px;padding-right:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.project-meta{font-size:11px;color:var(--text-muted)}
.project-date{font-size:10px;color:var(--text-muted);margin-top:2px}
.project-del{position:absolute;top:10px;right:8px;padding:2px 6px;background:transparent;color:var(--text-muted);font-size:11px;border-radius:3px;opacity:0;transition:opacity 0.15s}
.project-item:hover .project-del{opacity:1}
.project-del:hover{background:rgba(233,69,96,0.15);color:var(--accent2)}

.sidebar-actions{padding:8px 10px;border-top:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:4px}
.action-btn{padding:7px 12px;font-size:12px;background:transparent;color:var(--text-secondary);border:1px dashed var(--bg-hover);border-radius:var(--radius);text-align:left}
.action-btn:hover{background:var(--bg-hover);color:var(--text-primary);border-color:var(--accent)}

.project-preview{flex:1;padding:40px;overflow-y:auto}
.preview-header{margin-bottom:24px}
.preview-title{font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:8px}
.preview-badges{display:flex;gap:8px}
.badge{padding:3px 10px;font-size:11px;background:rgba(124,92,231,0.12);color:var(--accent);border-radius:12px}
.badge.original{background:rgba(46,213,115,0.12);color:#2ed573}
.preview-info{margin-bottom:16px;font-size:14px;color:var(--text-secondary)}
.info-label{font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
.preview-outline{margin-bottom:24px}
.preview-outline p{font-size:14px;line-height:1.8;color:var(--text-secondary)}
.preview-chars{margin-bottom:24px}
.char-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.char-badge{padding:4px 12px;font-size:12px;background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:16px;color:var(--text-secondary)}
.preview-actions{display:flex;gap:12px;margin-top:32px}
.btn-primary{padding:10px 24px;font-size:14px;background:var(--accent);color:#fff;border-radius:var(--radius);font-weight:600}
.btn-primary:hover{background:#6a4bd6}
.btn-sm{padding:8px 16px;font-size:12px;background:var(--bg-card);color:var(--text-secondary);border-radius:var(--radius)}
.btn-sm:hover{background:var(--bg-hover);color:var(--text-primary)}

.project-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted)}
.empty-icon{font-size:48px;margin-bottom:16px;opacity:0.3}
.project-empty p{font-size:14px}
</style>
