// 剧本导入模块：支持 TXT / DOCX / PDF 导入
import { uid, createBlock } from './model.js'

// ========== 文件读取 ==========

function readTxtFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

async function readDocxFile(file) {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.default.extractRawText({ arrayBuffer })
  return result.value
}

async function readPdfFile(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join('')
    text += pageText + '\n'
  }
  return text
}

export async function readFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt')) return await readTxtFile(file)
  if (name.endsWith('.docx') || name.endsWith('.doc')) return await readDocxFile(file)
  if (name.endsWith('.pdf')) return await readPdfFile(file)
  throw new Error('不支持的文件格式，请上传 TXT、DOCX 或 PDF 文件')
}

// ========== 剧本解析 ==========

let _cid = 0

export function parseScreenplay(rawText) {
  const lines = rawText.split(/\r?\n/)
  const sp = {
    title: '导入的剧本',
    outline: '',
    characters: [],
    episodes: [],
    settings: { actionSymbol: '\u25B2', sceneStyle: 'separate' },
  }

  // 额外提取的项目级信息
  const projectMeta = {
    ipType: 'original',
    ipName: '',
  }

  let currentEp = null
  let currentSc = null
  let epNum = 0
  let inOutline = false
  let inCharSection = false
  let outlineLines = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) {
      if (inOutline && outlineLines.length > 0) {
        // 空行可能是大纲结束
      }
      continue
    }

    // ===== 元信息解析（在任何集之前）=====

    // 匹配标题：《xxx》xxx 或 剧本标题/名称
    if (sp.episodes.length === 0 && !currentEp) {
      const titleMatch = line.match(/^[《「](.+?)[》」]/) || line.match(/^(?:剧本名称|剧本标题|标题|名称)[：:]\s*(.+)/)
      if (titleMatch) {
        sp.title = titleMatch[1] || titleMatch[2] || line
        continue
      }
    }

    // 匹配IP改编信息：改编xxx小说：xxx 或 原著/原IP：xxx
    const ipMatch = line.match(/^(?:改编[^\s：:]*)[：:]\s*(.+)/) || line.match(/^(?:原著|原IP|原作|原小说)[：:]\s*(.+)/)
    if (ipMatch && sp.episodes.length === 0) {
      projectMeta.ipType = 'adaptation'
      projectMeta.ipName = ipMatch[1].trim()
      continue
    }

    // 跳过链接行和作者行
    if (line.match(/^(?:http|https):\/\//) || line.match(/^(?:番茄|PC)?链接[：:]/) || line.match(/^作者[：:]/)) {
      continue
    }

    // 匹配故事大纲/梗概
    const outlineMatch = line.match(/^(?:故事梗概|故事大纲|剧情简介|简介|梗概)[：:]\s*(.*)/)
    if (outlineMatch) {
      outlineLines = outlineMatch[1] ? [outlineMatch[1]] : []
      inOutline = true
      inCharSection = false
      continue
    }
    // 大纲续行（在遇到"第X集"或"人物小传"之前，持续收集）
    if (inOutline) {
      if (line.match(/^(?:第\s*\d|人物小传|人物|角色|EP)/i) || line.match(/^\d+-\d+/)) {
        sp.outline = outlineLines.join('')
        inOutline = false
        // 不continue，让后面的逻辑处理这行
      } else {
        outlineLines.push(line)
        continue
      }
    }

    // 匹配"人物小传"区域开始
    const charSectionMatch = line.match(/^(?:人物小传|主要角色|角色介绍|人物介绍)[：:]?\s*$/)
    if (charSectionMatch) {
      if (inOutline) { sp.outline = outlineLines.join(''); inOutline = false }
      inCharSection = true
      continue
    }

    // 在人物小传区域内解析角色
    if (inCharSection) {
      // 格式：角色名（角色类型）：描述
      const charMatch = line.match(/^([^\s（(：:]{1,10})\s*[（(]\s*(男主|女主|男配|女配|角色|龙套|男主前身)\s*[）)]\s*[：:]\s*(.*)/)
      if (charMatch) {
        // 提取性别和年龄
        const desc = charMatch[3] || ''
        const genderM = desc.match(/^(男|女)[，,]/)
        const ageM = desc.match(/(\d+)\s*岁/)
        sp.characters.push({
          id: uid(),
          name: charMatch[1].trim(),
          gender: genderM ? genderM[1] : '男',
          age: ageM ? ageM[1] : '',
          role: charMatch[2] === '男主前身' ? '男配' : charMatch[2],
          desc: desc,
        })
        continue
      }
      // 简化格式：角色名：描述（没有括号角色类型）
      const charMatch2 = line.match(/^([^\s：:]{1,8})[：:]\s*(.+)/)
      if (charMatch2 && !line.match(/^(?:第|地点|人物)/)) {
        const desc = charMatch2[2] || ''
        const genderM = desc.match(/^(男|女)[，,]/)
        const ageM = desc.match(/(\d+)\s*岁/)
        sp.characters.push({
          id: uid(),
          name: charMatch2[1].trim(),
          gender: genderM ? genderM[1] : '男',
          age: ageM ? ageM[1] : '',
          role: '角色',
          desc: desc,
        })
        continue
      }
      // 遇到集标题退出
      if (line.match(/^(?:第\s*\d|EP)/i) || line.match(/^\d+-\d+$/)) {
        inCharSection = false
      } else {
        continue
      }
    }

    // ===== 剧本正文解析 =====

    // 匹配集标题：第X集-X章 / 第X集 / EP.X
    const epMatch = line.match(/^第\s*(\d+)\s*集/) || line.match(/^EP\.?\s*(\d+)/i)
    if (epMatch) {
      epNum = parseInt(epMatch[1])
      currentEp = {
        id: uid(),
        num: epNum,
        title: `第${epNum}集`,
        chapterRef: line.replace(/^第\s*\d+\s*集/, '').replace(/^EP\.?\s*\d+/i, '').replace(/^[-\s]*/, '').trim(),
        scenes: [],
      }
      sp.episodes.push(currentEp)
      currentSc = null
      continue
    }

    // 匹配分卡标记（跳过）
    if (/^——[一二三四]卡——$/.test(line) || /^[-—]+[一二三四]卡[-—]+$/.test(line)) continue

    // 匹配单集大纲行（第X集：描述）——在集标题区域可能出现
    const epOutlineMatch = line.match(/^第\s*(\d+)\s*集[：:]\s*(.+)/)
    if (epOutlineMatch && !currentEp) {
      // 这是集大纲描述，跳过（已在集标题中处理）
      continue
    }

    // 匹配场次标题：X-X
    const scMatch = line.match(/^(\d+)\s*[-–—]\s*(\d+)\s*$/)
    if (scMatch) {
      if (!currentEp) {
        epNum++
        currentEp = { id: uid(), num: epNum, title: `第${epNum}集`, chapterRef: '', scenes: [] }
        sp.episodes.push(currentEp)
      }
      const scNum = currentEp.scenes.length + 1
      currentSc = {
        id: uid(),
        episodeNum: currentEp.num,
        sceneNum: scNum,
        label: `${scMatch[1]}-${scMatch[2]}`,
        location: '',
        time: '日',
        inOut: '内',
        characters: [],
        blocks: [],
      }
      currentEp.scenes.push(currentSc)
      continue
    }

    // 匹配地点行
    const locMatch = line.match(/^地点[：:]\s*(.+)/)
    if (locMatch && currentSc) {
      const parts = locMatch[1].split(/[，,]/).map(s => s.trim())
      currentSc.location = parts[0] || ''
      for (const p of parts) {
        if (/夜/.test(p)) currentSc.time = '夜'
        else if (/黄昏/.test(p)) currentSc.time = '黄昏'
        else if (/清晨/.test(p)) currentSc.time = '清晨'
        if (/外/.test(p) && /内/.test(p)) currentSc.inOut = '内外'
        else if (/^外$/.test(p)) currentSc.inOut = '外'
        else if (/^内$/.test(p)) currentSc.inOut = '内'
        else if (/^内外$/.test(p)) currentSc.inOut = '内外'
      }
      continue
    }

    // 匹配人物行
    const personMatch = line.match(/^人物[：:]\s*(.+)/)
    if (personMatch && currentSc) {
      currentSc.characters = personMatch[1].split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean)
      continue
    }

    // 确保有容器
    if (!currentEp && !inOutline && !inCharSection) {
      // 如果还没有集，可能是集大纲区域的描述，跳过
      if (line.match(/^第\s*\d+\s*集[：:]/) || line.match(/[（(].*[）)]$/)) continue
      continue
    }
    if (currentEp && !currentSc) {
      const scNum = currentEp.scenes.length + 1
      currentSc = {
        id: uid(), episodeNum: currentEp.num, sceneNum: scNum,
        label: `${currentEp.num}-${scNum}`, location: '', time: '日', inOut: '内',
        characters: [], blocks: [],
      }
      currentEp.scenes.push(currentSc)
    }

    if (!currentSc) continue

    // 匹配动作描写：▲xxx 或 △xxx
    if (/^[▲△]/.test(line)) {
      currentSc.blocks.push(createBlock('action', line.replace(/^[▲△]\s*/, '')))
      continue
    }

    // 匹配镜头指示：【xxx】
    const dirMatch = line.match(/^【(.+?)】$/) || line.match(/^【(.+)/)
    if (dirMatch) {
      currentSc.blocks.push(createBlock('direction', dirMatch[1].replace(/】$/, '')))
      continue
    }

    // 匹配带【切镜头】前缀的动作行
    const cutMatch = line.match(/^【[^】]*】[：:]?\s*[▲△]?\s*(.+)/)
    if (cutMatch) {
      currentSc.blocks.push(createBlock('action', cutMatch[1]))
      continue
    }

    // 跳过"（完）"
    if (/^[（(]完[）)]$/.test(line)) continue

    // 匹配对白/OS/VO：角色名（括注）：台词
    // 支持：角色名OV：xxx / 角色名（OS）：xxx / 角色名（表情）：xxx / 角色名：xxx
    const dlgMatch = line.match(/^([^\s（(：:OV]{1,8})\s*(?:OV|ov)\s*[：:]\s*(.*)/)
    if (dlgMatch) {
      currentSc.blocks.push(createBlock('vo', dlgMatch[2].trim(), { character: dlgMatch[1].trim() }))
      continue
    }

    const dlgMatch2 = line.match(/^([^\s（(：:]{1,8})\s*[（(]([^）)]*)[）)]\s*[：:]\s*(.*)/)
    if (dlgMatch2) {
      const charName = dlgMatch2[1].trim()
      const paren = dlgMatch2[2].trim()
      const content = dlgMatch2[3].trim()

      if (/^OS$/i.test(paren) || /内心/i.test(paren)) {
        currentSc.blocks.push(createBlock('os', content, { character: charName, parenthetical: paren }))
      } else if (/^VO$/i.test(paren) || /^OV$/i.test(paren) || /画外/i.test(paren) || /旁白/i.test(paren)) {
        currentSc.blocks.push(createBlock('vo', content, { character: charName }))
      } else {
        currentSc.blocks.push(createBlock('dialogue', content, { character: charName, parenthetical: paren }))
      }
      continue
    }

    // 简单对白：角色名：台词
    const dlgMatch3 = line.match(/^([^\s：:]{1,8})\s*[：:]\s*(.+)/)
    if (dlgMatch3 && !line.match(/^(?:地点|人物|故事|作者|改编|番茄|原著)/)) {
      currentSc.blocks.push(createBlock('dialogue', dlgMatch3[2].trim(), { character: dlgMatch3[1].trim(), parenthetical: '' }))
      continue
    }

    // 带OV后缀的画外音行
    const ovMatch = line.match(/^(.+?)\s*OV[：:]\s*(.*)/)
    if (ovMatch) {
      currentSc.blocks.push(createBlock('vo', ovMatch[2].trim(), { character: ovMatch[1].trim() }))
      continue
    }

    // 其余内容作为正文
    currentSc.blocks.push(createBlock('text', line))
  }

  // 处理最后的大纲
  if (inOutline && outlineLines.length > 0) {
    sp.outline = outlineLines.join('')
  }

  // 后处理：确保每个场次至少有一个block
  sp.episodes.forEach(ep => {
    ep.scenes.forEach(sc => {
      if (sc.blocks.length === 0) {
        sc.blocks.push(createBlock('action', ''))
      }
    })
  })

  // 如果没有解析到任何集
  if (sp.episodes.length === 0) {
    sp.episodes.push({
      id: uid(), num: 1, title: '第1集', chapterRef: '',
      scenes: [{
        id: uid(), episodeNum: 1, sceneNum: 1, label: '1-1',
        location: '', time: '日', inOut: '内', characters: [],
        blocks: [createBlock('text', rawText.substring(0, 500))],
      }]
    })
  }

  // 附带项目元信息
  sp._projectMeta = projectMeta

  return sp
}
