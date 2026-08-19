// ===== 主题切换 =====
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  }
}
// 初始化主题
(function() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
})();
// ===== 页面切换 =====
function showPage(page) {
  // 隐藏所有页面
  document.querySelectorAll('.page-container').forEach(el => el.classList.remove('active'));
  // 显示目标页面
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  // 更新导航
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');
  // 如果是综合分析页面，默认显示步骤1（基本信息）
  if (page === 'analysis') {
    // 如果用户之前没做过测试（没有mbtiType），显示步骤1
    if (!window.mbtiType) {
      goToStep(1);
    } else {
      // 如果用户已经完成测试，显示步骤5（AI分析）
      goToStep(5);
    }
  }
  // 关闭移动端侧边栏
  closeSidebar();
  // 滚动到顶部
  window.scrollTo(0, 0);
}
// 移动端侧边栏
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('mobileOverlay').classList.add('show');
});
document.getElementById('mobileOverlay').addEventListener('click', closeSidebar);
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('show');
}
// ===== 报告展示页面 =====
let currentReportType = 'analysis';
let currentReportContent = '';
let currentReportTitle = '';
// 显示报告页面
function showReport(type, content, title) {
  currentReportType = type;
  currentReportContent = content;
  currentReportTitle = title;
  document.getElementById('reportTitle').textContent = title;
  document.getElementById('reportContent').innerHTML = renderMarkdown(content);
  createExportButtons('exportButtons-report', () => currentReportContent, title);
  showPage('report');
  window.scrollTo(0, 0);
}
// 关闭报告页面，返回之前的功能页
function closeReport() {
  if (currentReportType === 'gap') {
    showPage('gap');
  } else {
    showPage('analysis');
    // 确保步骤5可见
    const step5 = document.getElementById('step5');
    if (step5) step5.style.display = 'block';
    document.querySelectorAll('.step-badge').forEach(badge => {
      const badgeStep = parseInt(badge.dataset.step);
      badge.classList.remove('active', 'done');
      if (badgeStep === 5) badge.classList.add('active');
      if (badgeStep < 5) badge.classList.add('done');
    });
  }
}
// 重新生成报告
async function regenerateReport() {
  const btn = document.getElementById('reportRegenBtn');
  const loading = document.getElementById('loadingOverlay-analysis');
  const errorBanner = document.getElementById('errorBanner-report');
  setLoading(btn, true, '重新生成中...');
  if (loading) loading.classList.add('show');
  if (errorBanner) errorBanner.classList.remove('show');
  try {
    let result;
    if (currentReportType === 'gap') {
      const resumeText = document.getElementById('resumeInput').value.trim();
      const jd = document.getElementById('jdInput').value.trim();
      const fileInput = document.getElementById('resumeFile');
      const formData = new FormData();
      if (fileInput.files[0]) {
        formData.append('resumeFile', fileInput.files[0]);
      }
      formData.append('resume', resumeText);
      formData.append('jd', jd);
      const response = await fetch('/api/gap-analysis', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '重新生成失败');
      result = data;
    } else {
      const age = document.getElementById('ageInput').value.trim();
      const industry = document.getElementById('industryInput').value.trim();
      const position = document.getElementById('positionInput').value.trim();
      const goal = document.getElementById('goalInput').value.trim();
      const skills = window.skills || [];
      const mbtiType = window.mbtiType;
      const mbtiAnswers = window.mbtiAnswers;
      const hollandAnswers = window.hollandAnswers;
      const radarAnswers = window.radarAnswers;
      result = await callAI('/api/comprehensive-analysis', {
        age, industry, position, skills, goal,
        mbtiType, mbtiAnswers, hollandAnswers, radarAnswers
      });
    }
    currentReportContent = result.content;
    document.getElementById('reportContent').innerHTML = renderMarkdown(result.content);
    createExportButtons('exportButtons-report', () => currentReportContent, currentReportTitle);
    showToast('报告已重新生成');
  } catch (error) {
    if (errorBanner) {
      errorBanner.textContent = error.message;
      errorBanner.classList.add('show');
    }
    showToast('重新生成失败: ' + error.message, 'error');
  } finally {
    setLoading(btn, false);
    if (loading) loading.classList.remove('show');
  }
}
// ===== 文件上传 =====
function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const uploadDiv = document.getElementById('fileUpload');
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['docx', 'pdf', 'txt'].includes(ext)) {
    showErrorGap('不支持的文件格式，请上传Word(.docx)或PDF文件');
    input.value = '';
    return;
  }
  uploadDiv.classList.add('has-file');
  uploadDiv.querySelector('.upload-text').innerHTML = 
    `<strong>✅ ${file.name}</strong><br>${(file.size / 1024 / 1024).toFixed(2)}MB`;
}
// 点击文件上传区域触发文件选择
document.addEventListener('DOMContentLoaded', function() {
  const uploadDiv = document.getElementById('fileUpload');
  if (uploadDiv) {
    uploadDiv.addEventListener('click', function() {
      document.getElementById('resumeFile').click();
    });
  }
});
// ===== 差距分析 =====
function showErrorGap(msg) {
  const banner = document.getElementById('errorBanner-gap');
  banner.textContent = msg;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 5000);
}
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  console.log('[前端调试] 点击了【开始分析】按钮');
  const fileInput = document.getElementById('resumeFile');
  const resumeText = document.getElementById('resumeInput').value.trim();
  const jd = document.getElementById('jdInput').value.trim();
  if (!fileInput.files[0] && !resumeText) {
    showErrorGap('请上传简历文件或粘贴简历内容');
    return;
  }
  if (!jd) {
    showErrorGap('请填写目标岗位JD');
    return;
  }
  const btn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loadingOverlay-gap');
  setLoading(btn, true, '分析中...');
  loading.classList.add('show');
  try {
    const formData = new FormData();
    if (fileInput.files[0]) {
      formData.append('resumeFile', fileInput.files[0]);
    }
    formData.append('resume', resumeText);
    formData.append('jd', jd);
    console.log('[前端调试] 发送差距分析请求...');
    const response = await fetch('/api/gap-analysis', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    console.log('[前端调试] 差距分析响应:', result.success ? '成功' : '失败');
    if (!response.ok) {
      throw new Error(result.error || '分析失败');
    }
    showReport('gap', result.content, '📊 差距分析报告');
  } catch (error) {
    console.error('[前端调试] 差距分析失败:', error.message);
    showErrorGap(error.message);
  } finally {
    setLoading(btn, false);
    loading.classList.remove('show');
  }
});
// ===== MBTI测试 =====
const mbtiQuestions = [
  { q: '在聚会或社交场合中，你通常？', options: [{ label: 'E', text: '喜欢与人交谈，精力充沛' }, { label: 'I', text: '更喜欢安静观察或与少数人交流' }] },
  { q: '做决定时，你更倾向于？', options: [{ label: 'S', text: '基于事实和实际经验' }, { label: 'N', text: '基于直觉和可能性' }] },
  { q: '面对问题时，你更看重？', options: [{ label: 'T', text: '逻辑分析和客观标准' }, { label: 'F', text: '他人感受和价值观' }] },
  { q: '你的生活方式更偏向？', options: [{ label: 'J', text: '有计划、有条理、喜欢确定性' }, { label: 'P', text: '灵活应变、随遇而安' }] },
  { q: '周末你更想？', options: [{ label: 'E', text: '约朋友出去玩' }, { label: 'I', text: '在家独处充电' }] },
  { q: '学习新知识时，你更喜欢？', options: [{ label: 'S', text: '从具体例子和实操入手' }, { label: 'N', text: '先理解概念和理论框架' }] },
  { q: '当朋友向你倾诉时，你更常？', options: [{ label: 'T', text: '帮他们分析问题、给建议' }, { label: 'F', text: '先共情，理解他们的感受' }] },
  { q: '对于即将到来的旅行，你？', options: [{ label: 'J', text: '提前做好详细行程计划' }, { label: 'P', text: '随性出发，边走边看' }] },
  { q: '在工作中，你更喜欢？', options: [{ label: 'E', text: '团队合作，头脑风暴' }, { label: 'I', text: '独立专注地完成任务' }] },
  { q: '你更关注？', options: [{ label: 'S', text: '当下的实际情况' }, { label: 'N', text: '未来的发展趋势' }] },
  { q: '当意见不合时，你倾向于？', options: [{ label: 'T', text: '据理力争，讲清逻辑' }, { label: 'F', text: '照顾气氛，缓和矛盾' }] },
  { q: '你的工作桌通常是？', options: [{ label: 'J', text: '整洁有序，物品位置固定' }, { label: 'P', text: '有些凌乱但自己找得到' }] },
  { q: '你更喜欢哪种沟通方式？', options: [{ label: 'E', text: '边想边说，边说边理清思路' }, { label: 'I', text: '想清楚再说，表达更精炼' }] },
  { q: '看新闻时，你更关注？', options: [{ label: 'S', text: '具体事件和细节' }, { label: 'N', text: '背后的原因和趋势' }] },
  { q: '评价一个人时，你更看重？', options: [{ label: 'T', text: '能力和做事效率' }, { label: 'F', text: '人品和相处感受' }] },
  { q: '面对突发变化，你？', options: [{ label: 'J', text: '感到不安，希望恢复秩序' }, { label: 'P', text: '觉得刺激，灵活应对' }] },
  { q: '你更喜欢？', options: [{ label: 'E', text: '成为焦点，发表观点' }, { label: 'I', text: '在幕后默默贡献' }] },
  { q: '解决问题时，你更依赖？', options: [{ label: 'S', text: '已验证的方法和经验' }, { label: 'N', text: '创新的思路和灵感' }] },
  { q: '你更在意？', options: [{ label: 'T', text: '事情是否公平合理' }, { label: 'F', text: '大家是否和谐愉快' }] },
  { q: '你的时间管理风格是？', options: [{ label: 'J', text: '提前安排，按计划执行' }, { label: 'P', text: '灵活机动，随需调整' }] }
];
let mbtiCurrent = 0;
let mbtiAnswers = new Array(20).fill(null);
function goToStep(step) {
  if (step === 2) {
    const age = document.getElementById('ageInput').value.trim();
    const industry = document.getElementById('industryInput').value.trim();
    const position = document.getElementById('positionInput').value.trim();
    const skills = window.skills || [];
    if (!age || !industry || !position) {
      showErrorAnalysis('请填写年龄、行业和当前岗位');
      return;
    }
    if (skills.length < 3) {
      showErrorAnalysis('请至少添加3项核心技能');
      return;
    }
  }
  document.querySelectorAll('#page-analysis .card').forEach(el => {
    if (!el.closest('#resultArea-analysis')) {
      el.style.display = 'none';
    }
  });
  const target = document.getElementById('step' + step);
  if (target) target.style.display = 'block';
  document.querySelectorAll('.step-badge').forEach(badge => {
    const badgeStep = parseInt(badge.dataset.step);
    badge.classList.remove('active', 'done');
    if (badgeStep === step) badge.classList.add('active');
    if (badgeStep < step) badge.classList.add('done');
  });
  if (step === 2) renderMbtiQuestion();
  if (step === 3) renderHollandQuestion();
  if (step === 4) renderRadarQuestion();
  if (step === 5) renderAnalysisResult();
}
function showErrorAnalysis(msg) {
  const banner = document.getElementById('errorBanner-analysis');
  banner.textContent = msg;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 5000);
}
// MBTI渲染
function renderMbtiQuestion() {
  const q = mbtiQuestions[mbtiCurrent];
  document.getElementById('mbtiQuestion').textContent = q.q;
  document.getElementById('mbtiProgress').textContent = `第 ${mbtiCurrent + 1}/20 题`;
  document.getElementById('mbtiProgressFill').style.width = `${((mbtiCurrent + 1) / 20) * 100}%`;
  const optionsDiv = document.getElementById('mbtiOptions');
  optionsDiv.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const div = document.createElement('div');
    div.className = 'test-option' + (mbtiAnswers[mbtiCurrent] === opt.label ? ' selected' : '');
    div.innerHTML = `<span class="option-label">${opt.label}</span><span class="option-text">${opt.text}</span>`;
    div.onclick = () => {
      mbtiAnswers[mbtiCurrent] = opt.label;
      renderMbtiQuestion();
    };
    optionsDiv.appendChild(div);
  });
  document.getElementById('mbtiNextBtn').textContent = mbtiCurrent === 19 ? '完成测试 →' : '下一题 →';
  document.getElementById('mbtiPrevBtn').style.visibility = mbtiCurrent === 0 ? 'hidden' : 'visible';
}
function mbtiNext() {
  if (!mbtiAnswers[mbtiCurrent]) {
    showErrorAnalysis('请先选择一个选项');
    return;
  }
  if (mbtiCurrent < 19) {
    mbtiCurrent++;
    renderMbtiQuestion();
  } else {
    const result = calculateMbti();
    window.mbtiType = result.type;
    window.mbtiAnswers = mbtiAnswers;
    mbtiCurrent = 0;
    mbtiAnswers = new Array(20).fill(null);
    goToStep(3);
  }
}
function mbtiPrev() {
  if (mbtiCurrent > 0) {
    mbtiCurrent--;
    renderMbtiQuestion();
  }
}
function calculateMbti() {
  let e = 0, i = 0, s = 0, n = 0, t = 0, f = 0, j = 0, p = 0;
  mbtiAnswers.forEach((ans, idx) => {
    if (idx % 4 === 0) { if (ans === 'E') e++; else i++; }
    if (idx % 4 === 1) { if (ans === 'S') s++; else n++; }
    if (idx % 4 === 2) { if (ans === 'T') t++; else f++; }
    if (idx % 4 === 3) { if (ans === 'J') j++; else p++; }
  });
  const type = 
    (e >= i ? 'E' : 'I') +
    (s >= n ? 'S' : 'N') +
    (t >= f ? 'T' : 'F') +
    (j >= p ? 'J' : 'P');
  return { type };
}
// ===== 霍兰德测试 =====
const hollandQuestions = [
  { q: '你更喜欢做以下哪种事情？', options: [{ label: 'R', text: '动手修理、组装或操作机械/工具' }, { label: 'I', text: '研究问题、做实验或分析数据' }] },
  { q: '在空闲时间，你更愿意？', options: [{ label: 'A', text: '创作、绘画、写作或表演' }, { label: 'S', text: '帮助他人、做志愿者或教学' }] },
  { q: '在工作中，你更喜欢？', options: [{ label: 'E', text: '领导团队、说服他人或做决策' }, { label: 'C', text: '整理数据、做记录或按流程办事' }] },
  { q: '下列哪种活动让你更有成就感？', options: [{ label: 'R', text: '完成一件实际的手工/技术作品' }, { label: 'A', text: '完成一件有创意的作品' }] },
  { q: '你更倾向于选择哪种工作环境？', options: [{ label: 'I', text: '实验室、研究机构或技术部门' }, { label: 'E', text: '商业环境、会议室或管理岗位' }] },
  { q: '你更擅长或更享受？', options: [{ label: 'S', text: '倾听他人、提供帮助和支持' }, { label: 'C', text: '整理信息、确保事情有序进行' }] }
];
let hollandCurrent = 0;
let hollandAnswers = [];
function renderHollandQuestion() {
  const q = hollandQuestions[hollandCurrent];
  document.getElementById('hollandQuestion').textContent = q.q;
  document.getElementById('hollandProgress').textContent = `第 ${hollandCurrent + 1}/6 题`;
  document.getElementById('hollandProgressFill').style.width = `${((hollandCurrent + 1) / 6) * 100}%`;
  const optionsDiv = document.getElementById('hollandOptions');
  optionsDiv.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const div = document.createElement('div');
    div.className = 'test-option' + (hollandAnswers[hollandCurrent] === opt.label ? ' selected' : '');
    div.innerHTML = `<span class="option-label">${opt.label}</span><span class="option-text">${opt.text}</span>`;
    div.onclick = () => {
      hollandAnswers[hollandCurrent] = opt.label;
      renderHollandQuestion();
    };
    optionsDiv.appendChild(div);
  });
  document.getElementById('hollandNextBtn').textContent = hollandCurrent === 5 ? '完成测试 →' : '下一题 →';
  document.getElementById('hollandPrevBtn').style.visibility = hollandCurrent === 0 ? 'hidden' : 'visible';
}
function hollandNext() {
  if (!hollandAnswers[hollandCurrent]) {
    showErrorAnalysis('请先选择一个选项');
    return;
  }
  if (hollandCurrent < 5) {
    hollandCurrent++;
    renderHollandQuestion();
  } else {
    window.hollandAnswers = hollandAnswers;
    hollandCurrent = 0;
    hollandAnswers = [];
    goToStep(4);
  }
}
function hollandPrev() {
  if (hollandCurrent > 0) {
    hollandCurrent--;
    renderHollandQuestion();
  }
}
// ===== 职业探索问卷 =====
const radarQuestions = [
  '回顾你过去的工作或学习经历，哪一件事让你最有成就感？为什么？',
  '你身边的朋友或同事，最常夸你的一项能力是什么？',
  '如果完全不考虑赚钱，你最想做的一件事或一个职业是什么？',
  '你觉得你自己最擅长但觉得"不太值钱"的技能是什么？（比如特别会安慰人、特别会整理、特别会砍价等）',
  '用三个词形容你理想中的工作状态（比如：自由、创造、助人）'
];
let radarCurrent = 0;
let radarAnswers = [];
function renderRadarQuestion() {
  document.getElementById('radarQuestion').textContent = radarQuestions[radarCurrent];
  document.getElementById('radarProgress').textContent = `第 ${radarCurrent + 1}/5 题`;
  document.getElementById('radarProgressFill').style.width = `${((radarCurrent + 1) / 5) * 100}%`;
  document.getElementById('radarAnswer').value = radarAnswers[radarCurrent] || '';
  document.getElementById('radarNextBtn').textContent = radarCurrent === 4 ? '完成问卷 →' : '下一题 →';
  document.getElementById('radarPrevBtn').style.visibility = radarCurrent === 0 ? 'hidden' : 'visible';
}
function radarNext() {
  const answer = document.getElementById('radarAnswer').value.trim();
  if (!answer) {
    showErrorAnalysis('请先回答问题');
    return;
  }
  radarAnswers[radarCurrent] = answer;
  if (radarCurrent < 4) {
    radarCurrent++;
    renderRadarQuestion();
  } else {
    window.radarAnswers = radarAnswers;
    radarCurrent = 0;
    radarAnswers = [];
    goToStep(5);
  }
}
function radarPrev() {
  radarAnswers[radarCurrent] = document.getElementById('radarAnswer').value.trim();
  if (radarCurrent > 0) {
    radarCurrent--;
    renderRadarQuestion();
  }
}
// ===== 步骤5：结果显示 =====
function renderAnalysisResult() {
  const container = document.getElementById('analysisResult');
  const mbtiNames = {
    'INTJ': '建筑师型', 'INTP': '逻辑学家型', 'ENTJ': '指挥官型', 'ENTP': '辩论家型',
    'INFJ': '提倡者型', 'INFP': '调停者型', 'ENFJ': '主人公型', 'ENFP': '竞选者型',
    'ISTJ': '物流师型', 'ISFJ': '守卫者型', 'ESTJ': '总经理型', 'ESFJ': '执政官型',
    'ISTP': '鉴赏家型', 'ISFP': '探险家型', 'ESTP': '企业家型', 'ESFP': '表演者型'
  };
  const hollandNames = { 'R': '现实型', 'I': '研究型', 'A': '艺术型', 'S': '社会型', 'E': '企业型', 'C': '常规型' };
  const mbtiType = window.mbtiType || '未知';
  const hollandCode = (window.hollandAnswers || []).slice(0, 3).join('');
  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
      <div class="test-result-card">
        <div class="result-type">${mbtiType}</div>
        <div class="result-name">${mbtiNames[mbtiType] || 'MBTI人格'}</div>
        <div class="result-desc">你的MBTI人格类型</div>
      </div>
      <div class="test-result-card">
        <div class="result-type">${hollandCode}</div>
        <div class="result-name">${hollandCode.split('').map(c => hollandNames[c] || c).join(' · ')}</div>
        <div class="result-desc">你的霍兰德职业兴趣类型</div>
      </div>
    </div>
    <div style="text-align:center; color:#95A5A6; font-size:0.9rem; margin-bottom: 15px;">
      以上测试结果将作为AI分析的依据，帮助你获得更精准的职业建议
    </div>
  `;
}
// ===== 运行AI分析 =====
console.log('[前端调试] 正在绑定【开始AI分析】按钮事件...');
const runBtn = document.getElementById('runAnalysisBtn');
if (runBtn) {
  console.log('[前端调试] ✅ 找到【开始AI分析】按钮');
  runBtn.addEventListener('click', async () => {
    console.log('[前端调试] 点击了【开始AI分析】按钮');
    const age = document.getElementById('ageInput').value.trim();
    const industry = document.getElementById('industryInput').value.trim();
    const position = document.getElementById('positionInput').value.trim();
    const goal = document.getElementById('goalInput').value.trim();
    const skills = window.skills || [];
    const mbtiType = window.mbtiType;
    const mbtiAnswers = window.mbtiAnswers;
    const hollandAnswers = window.hollandAnswers;
    const radarAnswers = window.radarAnswers;
    console.log('[前端调试] 参数检查: mbtiType=' + mbtiType + ', hollandAnswers=' + (hollandAnswers ? hollandAnswers.length : 0) + ', radarAnswers=' + (radarAnswers ? radarAnswers.length : 0));
    if (!mbtiType || !hollandAnswers || !radarAnswers) {
      console.error('[前端调试] ❌ 测试数据不完整');
      showErrorAnalysis('请完成所有测试步骤');
      return;
    }
    const btn = document.getElementById('runAnalysisBtn');
    const loading = document.getElementById('loadingOverlay-analysis');
    setLoading(btn, true, '分析中...');
    loading.classList.add('show');
    try {
      console.log('[前端调试] 发送综合分析请求...');
      const result = await callAI('/api/comprehensive-analysis', {
        age, industry, position, skills, goal,
        mbtiType, mbtiAnswers, hollandAnswers, radarAnswers
      });
      console.log('[前端调试] ✅ 综合分析成功，内容长度: ' + result.content.length);
      showReport('analysis', result.content, '🚀 职业综合分析报告');
    } catch (error) {
      console.error('[前端调试] ❌ 综合分析失败:', error.message);
      showErrorAnalysis(error.message);
    } finally {
      setLoading(btn, false);
      loading.classList.remove('show');
    }
  });
} else {
  console.error('[前端调试] ❌ 找不到【开始AI分析】按钮！');
}
// ===== 技能标签 =====
const skillContainer = document.getElementById('skillContainer');
const skillInput = document.getElementById('skillInput');
window.skills = [];
skillInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const value = skillInput.value.trim();
    if (value && !window.skills.includes(value)) {
      window.skills.push(value);
      renderSkills();
    }
    skillInput.value = '';
  }
});
function renderSkills() {
  const oldTags = skillContainer.querySelectorAll('.skill-tag');
  oldTags.forEach(tag => tag.remove());
  window.skills.forEach((skill, index) => {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.innerHTML = `${skill} <span class="remove" data-index="${index}">×</span>`;
    skillContainer.insertBefore(tag, skillInput);
  });
  skillContainer.querySelectorAll('.remove').forEach(remove => {
    remove.addEventListener('click', () => {
      window.skills.splice(parseInt(remove.dataset.index), 1);
      renderSkills();
    });
  });
}