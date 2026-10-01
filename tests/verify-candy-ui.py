import os, json, tempfile, pathlib, subprocess, pty, fcntl, termios, struct, time, select, signal
repo = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path(tempfile.mkdtemp(prefix='pi-candy-check-'))
agent = root/'agent'; agent.mkdir()
(agent/'settings.json').write_text('{"quietStartup":true}')
report = root/'report.jsonl'
env = {**{key: os.environ[key] for key in ['PATH','HOME','LANG','LC_CTYPE'] if key in os.environ},
       'PI_CODING_AGENT_DIR':str(agent), 'CANDY_UI_REPORT':str(report),
       'PI_OFFLINE':'1', 'PI_TELEMETRY':'0', 'TERM':'xterm-256color', 'COLORTERM':'truecolor'}
env.pop('NO_COLOR', None)
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH',40,100,0,0))
args = ['pi','--offline','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-session',
        '-e',str(repo/'pi/extensions/candy-ui/index.ts'),'-e',str(repo/'pi/extensions/pi-splash/index.ts'),
        '-e',str(pathlib.Path.home()/'.pi/agent/extensions/tmustier-pi-extensions/raw-paste/index.ts'),
        '-e',str(repo/'tests/fixtures/candy-ui.ts'),'--provider','candy-test','--model','one']
p = subprocess.Popen(args,stdin=slave,stdout=slave,stderr=slave,env=env,cwd='/tmp',close_fds=True)
os.close(slave)
data = bytearray()
def collect(seconds=.35):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        if select.select([master],[],[],.05)[0]:
            try: data.extend(os.read(master,65536))
            except OSError: break

def send(text, seconds=.35):
    os.write(master,text.encode()); collect(seconds)

def resize(rows, columns):
    fcntl.ioctl(master,termios.TIOCSWINSZ,struct.pack('HHHH',rows,columns,0,0))
    p.send_signal(signal.SIGWINCH); collect(.5)

def snapshot():
    send('\x1bj')
    return json.loads(report.read_text().splitlines()[-1])

def model_frames():
    return [json.loads(line) for line in pathlib.Path(str(report)+'.models.jsonl').read_text().splitlines()]
try:
    collect(3)
    assert report.exists(), data.decode(errors='replace')[-5000:]
    checks = json.loads(report.read_text().splitlines()[0])
    assert 'checks' in checks, report.read_text()
    send('/editor-probe\r')
    assert 'editor' in json.loads(report.read_text().splitlines()[-1]),report.read_text()
    send('/paste\r')
    pasted = ('原样粘贴 中文 ' + 'abc ' * 20 + '\n') * 24
    send('\x1b[200~' + pasted[:700]); send(pasted[700:] + '\x1b[201~')
    assert snapshot()['draft']==pasted, 'Raw paste was collapsed or lost'
    send('\x1bk'); send('/candy off\r'); send('/paste\r')
    send('\x1b[200~恢复原样粘贴\n第二行\x1b[201~')
    assert snapshot()['draft']=='恢复原样粘贴\n第二行'
    send('\x1bk'); send('/candy on\r', 1)
    send('\x1bo')
    send('/model\r', 1)
    frames = model_frames()
    assert len({len(frame['lines']) for frame in frames}) > 5, 'Native /model did not unfold'
    assert all('╭' in frame['lines'][0] for frame in frames), 'Native /model has no Candy frame'
    assert all(sum(line.count('\x1b_pi:c') for line in frame['lines']) == 1 for frame in frames)
    send('NoSuchModel'); send('\r')
    assert 'No matching models' in data.decode(errors='replace'), 'Native model search was replaced'
    start = len(frames); send('\x1b', .8)
    closing = model_frames()[start:]
    assert len({len(frame['lines']) for frame in closing}) > 3, 'Cancel did not fold the model panel'
    assert snapshot()['model']=='one', 'Empty results changed the model'
    send('/model\r', 1); send('two'); send('\r')
    assert snapshot()['model']=='two', 'Native model selection failed'
    send('/model one\r', .8)
    assert snapshot()['model']=='one', 'Exact /model arguments no longer work'
    send('中文模型列表草稿'); before_model = snapshot()
    send('\x0c', 1)
    resize(16,40)
    assert any(frame['width']==40 for frame in model_frames()), 'Native model list did not resize'
    send('中文'); send('\x1b', .8)
    resize(40,100)
    assert snapshot()==before_model, 'Ctrl+L cancel lost the draft'
    # Use the native default-model binding in the isolated settings directory.
    assert checks['saveKeys']==['ctrl+s'], checks['saveKeys']
    send('\x0c', 1); send('two'); send('\x13', .8)
    assert snapshot()['model']=='two', 'Native default-model selection failed'
    settings=json.loads((agent/'settings.json').read_text())
    assert settings['defaultProvider']=='candy-test' and settings['defaultModel']=='two', settings
    send('\x1bk'); send('/candy off\r'); start=len(model_frames())
    send('/model\r', 1)
    off = model_frames()[start:]
    assert off and all('╭' not in frame['lines'][0] for frame in off), '/candy off did not restore the native list'
    send('\x1b'); send('/candy on\r', 1)
    send('\x1bo')
    start=len(model_frames()); send('/model\r', 1)
    assert any('╭' in frame['lines'][0] for frame in model_frames()[start:]), '/candy on did not restore the animation'
    send('\x1b', .8)
    send('保留草稿 / not a command')
    before=snapshot(); assert before['draft']=='保留草稿 / not a command', before
    send('\x1bm'); assert 'controls' in data.decode(errors='replace')
    send('NoSuchModel'); send('\r'); send('\x1b')
    after=snapshot(); assert after==before,(before,after)
    send('\x1bm'); send('two'); send('\r')
    after=snapshot(); assert after['model']=='two' and after['draft']==before['draft'],after
    send('\x1bm'); send('\t'); send('\x1b[B'); send('\r')
    after=snapshot(); assert after['thinking']!='off' and after['draft']==before['draft'],after
    send('\x1bm'); send('\t\t'); send('\x1b[B'); send('\r')
    after=snapshot(); assert after['expanded'] is True,after
    # Check that a resize while searching does not throw or lose the editor draft.
    send('\x1bm')
    resize(16,40)
    send('\x1b'); after=snapshot(); assert after['draft']==before['draft']
    raw=data.decode(errors='replace')
    assert 'Existing plugin status' in raw
    assert '╭' in raw and '╰' in raw, 'Missing editor frame'
    assert '\x1b[38;2;185;103;255m' in raw, 'Missing Candy footer color'
    assert '\x1b[38;2;64;226;255m' in raw, 'Missing Candy panel color'
    for error in ['Failed to load extension','Extension error','AssertionError','TypeError']:
        assert error not in raw,raw[-5000:]
    print('PASS: Native /model and Ctrl+L unfold/fold, retain search, exact arguments, default persistence and drafts, and restore after off/on; Candy controls, animated editor, splash and long raw paste also pass')
    print('Artifacts:',root)
finally:
    (root/'terminal.ansi').write_bytes(data)
    p.terminate()
    try: p.wait(timeout=3)
    except subprocess.TimeoutExpired: p.kill(); p.wait(timeout=3)
    os.close(master)
