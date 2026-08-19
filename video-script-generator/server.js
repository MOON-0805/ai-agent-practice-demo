const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } = require('docx');
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// OpenAI 配置
const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.trustoken.cn/v1',
  apiKey: process.env.OPENAI_API_KEY || '{{API_KEY}}',
});
// ==========================================
// 提示词模板 - 核心 System Prompt
// ==========================================
const SYSTEM_PROMPT = `你是一位顶级的短视频脚本创作专家，精通抖音、快手、视频号、B站等平台的爆款内容逻辑。
你的任务是帮助用户生成高质量的短视频脚本，严格遵守以下规则：
## 核心创作原则
### 1. 通用爆款公式（所有平台适用）
- **前3秒钩子**：必须在前3秒抓住观众注意力，可以使用"悬念提问""惊人数据""反常识观点""强烈对比""痛点直击"等方式
- **中间内容**：3-5个信息点，节奏紧凑，每10-15秒一个情绪/信息转折
- **结尾引导**：引导点赞、评论、关注、收藏，设计互动话术
### 2. 产品种草类脚本结构（自动识别）
当脚本涉及产品推广时，必须融入以下结构：
- **痛点引入**：描述目标用户的痛点场景（前3-5秒）
- **解决方案**：自然引出产品作为解决方案
- **效果展示**：展示使用效果/前后对比/用户见证
- **引导下单**：限时优惠/稀缺性/信任背书+行动号召
### 3. 平台差异化规则
#### 抖音
- 节奏极快，前3秒必须制造强烈冲击
- 使用热门BGM和音效
- 字幕要大而清晰，配合画面重点词放大
- 结尾必须引导互动（"你觉得呢？评论区告诉我""点赞收藏不迷路"）
- 推荐使用"口播+场景切换"形式
#### 快手
- 更接地气，语言朴实真诚
- 强调"老铁""家人们"等亲切称呼
- 内容更注重实用性和真实感
- 结尾引导"双击666""关注不迷路"
#### 视频号
- 内容偏深度，节奏可稍慢
- 适合知识分享、情感共鸣类内容
- 语言风格偏正式、有温度
- 结尾引导"转发给需要的朋友""点个赞支持一下"
#### B站
- 内容质量要求高，可以更有深度
- 允许更长的前奏铺垫
- 可以使用网络梗、二次元元素
- 结尾引导"一键三连""关注UP主"
- 弹幕互动设计（在台词中预留弹幕槽点）
### 4. 时长控制规则
- **15秒**：1-2个分镜，极简信息，只讲一个核心卖点
- **30秒**：3-4个分镜，完整展示痛点+解决方案+效果
- **60秒**：5-7个分镜，深度内容，可加入故事线
### 5. 风格指南
#### 搞笑风格
- 使用夸张表情、反转剧情
- 语速快，配合喜剧音效
- 结尾要有"包袱"或"神转折"
#### 种草风格
- 真实体验感，第一人称视角
- 强调"亲测有效""自用推荐"
- 展示细节和使用场景
#### 知识科普
- 结构清晰：问题→原理→应用→总结
- 使用类比和可视化语言
- 数据来源可靠
#### 情感风格
- 故事性强，有代入感
- 音乐选择要烘托情绪
- 结尾有金句升华
#### 剧情反转
- 设置悬念和误导
- 反转要出乎意料但合情合理
- 节奏把控精准
## 输出格式要求
你必须严格按照以下JSON格式输出，不要添加任何额外内容：
{
  "title": "视频标题",
  "totalDuration": 30,
  "sceneCount": 4,
  "scenes": [
    {
      "id": 1,
      "duration": 5,
      "visual": "画面描述",
      "dialogue": "台词/文案",
      "audio": "音效/BGM建议"
    }
  ],
  "rhythmAdvice": "整体节奏建议",
  "headlineSuggestions": ["爆款标题1", "爆款标题2", "爆款标题3", "爆款标题4", "爆款标题5"]
}`;
// ==========================================
// API 路由 - 生成脚本（并行生成三种不重样脚本）
// ==========================================
app.post('/api/generate', async (req, res) => {
  try {
    const { topic, platform, duration, style, audience, reference } = req.body;
    
    // 三种不同的创作角度，确保输出不重样
    const angles = [
      { name: '爆款引流版', extra: '请从"制造强烈情绪冲击和悬念"的角度创作，标题要极度吸睛，适合快速引流' },
      { name: '深度种草版', extra: '请从"真实体验和细节展示"的角度创作，强调信任感和代入感，适合转化' },
      { name: '创意剧情版', extra: '请从"故事性和创意反转"的角度创作，要有独特的叙事结构和记忆点' }
    ];
    
    // 并行调用3次AI
    const promises = angles.map(angle => {
      const userPrompt = buildUserPrompt(topic, platform, duration, style, audience, reference, angle.extra);
      return openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'auto',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 4000,
      }).then(completion => {
        const rawContent = completion.choices[0].message.content;
        // 多层清理：去除markdown代码块标记、去除前后空白
        let cleanContent = rawContent.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
        // 尝试从内容中提取最外层的JSON对象
        let data;
        try {
          data = JSON.parse(cleanContent);
        } catch (e) {
          // 如果直接解析失败，尝试提取第一个完整的JSON对象
          const braceStart = cleanContent.indexOf('{');
          const braceEnd = cleanContent.lastIndexOf('}');
          if (braceStart !== -1 && braceEnd > braceStart) {
            const jsonStr = cleanContent.substring(braceStart, braceEnd + 1);
            try {
              data = JSON.parse(jsonStr);
            } catch (e2) {
              // 如果还有问题，尝试修复常见JSON格式错误
              // 1. 修复末尾多余的逗号
              const fixed = jsonStr.replace(/,([\s]*[\]\}])/g, '$1');
              try {
                data = JSON.parse(fixed);
              } catch (e3) {
                // 2. 修复单引号替换为双引号
                const fixed2 = fixed.replace(/'/g, '"');
                try {
                  data = JSON.parse(fixed2);
                } catch (e4) {
                  // 3. 修复属性名缺少引号
                  const fixed3 = fixed2.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
                  try {
                    data = JSON.parse(fixed3);
                  } catch (e5) {
                    throw new Error('JSON解析失败: ' + e5.message);
                  }
                }
              }
            }
          } else {
            throw new Error('未找到JSON内容');
          }
        }
        // 验证数据结构完整性
        if (!data.title) data.title = '未命名脚本';
        if (!data.totalDuration) data.totalDuration = 30;
        if (!data.sceneCount) data.sceneCount = (data.scenes && data.scenes.length) || 3;
        if (!data.scenes || !Array.isArray(data.scenes)) {
          data.scenes = [
            { id: 1, duration: 5, visual: '开场画面', dialogue: '开场台词', audio: '背景音乐' },
            { id: 2, duration: 5, visual: '主体内容', dialogue: '核心文案', audio: '音效' },
            { id: 3, duration: 5, visual: '结尾画面', dialogue: '引导互动', audio: '结尾BGM' }
          ];
        }
        // 确保每个分镜都有必要字段
        data.scenes = data.scenes.map((s, i) => ({
          id: s.id || (i + 1),
          duration: s.duration || 5,
          visual: s.visual || '画面描述',
          dialogue: s.dialogue || '台词',
          audio: s.audio || 'BGM'
        }));
        if (!data.rhythmAdvice) data.rhythmAdvice = '前3秒抓眼球，中间内容紧凑，结尾引导互动。';
        if (!data.headlineSuggestions || !Array.isArray(data.headlineSuggestions)) {
          data.headlineSuggestions = ['爆款标题1', '爆款标题2', '爆款标题3'];
        }
        return { name: angle.name, data };
      });
    });
    
    const results = await Promise.all(promises);
    
    res.json({ success: true, scripts: results });
  } catch (error) {
    console.error('生成脚本失败:', error);
    res.status(500).json({ success: false, error: error.message || '生成失败，请稍后重试' });
  }
});
// ==========================================
// 构建用户提示词
// ==========================================
function buildUserPrompt(topic, platform, duration, style, audience, reference, angleExtra) {
  let prompt = `请为以下需求生成一个短视频脚本：\n\n`;
  prompt += `【视频主题/产品名称】${topic}\n`;
  prompt += `【目标平台】${platform}\n`;
  prompt += `【视频时长】${duration}\n`;
  prompt += `【视频风格】${style}\n`;
  
  if (audience) {
    prompt += `【目标受众】${audience}\n`;
  }
  
  if (reference) {
    prompt += `【参考文案/关键词】${reference}\n`;
  }
  // 根据平台添加额外提示
  const platformTips = {
    '抖音': '注意：抖音用户年轻化，节奏要快，前3秒必须有冲击力，字幕要醒目。',
    '快手': '注意：快手用户注重真实感，语言要接地气，使用"老铁""家人们"等称呼。',
    '视频号': '注意：视频号用户偏成熟，内容要有深度和温度，节奏可稍慢。',
    'B站': '注意：B站用户对内容质量要求高，可以使用网络梗，引导"一键三连"。'
  };
  prompt += `\n${platformTips[platform] || ''}\n`;
  // 根据风格添加额外提示
  const styleTips = {
    '搞笑': '风格要求：使用夸张表现手法，设置笑点和反转，配合喜剧音效。',
    '种草': '风格要求：第一人称真实体验感，强调"亲测有效"，展示细节和使用场景。如果是产品推广，请严格遵循"痛点+解决方案+效果展示+引导下单"结构。',
    '知识科普': '风格要求：结构清晰（问题→原理→应用→总结），使用类比帮助理解，数据要可信。',
    '情感': '风格要求：故事性强，有代入感，音乐烘托情绪，结尾要有金句升华。',
    '剧情反转': '风格要求：设置悬念和误导，反转要出乎意料但合情合理，节奏把控精准。'
  };
  prompt += `\n${styleTips[style] || ''}\n`;
  // 根据时长设置分镜数量建议
  const sceneTips = {
    '15秒': '注意：15秒短视频，建议1-2个分镜，只讲一个核心卖点，信息极度精简。',
    '30秒': '注意：30秒短视频，建议3-4个分镜，完整展示核心信息。',
    '60秒': '注意：60秒短视频，建议5-7个分镜，可以加入故事线，内容更丰富。'
  };
  prompt += `\n${sceneTips[duration] || ''}\n`;
  if (angleExtra) {
    prompt += `\n【创作角度要求】${angleExtra}\n`;
  }
  prompt += `\n请严格按照JSON格式输出，包含标题、总时长、分镜列表、节奏建议和爆款标题建议。`;
  
  return prompt;
}
// ==========================================
// API 路由 - 导出Word文档
// ==========================================
app.post('/api/export-word', async (req, res) => {
  try {
    const { script } = req.body;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: `短视频脚本：${script.title}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          
          // 基本信息
          new Paragraph({
            children: [
              new TextRun({ text: `总时长：`, bold: true }),
              new TextRun({ text: `${script.totalDuration}秒` }),
              new TextRun({ text: `   分镜数量：`, bold: true }),
              new TextRun({ text: `${script.sceneCount}个` }),
            ],
            spacing: { after: 200 },
          }),
          
          // 分镜表格
          new Table({
            rows: [
              // 表头
              new TableRow({
                tableHeader: true,
                children: ['分镜编号', '时长(秒)', '画面描述', '台词/文案', '音效/BGM建议'].map(text => 
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text, bold: true, size: 20 })],
                      alignment: AlignmentType.CENTER,
                    })],
                    width: { size: 1000, type: WidthType.DXA },
                  })
                ),
              }),
              // 数据行
              ...script.scenes.map(scene => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(scene.id) })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(scene.duration) })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph(scene.visual)] }),
                    new TableCell({ children: [new Paragraph(scene.dialogue)] }),
                    new TableCell({ children: [new Paragraph(scene.audio)] }),
                  ],
                })
              ),
            ],
          }),
          
          // 节奏建议
          new Paragraph({
            children: [new TextRun({ text: '\n整体节奏建议：', bold: true, size: 24 })],
            spacing: { before: 400 },
          }),
          new Paragraph({
            text: script.rhythmAdvice,
            spacing: { after: 200 },
          }),
          
          // 爆款标题建议
          new Paragraph({
            children: [new TextRun({ text: '\n爆款标题/封面文字建议：', bold: true, size: 24 })],
            spacing: { before: 400 },
          }),
          ...script.headlineSuggestions.map((headline, index) => 
            new Paragraph({
              text: `${index + 1}. ${headline}`,
              spacing: { after: 100 },
            })
          ),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const fileName = encodeURIComponent('短视频脚本_' + (script.title || '未命名') + '.docx');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
    res.send(buffer);
    
  } catch (error) {
    console.error('导出Word失败:', error);
    res.status(500).json({ success: false, error: '导出失败' });
  }
});
// 启动服务器 - 随机端口
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(JSON.stringify({
    "type": "http_start",
    "port": port
  }));
});
process.on("SIGINT", () => {
  console.log("Server shutdown complete");
  process.exit(0);
});