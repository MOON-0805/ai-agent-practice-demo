import subprocess
subprocess.run(["taskkill", "/f", "/im", "node.exe"], capture_output=True, shell=True)
print("已清理所有node进程")