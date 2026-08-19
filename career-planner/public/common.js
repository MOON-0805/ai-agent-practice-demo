// 公共工具函数
// 显示错误提示
function showError(message) {
  const banner = document.getElementById('errorBanner');
  if (banner) {
    banner.textContent = message;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 5000);
  }
}
// 显示成功提示
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
    max-width: 300px;
    word-break: break-all;
  `;
  if (type === 'success') {
    toast.style.background = '#27AE60';
    toast.style.color = '#fff';
    toast.textContent = '✅ ' + message;
  } else if (type === 'error') {
    toast.style.background = '#D32F2F';
    toast.style.color = '#fff';
    toast.textContent = '❌ ' + message;
  } else {
    toast.style.background = '#4A90D9';
    toast.style.color = '#fff';
    toast.textContent = 'ℹ️ ' + message;
  }
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(50px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);
// 显示/隐藏加载状态
function setLoading(button, isLoading, loadingText = '处理中...') {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}
// 复制文本到剪贴板
async function copyToClipboard(text, button) {
  if (!text) {
    showToast('没有可复制的内容', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const originalText = button.textContent;
      button.textContent = '✅ 已复制';
      setTimeout(() => button.textContent = originalText, 2000);
    }
    showToast('已复制到剪贴板');
  } catch (err) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ 已复制';
        setTimeout(() => button.textContent = originalText, 2000);
      }
      showToast('已复制到剪贴板');
    } catch (e) {
      showToast('复制失败，请手动选择复制', 'error');
    }
  }
}
// 调用AI接口的通用函数
async function callAI(endpoint, data) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    if (!response.ok) {
      const errorMatch = text.match(/<pre>([^<]*)<\/pre>/);
      const errorMsg = errorMatch ? errorMatch[1].trim() : `服务器返回错误(${response.status})`;
      throw new Error(errorMsg);
    }
    throw new Error('服务器返回了无法解析的响应');
  }
  if (!response.ok) {
    throw new Error(result.error || `请求失败(${response.status})`);
  }
  return result;
}
// ===== Markdown渲染（支持图表、多级标题、真正的表格、标题美化） =====
function renderMarkdown(markdown) {
  if (!markdown) return '';
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // 收集图表数据
  window._pendingCharts = [];
  // 处理图表标记（用占位符避免换行处理破坏canvas）
  html = html.replace(/\[CHART:(radar|bar)\]\n?([\s\S]*?)\[\/CHART\]/g, function(match, type, dataStr) {
    const lines = dataStr.trim().split('\n').filter(l => l.trim() !== '');
    const labels = [];
    const values = [];
    lines.forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        labels.push(parts[0]);
        values.push(parseFloat(parts[1]) || 0);
      }
    });
    if (labels.length === 0) return '';
    const chartId = 'chart_' + Math.random().toString(36).substr(2, 9);
    window._pendingCharts.push({ id: chartId, type: type, labels: labels, values: values });
    return `__CHART_PLACEHOLDER_${chartId}__`;
  });
  // 处理表格
  const tableRegex = /((?:\|.*\|\n?)+)/g;
  html = html.replace(tableRegex, function(tableBlock) {
    const lines = tableBlock.trim().split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return tableBlock;
    const rows = lines.map(line => {
      return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    });
    const secondRow = rows[1];
    const isSeparator = secondRow && secondRow.every(c => /^[-:]+$/.test(c));
    if (isSeparator) {
      const headerCells = rows[0];
      const dataRows = rows.slice(2);
      let tableHtml = '<table><thead><tr>';
      headerCells.forEach(cell => { tableHtml += `<th>${cell}</th>`; });
      tableHtml += '</tr></thead>';
      if (dataRows.length > 0) {
        tableHtml += '<tbody>';
        dataRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach(cell => { tableHtml += `<td>${cell}</td>`; });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody>';
      }
      tableHtml += '</table>';
      return tableHtml;
    }
    let tableHtml = '<table><tbody>';
    rows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach(cell => { tableHtml += `<td>${cell}</td>`; });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  });
  // 处理标题（美化：带背景色和边框）
  html = html
    .replace(/^##### (.*)$/gm, '<h5 class="md-h5">$1</h5>')
    .replace(/^#### (.*)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^### (.*)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="md-h1">$1</h1>');
  // 加粗
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '$1');
  // 引用
  html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  // 列表
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  // 代码
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 分割线
  html = html.replace(/^---+$/gm, '<hr>');
  // 清理残留符号
  html = html.replace(/^#{1,6}\s*/gm, '');
  // 处理换行
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  // 包裹段落
  if (!html.startsWith('<h1') && !html.startsWith('<h2') && !html.startsWith('<h3') && !html.startsWith('<h4') && !html.startsWith('<h5') && !html.startsWith('<table>') && !html.startsWith('<ul>') && !html.startsWith('<pre>') && !html.startsWith('<div')) {
    html = '<p>' + html + '</p>';
  }
  // 将占位符替换为实际图表HTML
  html = html.replace(/__CHART_PLACEHOLDER_(\w+)__/g, function(match, chartId) {
    const chartData = window._pendingCharts.find(c => c.id === chartId);
    if (!chartData) return '';
    const chartWidth = chartData.type === 'radar' ? '600px' : '700px';
    return `
      <div class="chart-container" style="margin: 25px auto; text-align: center; padding: 15px; background: #fff; border: 1px solid #E8F2FC; border-radius: 8px;">
        <canvas id="${chartId}" style="max-width: ${chartWidth}; width: 100%; margin: 0 auto; height: 400px;"></canvas>
      </div>
    `;
  });
  // 渲染图表
  setTimeout(renderPendingCharts, 200);
  return html;
}
// 渲染所有待渲染的图表
function renderPendingCharts() {
  if (!window._pendingCharts || window._pendingCharts.length === 0) return;
  if (typeof Chart === 'undefined') {
    console.error('[前端调试] Chart.js 未加载！');
    return;
  }
  window._pendingCharts.forEach(chartData => {
    const ctx = document.getElementById(chartData.id);
    if (!ctx) return;
    try {
      const isRadar = chartData.type === 'radar';
      const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { size: 14 } } }
        }
      };
      if (isRadar) {
        options.scales = {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20, font: { size: 14 }, backdropColor: 'transparent' },
            pointLabels: { font: { size: 16, weight: '700' }, color: '#2C3E50' },
            grid: { color: 'rgba(74, 144, 217, 0.15)' },
            angleLines: { color: 'rgba(74, 144, 217, 0.15)' }
          }
        };
      } else {
        options.scales = {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 14 } },
            grid: { color: 'rgba(74, 144, 217, 0.1)' }
          },
          x: {
            ticks: { font: { size: 14, weight: '600' } },
            grid: { display: false }
          }
        };
      }
      new Chart(ctx, {
        type: isRadar ? 'radar' : 'bar',
        data: {
          labels: chartData.labels,
          datasets: [{
            label: isRadar ? '能力评分' : '薪资预期（万元/年）',
            data: chartData.values,
            backgroundColor: 'rgba(74, 144, 217, 0.2)',
            borderColor: 'rgba(74, 144, 217, 1)',
            borderWidth: isRadar ? 3 : 2,
            pointBackgroundColor: 'rgba(74, 144, 217, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: isRadar ? 6 : 4,
            fill: true
          }]
        },
        options: options
      });
      console.log('[前端调试] ✅ 图表渲染成功: ' + chartData.id);
    } catch (e) {
      console.error('[前端调试] ❌ 图表渲染失败:', e.message);
    }
  });
  window._pendingCharts = [];
}
// ===== 导出功能 =====
function exportMarkdown(content, filename = '职业分析报告.md') {
  if (!content) { showToast('没有可导出的内容', 'error'); return; }
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
    showToast('Markdown文件已导出');
  } catch (e) { showToast('导出失败: ' + e.message, 'error'); }
}
function exportWord(content, title = '职业分析报告') {
  if (!content) { showToast('没有可导出的内容', 'error'); return; }
  try {
    const htmlContent = renderMarkdown(content);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 30px; line-height: 1.8; color: #333; font-size: 14px; }
    h1 { color: #4A90D9; font-size: 20px; border-bottom: 2px solid #4A90D9; padding-bottom: 8px; }
    h2 { color: #4A90D9; font-size: 17px; margin-top: 20px; }
    h3 { color: #4A90D9; font-size: 15px; margin-top: 15px; }
    h4 { color: #4A90D9; font-size: 14px; margin-top: 12px; }
    h5 { color: #4A90D9; font-size: 13px; margin-top: 10px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #D0E4F7; padding: 8px 10px; text-align: left; font-size: 13px; }
    th { background: #E8F2FC; color: #4A90D9; font-weight: 600; }
    ul, ol { padding-left: 20px; }
    li { margin: 4px 0; }
    strong { color: #2C3E50; }
    blockquote { border-left: 4px solid #4A90D9; padding-left: 12px; color: #666; margin: 8px 0; }
    hr { border: none; border-top: 1px solid #D0E4F7; margin: 15px 0; }
    code { background: #F0F7FF; padding: 2px 5px; border-radius: 3px; font-size: 12px; }
    pre { background: #F8FBFF; padding: 12px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    .chart-container { margin: 20px auto; text-align: center; }
    .chart-container canvas { max-width: 600px; width: 100%; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    downloadBlob(blob, title + '.doc');
    showToast('Word文件已导出');
  } catch (e) { showToast('导出失败: ' + e.message, 'error'); }
}
function exportPDF(content, title = '职业分析报告') {
  if (!content) { showToast('没有可导出的内容', 'error'); return; }
  try {
    const htmlContent = renderMarkdown(content);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { margin: 20mm; }
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 20px; line-height: 1.8; color: #333; font-size: 13px; }
    h1 { color: #4A90D9; font-size: 18px; border-bottom: 2px solid #4A90D9; padding-bottom: 6px; }
    h2 { color: #4A90D9; font-size: 15px; margin-top: 18px; }
    h3 { color: #4A90D9; font-size: 13px; margin-top: 12px; }
    h4 { color: #4A90D9; font-size: 12px; margin-top: 10px; }
    h5 { color: #4A90D9; font-size: 11px; margin-top: 8px; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    th, td { border: 1px solid #D0E4F7; padding: 6px 8px; text-align: left; font-size: 12px; }
    th { background: #E8F2FC; color: #4A90D9; font-weight: 600; }
    ul, ol { padding-left: 20px; }
    li { margin: 3px 0; }
    strong { color: #2C3E50; }
    blockquote { border-left: 4px solid #4A90D9; padding-left: 10px; color: #666; margin: 6px 0; }
    hr { border: none; border-top: 1px solid #D0E4F7; margin: 12px 0; }
    code { background: #F0F7FF; padding: 2px 4px; border-radius: 3px; font-size: 11px; }
    pre { background: #F8FBFF; padding: 10px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    .chart-container { margin: 20px auto; text-align: center; }
    .chart-container canvas { max-width: 600px; width: 100%; }
  </style>
</head>
<body>
  ${htmlContent}
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 500); };
  <\/script>
</body>
</html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      showToast('PDF打印窗口已打开，请选择"另存为PDF"');
    } else {
      showToast('请允许弹出窗口以导出PDF', 'error');
    }
  } catch (e) { showToast('导出失败: ' + e.message, 'error'); }
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// 创建导出按钮组
function createExportButtons(containerId, getContent, title) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="export-buttons">
      <button class="btn btn-secondary btn-sm" id="${containerId}-copy">📋 一键复制</button>
      <button class="btn btn-secondary btn-sm" id="${containerId}-md">📄 导出MD</button>
      <button class="btn btn-secondary btn-sm" id="${containerId}-word">📝 导出Word</button>
      <button class="btn btn-secondary btn-sm" id="${containerId}-pdf">📕 导出PDF</button>
    </div>
  `;
  document.getElementById(`${containerId}-copy`).addEventListener('click', function() {
    copyToClipboard(getContent(), this);
  });
  document.getElementById(`${containerId}-md`).addEventListener('click', function() {
    exportMarkdown(getContent(), title + '.md');
  });
  document.getElementById(`${containerId}-word`).addEventListener('click', function() {
    exportWord(getContent(), title);
  });
  document.getElementById(`${containerId}-pdf`).addEventListener('click', function() {
    exportPDF(getContent(), title);
  });
}