const express = require('express');
const path = require('path');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const app = express();
// ===== AI配置（从 config.js 读取，避免硬编码） =====
const config = require('./config.js');
const AI_BASE_URL = config.AI_BASE_URL;
const AI_API_KEY = config.AI_API_KEY;
const AI_MODEL = config.AI_MODEL;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// ===== 日志系统 =====
// 优先使用任务目录，兜底使用智能体自身目录，避免 cwd 为根目录导致 /logs 创建失败
const TASK_DIR = process.env.AIPY_TASK_DIR || __dirname;
const LOG_DIR = path.join(TASK_DIR, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
function getLogFile() {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return path.join(LOG_DIR, `server-${dateStr}.log`);
}
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${type}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(getLogFile(), line + '\n');
  } catch (e) {
    console.error('日志写入失败:', e.message);
  }
}
function logError(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [ERROR] ${message}`;
  console.error(line);
  try {
    fs.appendFileSync(getLogFile(), line + '\n');
  } catch (e) {
    console.error('日志写入失败:', e.message);
  }
}
log('========================================');
log('服务启动，AI配置:');
log(`  Base URL: ${AI_BASE_URL}`);
log(`  Model: ${AI_MODEL}`);
log(`  API Key: ${AI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
log(`  日志目录: ${LOG_DIR}`);
// 配置文件上传
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});
// 通用AI调用函数
async function callAI(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const url = `${AI_BASE_URL}/chat/completions`;
    log(`调用AI接口: ${url}, 模型: ${AI_MODEL}`);
    log(`请求体消息数: ${messages.length}, 第一条角色: ${messages[0].role}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: messages,
        temperature: 0.7
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const errorText = await response.text();
      logError(`AI服务返回错误(${response.status}): ${errorText}`);
      throw new Error(`AI服务返回错误(${response.status}): ${errorText}`);
    }
    const data = await response.json();
    log(`AI响应成功, 返回内容长度: ${data.choices[0].message.content.length}`);
    return data.choices[0].message.content;
  } catch (error) {
    logError(`AI调用异常: ${error.message}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
// 解析文件内容
async function parseFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  } else if (ext === '.pdf') {
    const data = await pdfParse(file.buffer);
    return data.text;
  } else if (ext === '.txt') {
    return file.buffer.toString('utf-8');
  } else if (ext === '.doc') {
    throw new Error('请将.doc文件另存为.docx格式后上传');
  } else {
    throw new Error('不支持的文件格式，请上传Word(.docx)或PDF文件');
  }
}
// 差距分析接口（支持文件上传）
app.post('/api/gap-analysis', upload.single('resumeFile'), async (req, res) => {
  log('========================================');
  log('收到差距分析请求');
  try {
    let resume = req.body.resume || '';
    const jd = req.body.jd || '';
    if (req.file) {
      try {
        resume = await parseFile(req.file);
        log(`已解析上传文件: ${req.file.originalname} (${resume.length}字符)`);
      } catch (fileError) {
        logError(`文件解析失败: ${fileError.message}`);
        return res.status(400).json({ error: fileError.message });
      }
    }
    if (!resume || !jd) {
      logError('参数不完整：缺少简历或JD');
      return res.status(400).json({ error: '请上传简历文件或粘贴简历内容，并填写目标岗位JD' });
    }
    log(`简历长度: ${resume.length}字符, JD长度: ${jd.length}字符`);
    log('开始调用AI进行差距分析...');
    const messages = [
      {
        role: 'system',
        content: '你是一位专业的职业规划师，擅长进行岗位差距分析。请严格按照要求的格式输出分析报告，使用标准的Markdown格式，注意排版美观。'
      },
      {
        role: 'user',
        content: `请对以下简历和目标岗位JD进行差距分析，输出包含五部分的报告：
【第一部分】综合匹配度评分（放在最前面！）
- 给出1-100分的综合匹配度评分
- 用**加粗**突出显示评分数字
- 附上一句话总结
【第二部分】岗位核心需求拆解
- 提炼3-5个要点
【第三部分】您的匹配项分析
- 列出用户简历中与岗位匹配的经历/技能并说明原因
【第四部分】关键差距项分析
- 按重要性排序列出缺失或不足的部分
【第五部分】弥补差距的行动方案
- 针对每项差距给出具体可操作的弥补建议
【输出格式要求】
1. 使用标准Markdown格式，标题使用##和###级别
2. 禁止使用####或#####等四级以上标题
3. 列表使用-或数字编号
4. 表格使用标准的|分隔格式，第一行为表头，第二行为---|---分隔行
5. 禁止使用任何特殊符号（如####、***、->等）
6. 加粗使用**文本**格式，用于强调关键信息
7. 内容清晰、简洁、专业
8. 排版要求：每个部分用###标题分隔，要点用-列表，关键数据用**加粗**强调
9. 综合匹配度评分必须放在报告最前面！
简历内容：
${resume}
目标岗位JD：
${jd}
请用清晰的Markdown格式输出。`
      }
    ];
    const result = await callAI(messages);
    log(`AI分析成功，返回内容长度: ${result.length}`);
    res.json({ success: true, content: result });
  } catch (error) {
    logError(`差距分析失败: ${error.message}`);
    res.status(500).json({ error: error.message || 'AI调用失败，请稍后重试' });
  }
});
// MBTI+霍兰德综合分析接口
app.post('/api/comprehensive-analysis', async (req, res) => {
  log('========================================');
  log('收到AI综合分析请求');
  try {
    const { 
      age, industry, position, skills, goal,
      mbtiType, mbtiAnswers, hollandAnswers,
      radarAnswers
    } = req.body;
    log('请求参数:');
    log(`  - 年龄: ${age}`);
    log(`  - 行业: ${industry}`);
    log(`  - 当前岗位: ${position}`);
    log(`  - 核心技能: ${JSON.stringify(skills)}`);
    log(`  - 职业目标: ${goal || '（未填写）'}`);
    log(`  - MBTI类型: ${mbtiType}`);
    log(`  - MBTI答案数: ${mbtiAnswers ? mbtiAnswers.length : 0}`);
    log(`  - 霍兰德答案: ${JSON.stringify(hollandAnswers)}`);
    log(`  - 职业探索答案数: ${radarAnswers ? radarAnswers.length : 0}`);
    const mbtiDescriptions = {
      'INTJ': '建筑师型（INTJ）', 'INTP': '逻辑学家型（INTP）',
      'ENTJ': '指挥官型（ENTJ）', 'ENTP': '辩论家型（ENTP）',
      'INFJ': '提倡者型（INFJ）', 'INFP': '调停者型（INFP）',
      'ENFJ': '主人公型（ENFJ）', 'ENFP': '竞选者型（ENFP）',
      'ISTJ': '物流师型（ISTJ）', 'ISFJ': '守卫者型（ISFJ）',
      'ESTJ': '总经理型（ESTJ）', 'ESFJ': '执政官型（ESFJ）',
      'ISTP': '鉴赏家型（ISTP）', 'ISFP': '探险家型（ISFP）',
      'ESTP': '企业家型（ESTP）', 'ESFP': '表演者型（ESFP）'
    };
    const mbtiLabel = mbtiDescriptions[mbtiType] || mbtiType;
    const hollandTypes = {
      'R': '现实型（R）', 'I': '研究型（I）', 'A': '艺术型（A）',
      'S': '社会型（S）', 'E': '企业型（E）', 'C': '常规型（C）'
    };
    const hollandCode = hollandAnswers.slice(0, 3).join('');
    const hollandLabel = hollandAnswers.slice(0, 3).map(a => hollandTypes[a] || a).join('、');
    log(`MBTI描述: ${mbtiLabel}`);
    log(`霍兰德代码: ${hollandCode} (${hollandLabel})`);
    log('开始调用AI...');
    const messages = [
      {
        role: 'system',
        content: '你是一位资深的职业发展顾问，擅长结合MBTI人格类型、霍兰德职业兴趣和用户背景进行综合分析。请严格按照要求的格式输出报告，使用标准的Markdown格式，注意排版美观。'
      },
      {
        role: 'user',
        content: `请为用户生成一份综合职业发展报告。
一、用户基本信息：
- 年龄：${age}岁
- 行业：${industry}
- 当前岗位：${position}
- 核心技能：${skills.join('、')}
- 职业目标：${goal || '（未填写）'}
二、MBTI测试结果：
- 类型：${mbtiLabel}
- 测试答案摘要：${JSON.stringify(mbtiAnswers)}
三、霍兰德职业兴趣测试结果：
- 类型代码：${hollandCode}
- 类型描述：${hollandLabel}
四、职业探索问卷回答：
${JSON.stringify(radarAnswers)}
请生成包含以下内容的综合报告：
【第一部分】人格与兴趣画像分析
- 结合MBTI和霍兰德结果，分析用户的性格特质、职业兴趣倾向
- 指出这些特质在职业发展中的优势和潜在挑战
【第二部分】三条差异化5年职业发展路径
路径A（技术深耕路线）：在现有技术领域深入发展
路径B（管理晋升路线）：向管理岗位晋升
路径C（跨界转型路线）：结合MBTI/霍兰德优势转向新领域
每条路径需包含：
1. 分年度的关键里程碑（第1-2年/第3-4年/第5年分别标注）
2. 薪资预期范围（用表格展示）
3. 需要补充的2-3项核心能力
4. 1-2项主要风险
【第三部分】职业探索洞察
- 结合用户的MBTI/霍兰德类型和问卷回答，推荐3个可能适合但用户可能未考虑过的职业方向（避免常见职业）
- 每个职业附1-2句匹配理由
【第四部分】综合建议
- 推荐最合适的一条路径并阐述理由
- 给出3条具体的下一步行动建议
【输出格式要求】
1. 使用标准Markdown格式，标题只使用##和###级别
2. 禁止使用####或#####等四级以上标题
3. 列表使用-或数字编号
4. 表格使用标准的|分隔格式，第一行为表头，第二行为---|---分隔行
5. 禁止使用任何特殊符号（如####、***、->等）
6. 加粗使用**文本**格式，用于强调关键信息
7. 内容清晰、简洁、专业，避免冗余
8. 排版要求：每个部分用###标题分隔，要点用-列表，关键数据用**加粗**强调，薪资用表格展示`
      }
    ];
    const result = await callAI(messages);
    log(`AI调用成功，返回内容长度: ${result.length}`);
    res.json({ success: true, content: result });
  } catch (error) {
    logError(`综合分析失败: ${error.message}`);
    res.status(500).json({ error: error.message || 'AI调用失败，请稍后重试' });
  }
});
// 启动服务器（随机端口，支持多用户同时在线）
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(JSON.stringify({
    "type": "http_start",
    "port": port
  }));
  log(`服务启动成功，监听端口: ${port}`);
});
process.on("SIGINT", () => {
  log("收到SIGINT信号，服务优雅退出");
  console.log("Server shutdown complete");
  process.exit(0);
});