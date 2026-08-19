import subprocess, os, time, requests, json, re
base_dir = r"D:\aipy_work\108\video-script-generator"
os.chdir(base_dir)
# 启动服务
proc = subprocess.Popen(
    ["node", "server.js"],
    cwd=base_dir,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    shell=True,
    text=True
)
time.sleep(3)
# 读取输出
stdout_data = proc.stdout.read(1024) if proc.stdout else ""
print("=== 服务器输出 ===")
print(stdout_data)
# 解析端口
port = None
match = re.search(r'"port":\s*(\d+)', stdout_data)
if match:
    port = int(match.group(1))
    print(f"\n✅ 获取到随机端口: {port}")
else:
    print("⚠️ 未解析到端口")
    port = 3000
# 测试首页
print("\n📝 测试1：访问首页")
try:
    resp = requests.get(f"http://localhost:{port}", timeout=5)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print(f"  ✅ 首页访问成功！页面大小: {len(resp.text)} 字节")
        # 检查页面关键元素
        if "爆款短视频脚本生成器" in resp.text:
            print("  ✅ 页面标题正确")
        if "generateScript" in resp.text:
            print("  ✅ 生成脚本功能存在")
        if "exportWord" in resp.text:
            print("  ✅ 导出Word功能存在")
        if "themeToggle" in resp.text:
            print("  ✅ 主题切换功能存在")
        if "scriptTabs" in resp.text:
            print("  ✅ 三种脚本标签存在")
    else:
        print(f"  ❌ 首页访问失败")
except Exception as e:
    print(f"  ❌ 首页访问异常: {e}")
proc.terminate()
time.sleep(1)
subprocess.run(["taskkill", "/f", "/im", "node.exe"], capture_output=True, shell=True)
print("\n✅ 随机端口和首页测试完成")