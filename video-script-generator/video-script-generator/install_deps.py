import subprocess
import os
base_dir = r"D:\aipy_work\108\video-script-generator"
os.chdir(base_dir)
# 检查node和npm
r1 = subprocess.run(["node", "--version"], capture_output=True, text=True, shell=True)
r2 = subprocess.run(["npm", "--version"], capture_output=True, text=True, shell=True)
print(f"Node: {r1.stdout.strip()}, npm: {r2.stdout.strip()}")
# 安装依赖
r3 = subprocess.run(["npm", "install"], capture_output=True, text=True, shell=True, timeout=180)
print("STDOUT:", r3.stdout[-800:])
print("STDERR:", r3.stderr[-800:])
print("RC:", r3.returncode)