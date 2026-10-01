import os, json, tempfile, pathlib, subprocess, pty, fcntl, termios, struct, time, select, re
repo=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path(tempfile.mkdtemp(prefix='pi-splash-check-'))
agent=root/'agent';agent.mkdir()
original={'defaultProvider':'keep-me','defaultModel':'keep-model','packages':['npm:unrelated','npm:pi-startup-header',{'source':'other','extensions':['a.ts']}],'custom':{'keep':True}}
(agent/'settings.json').write_text(json.dumps(original))
env={**os.environ,'PI_CODING_AGENT_DIR':str(agent),'XDG_STATE_HOME':str(root/'state')}
r=subprocess.run([str(repo/'scripts/install-splash.sh')],env=env,text=True,capture_output=True,check=True)
installed=json.loads((agent/'settings.json').read_text())
expected={**original,'packages':['npm:unrelated',{'source':'npm:pi-startup-header','extensions':[]},original['packages'][2]]}
assert installed==expected
assert json.loads(next((root/'state').rglob('settings.json')).read_text())==original
subprocess.run([str(repo/'scripts/install-splash.sh')],env=env,capture_output=True,check=True)
assert json.loads((agent/'settings.json').read_text())==expected
print('PASS: installer preserves other settings, backs up originals, and is idempotent')
# Test a fresh installation and local auto-discovery with no credentials or packages.
fresh=root/'fresh'
env['PI_CODING_AGENT_DIR']=str(fresh)
subprocess.run([str(repo/'scripts/install-splash.sh')],env=env,capture_output=True,check=True)
assert json.loads((fresh/'settings.json').read_text())=={}
(fresh/'pi-startup-header.json').write_text((repo/'pi/pi-startup-header.json').read_text())
master,slave=pty.openpty()
fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',32,100,0,0))
env.update(PI_OFFLINE='1',PI_TELEMETRY='0',TERM='xterm-256color',COLORTERM='truecolor')
env.pop('NO_COLOR',None);env.pop('PI_SPLASH_ANIMATION',None)
args=['pi','--offline','--no-skills','--no-prompt-templates','--no-context-files','--no-approve','--no-session']
p=subprocess.Popen(args,stdin=slave,stdout=slave,stderr=slave,env=env,cwd='/tmp',close_fds=True)
os.close(slave)
data=b'';end=time.monotonic()+4
while time.monotonic()<end:
 if select.select([master],[],[],0.05)[0]:
  try: data+=os.read(master,65536)
  except OSError: break
os.write(master,b'\x04')
try:p.wait(timeout=3)
except subprocess.TimeoutExpired:p.terminate();p.wait(timeout=3)
os.close(master)
raw=data.decode('utf8',errors='replace')
(root/'terminal.ansi').write_text(raw)
plain=re.sub(r'\x1b\[[0-9;?]*[A-Za-z]','',raw)
assert 'ready when you are' in plain,plain[-1500:]
assert 'Failed to load extension' not in plain
assert 'Extension error' not in plain
assert raw.count('\x1b[?2026h')>15,raw.count('\x1b[?2026h')
assert 'woshahua' in plain
assert '\x1b[38;2;211;198;170m' in raw
assert '\x1b[48;2;' in raw
version=subprocess.check_output(['pi','--version'],env=env,text=True).strip()
print('PASS: Pi',version,'auto-loads the extension and renders',raw.count('\x1b[?2026h'),'terminal frames with the saved colors')
print('Terminal recording:',root/'terminal.ansi')
