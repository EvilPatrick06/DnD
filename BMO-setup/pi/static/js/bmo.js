/** BMO Touchscreen UI — Alpine.js data + WebSocket handlers */

// ── Google Places Autocomplete ──────────────────────────────────
let _placesLoaded = false;
let _placesCallbacks = [];

function loadPlacesAPI(apiKey) {
  if (_placesLoaded || !apiKey) return;
  _placesLoaded = true;
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=_onPlacesReady`;
  script.async = true;
  document.head.appendChild(script);
}

window._onPlacesReady = function() {
  _placesCallbacks.forEach(cb => cb());
  _placesCallbacks = [];
};

const _autocompleteInstances = {};

function initPlacesAutocomplete(inputId, onSelect) {
  const el = document.getElementById(inputId);
  if (!el) return;
  // Skip if already initialized on this element
  if (_autocompleteInstances[inputId]) return;

  function attach() {
    if (!window.google?.maps?.places) return;
    const ac = new google.maps.places.Autocomplete(el, {
      types: ['establishment', 'geocode'],
      fields: ['formatted_address', 'name', 'geometry'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const value = place.name && place.formatted_address
        ? `${place.name}, ${place.formatted_address}`
        : place.formatted_address || place.name || '';
      if (onSelect) onSelect(value);
      el.value = value;
      el.dispatchEvent(new Event('input'));
    });
    _autocompleteInstances[inputId] = ac;
  }

  if (window.google?.maps?.places) {
    attach();
  } else {
    _placesCallbacks.push(attach);
  }
}

function bmo() {
  return {
    // Tabs
    tab: 'home',
    tabs: [
      { id: 'tv', icon: '\u{1F4FA}' },
      { id: 'chat', icon: '\u{1F4AC}' },
      { id: 'home', icon: '\u{1F3E0}' },
      { id: 'music', icon: '\u{1F3B5}' },
      { id: 'calendar', icon: '\u{1F4C5}' },
      { id: 'timers', icon: '\u23F1' },
    ],

    // Clock
    clock: '',
    dateStr: '',
    fullDateStr: '',

    // Status
    status: 'idle', // idle, listening, thinking, speaking

    // Weather
    weather: { temperature: null, description: '', icon: 'clear', feels_like: null },

    // Next event
    nextEvent: null,

    // Chat
    messages: [],
    chatInput: '',

    // Music
    musicQuery: '',
    musicResults: [],
    searchMode: 'songs',
    playlistResults: [],
    musicState: {
      song: null, is_playing: false, position: 0, duration: 0,
      volume: 50, output_device: 'pi', queue: [], queue_length: 0,
      queue_index: -1, shuffle: false, repeat: 'off',
    },
    musicDevices: [{ name: 'pi', label: 'Pi Speakers' }],
    musicHistory: [],
    musicMostPlayed: [],
    showHistory: false,
    showQueue: false,
    albumView: null,

    // Calendar
    calEvents: [],
    calOffline: false,
    calDays: 7,
    showEventForm: false,
    newEvent: {
      summary: '', date: '', startTime: '12:00', durationHrs: '1', location: '', description: '',
      allDay: false, repeatMode: 'none',
      customInterval: 1, customFreq: 'WEEKLY', customDays: [], customEnd: 'never', customEndDate: '', customCount: 10,
    },
    editingEvent: null,
    editEvent: {
      id: '', summary: '', date: '', startTime: '', endTime: '', location: '', description: '',
      allDay: false, repeatMode: 'none',
      customInterval: 1, customFreq: 'WEEKLY', customDays: [], customEnd: 'never', customEndDate: '', customCount: 10,
    },

    // Camera (now accessed via chat overlay)
    cameraActive: true,
    visionResult: '',
    motionEnabled: false,
    showCameraOverlay: false,

    // Timers
    timerMode: 'timer',
    timerItems: [],
    newTimerMin: 0,
    newTimerSec: 0,
    newTimerLabel: '',
    alarmHour: 0,
    alarmMin: 0,
    alarmAmPm: 'AM',
    alarmLabel: '',

    // Schedule overlay (separate state)
    schedHour: null,
    schedMin: null,
    schedAmPm: 'AM',
    schedLabel: '',
    schedDate: '',
    schedRepeat: 'none',
    schedRepeatDays: [],
    showAlarmSchedule: false,
    alarmCalMonth: new Date().getMonth(),
    alarmCalYear: new Date().getFullYear(),

    // Notifications
    notification: null,
    notificationHistory: [],
    unreadNotifications: 0,
    showNotifications: false,

    // Notes
    notes: [],
    newNoteText: '',

    // Lyrics
    showLyrics: false,
    currentLyrics: '',
    lyricsSource: '',
    lyricsLoading: false,
    _lyricsCache: {},

    // Agent system
    agentUsed: '',
    agentDisplayName: '',

    // Plan mode
    planMode: false,       // true when in any plan mode state
    planStatus: 'idle',    // idle, exploring, designing, review, executing, done
    planTask: '',          // current plan task description
    planText: '',          // full plan text from scratchpad
    planSteps: [],         // parsed steps: [{num, desc, agent, status}]
    planCurrentStep: 0,
    planTotalSteps: 0,
    scratchpad: {},        // section name → content

    // D&D Party
    activePlayer: '',
    players: [],

    // TV Remote
    tvConnected: false,
    tvPairing: false,
    tvPairPin: '',

    // Swipe animation direction
    swipeDirection: '',

    // Alert overlay
    alertFired: null,  // { id, label, type } when a timer/alarm goes off

    // Socket
    socket: null,

    // Swipe
    _touchStartX: 0,
    _touchStartY: 0,

    // ── Init ──────────────────────────────────────────────────

    init() {
      this.updateClock();
      setInterval(() => this.updateClock(), 1000);

      this.socket = io();
      this.setupSocket();

      // Stop any playing music on page load (refresh = fresh start)
      fetch('/api/music/stop', { method: 'POST' });

      // Load cached calendar instantly from localStorage (before any server call)
      try {
        const cached = localStorage.getItem('bmo_cal_events');
        if (cached) {
          this.calEvents = JSON.parse(cached);
          if (this.calEvents.length > 0) this.nextEvent = this.calEvents[0];
        }
      } catch {}

      // Restore chat from last session
      this.loadChatHistory();

      // Fetch D&D player names if a session is active
      this.fetchPlayers();

      // Initial data fetches
      this.fetchWeather();
      this.fetchCalendar();
      this.fetchMusicState();
      this.fetchMusicDevices();
      this.fetchMusicHistory();
      this.fetchMostPlayed();
      this.fetchTimers();
      this.fetchNotes();
      this.fetchTvStatus();

      // Poll music state every 2s (on any tab since now-playing bar is global)
      setInterval(() => this.fetchMusicState(), 2000);
      // Poll timers every 1s
      setInterval(() => { if (this.timerItems.length > 0 || this.tab === 'timers') this.fetchTimers(); }, 1000);
      // Poll calendar every 5 min
      setInterval(() => this.fetchCalendar(), 300000);

      // Watch calendar tab for day changes
      this.$watch('calDays', () => this.fetchCalendar());

      // Swipe navigation
      this.initSwipe();

      // Load Google Places API
      fetch('/api/config').then(r => r.json()).then(c => {
        if (c.maps_api_key) loadPlacesAPI(c.maps_api_key);
      }).catch(() => {});
    },

    // ── Swipe ─────────────────────────────────────────────────

    initSwipe() {
      const main = document.querySelector('main');
      if (!main) return;

      let usedTouch = false;

      main.addEventListener('touchstart', (e) => {
        usedTouch = true;
        this._touchStartX = e.touches[0].clientX;
        this._touchStartY = e.touches[0].clientY;
      }, { passive: true });

      main.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - this._touchStartX;
        const dy = e.changedTouches[0].clientY - this._touchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          this.swipeTab(dx < 0 ? 1 : -1);
        }
      }, { passive: true });

      // Mouse drag for desktop testing — skip if touch already handled it
      let mouseDown = false;
      main.addEventListener('mousedown', (e) => {
        if (usedTouch) return;
        if (e.target.closest('input, button, select, textarea, a')) return;
        mouseDown = true;
        this._touchStartX = e.clientX;
        this._touchStartY = e.clientY;
      });

      main.addEventListener('mouseup', (e) => {
        if (usedTouch) { usedTouch = false; return; }
        if (!mouseDown) return;
        mouseDown = false;
        const dx = e.clientX - this._touchStartX;
        const dy = e.clientY - this._touchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          this.swipeTab(dx < 0 ? 1 : -1);
        }
      });
    },

    _lastSwipe: 0,

    swipeTab(direction) {
      const now = Date.now();
      if (now - this._lastSwipe < 300) return;
      this._lastSwipe = now;
      const ids = this.tabs.map(t => t.id);
      const idx = ids.indexOf(this.tab);
      const next = idx + direction;
      if (next >= 0 && next < ids.length) {
        this.swipeDirection = direction > 0 ? 'left' : 'right';
        this.tab = ids[next];
        setTimeout(() => this.swipeDirection = '', 250);
      }
    },

    // ── Clock ─────────────────────────────────────────────────

    updateClock() {
      const now = new Date();
      this.clock = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      this.dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      this.fullDateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    },

    // ── WebSocket ─────────────────────────────────────────────

    setupSocket() {
      this.socket.on('weather_update', (data) => { this.weather = data; });
      this.socket.on('music_state', (data) => { this.musicState = data; });
      this.socket.on('next_event', (data) => { this.nextEvent = data; });
      this.socket.on('timers_tick', (data) => { this.timerItems = data; });
      this.socket.on('status', (data) => { this.status = data.state; });

      this.socket.on('chat_response', (data) => {
        this.status = 'yapping';
        this.messages.push({ role: 'assistant', text: data.text, agent: data.agent_used || '' });
        if (data.agent_used) this.agentUsed = data.agent_used;
        this.scrollChat();
        setTimeout(() => { this.status = 'idle'; }, 2000);
      });

      this.socket.on('transcription', (data) => {
        this.messages.push({ role: 'user', text: data.text, speaker: data.speaker });
        this.scrollChat();
        if (this.tab !== 'chat') this.tab = 'chat';
      });

      this.socket.on('timer_fired', (data) => {
        this.playAlertSound({ id: data.id, label: data.label || data.message, type: 'timer' });
      });

      this.socket.on('alarm_fired', (data) => {
        this.playAlertSound({ id: data.id, label: data.label || data.message, type: 'alarm', repeat: data.repeat || 'none' });
      });

      this.socket.on('calendar_reminder', (data) => {
        this.showNotification(`${data.summary} in ${data.minutes_until} min`);
      });

      this.socket.on('motion_detected', (data) => {
        this.showNotification(`Motion: ${data.description}`);
      });

      // ── Agent system events ────────────────────────────
      this.socket.on('agent_selected', (data) => {
        this.agentUsed = data.agent;
        this.agentDisplayName = data.display_name;
      });

      this.socket.on('agent_nesting', (data) => {
        console.log(`[bmo] Agent nesting: ${data.parent} → ${data.child} for "${data.task}"`);
      });

      // ── Plan mode events ───────────────────────────────
      this.socket.on('plan_mode_entered', (data) => {
        this.planMode = true;
        this.planStatus = 'exploring';
        this.planTask = data.task;
        this.planSteps = [];
        if (this.tab !== 'chat') this.tab = 'chat';
      });

      this.socket.on('plan_mode_review', (data) => {
        this.planStatus = 'review';
        this.planText = data.plan || '';
        this.planSteps = this._parsePlanSteps(data.plan || '');
      });

      this.socket.on('plan_mode_executing', (data) => {
        this.planStatus = 'executing';
      });

      this.socket.on('plan_step_start', (data) => {
        this.planCurrentStep = data.step;
        this.planTotalSteps = data.total;
        const step = this.planSteps.find(s => s.num === data.step);
        if (step) step.status = 'running';
      });

      this.socket.on('plan_step_done', (data) => {
        const step = this.planSteps.find(s => s.num === data.step);
        if (step) step.status = 'done';
      });

      this.socket.on('plan_step_failed', (data) => {
        const step = this.planSteps.find(s => s.num === data.step);
        if (step) step.status = 'failed';
      });

      this.socket.on('plan_mode_exited', (data) => {
        this.planMode = false;
        this.planStatus = 'idle';
      });

      this.socket.on('scratchpad_update', (data) => {
        this.scratchpad = data;
      });
    },

    // ── Plan mode helpers ─────────────────────────────────
    _parsePlanSteps(planText) {
      const steps = [];
      const re = /(\d+)\.\s*\[(.)\]\s*(.+?)(?:\(agent:\s*(\w+)\))?$/gm;
      let match;
      while ((match = re.exec(planText)) !== null) {
        const statusChar = match[2];
        let status = 'pending';
        if (statusChar === 'x') status = 'done';
        else if (statusChar === '~') status = 'running';
        else if (statusChar === '!') status = 'failed';
        steps.push({ num: parseInt(match[1]), desc: match[3].trim(), agent: match[4] || 'code', status });
      }
      return steps;
    },

    approvePlan() {
      this.socket.emit('chat_message', { message: 'yes', speaker: this.activePlayer || 'gavin' });
      this.planStatus = 'executing';
    },

    rejectPlan() {
      this.socket.emit('chat_message', { message: 'no', speaker: this.activePlayer || 'gavin' });
      this.planMode = false;
      this.planStatus = 'idle';
    },

    // ── Chat ──────────────────────────────────────────────────

    async loadChatHistory() {
      try {
        const res = await fetch('/api/chat/history');
        const history = await res.json();
        if (Array.isArray(history) && history.length > 0) {
          this.messages = history.map(m => ({ role: m.role, text: m.text, speaker: m.speaker }));
          this.scrollChat();
        }
      } catch (e) {
        console.warn('[bmo] Failed to load chat history:', e);
      }
    },

    sendChat() {
      const msg = this.chatInput.trim();
      if (!msg) return;

      // Handle slash commands
      if (msg.startsWith('/')) {
        this.chatInput = '';
        this.handleSlashCommand(msg);
        return;
      }

      // Prefix with active player name if in D&D mode
      const speaker = this.activePlayer || 'gavin';
      const displayMsg = this.activePlayer ? `[${this.activePlayer}] ${msg}` : msg;
      this.messages.push({ role: 'user', text: displayMsg, speaker: this.activePlayer || undefined });
      this.chatInput = '';
      this.status = 'thinking';
      this.scrollChat();
      this.socket.emit('chat_message', { message: displayMsg, speaker });
    },

    async handleSlashCommand(cmd) {
      const lower = cmd.toLowerCase().trim();

      if (lower === '/clear') {
        this.messages = [];
        this.scrollChat();
        try {
          const res = await fetch('/api/chat/clear', { method: 'POST' });
          const data = await res.json();
          if (data.dnd_saved) {
            this.messages.push({ role: 'assistant', text: 'Campaign session saved! Chat cleared. Starting fresh.' });
          } else {
            this.messages.push({ role: 'assistant', text: 'Chat cleared. Starting fresh!' });
          }
        } catch {
          this.messages.push({ role: 'assistant', text: 'Chat cleared. Starting fresh!' });
        }
        this.scrollChat();
        return;
      }

      if (lower === '/campaign' || lower === '/campaigns') {
        this.messages.push({ role: 'user', text: '/campaign' });
        this.scrollChat();
        try {
          const res = await fetch('/api/dnd/sessions');
          const sessions = await res.json();
          if (!sessions || sessions.length === 0) {
            this.messages.push({ role: 'assistant', text: 'No saved campaign sessions found.' });
          } else {
            let text = 'Saved campaign sessions:\n\n';
            for (const s of sessions) {
              text += `${s.date} — ${s.messages} messages\n`;
              if (s.preview) text += `  "${s.preview}"\n`;
            }
            text += '\nSay /campaign <date> to load a session (e.g. /campaign 2026-02-22)';
            this.messages.push({ role: 'assistant', text });
          }
        } catch (e) {
          this.messages.push({ role: 'assistant', text: 'Failed to load campaign sessions.' });
        }
        this.scrollChat();
        return;
      }

      // /campaign <date> — load a specific session
      const loadMatch = lower.match(/^\/campaign\s+(\d{4}-\d{2}-\d{2})$/);
      if (loadMatch) {
        const date = loadMatch[1];
        this.messages.push({ role: 'user', text: cmd });
        this.scrollChat();
        try {
          const res = await fetch(`/api/dnd/sessions/${date}`);
          const data = await res.json();
          if (data.error) {
            this.messages.push({ role: 'assistant', text: data.error });
          } else {
            this.messages = data.map(m => ({ role: m.role, text: m.text, speaker: m.speaker }));
            this.messages.push({ role: 'assistant', text: `Loaded campaign session from ${date} (${data.length} messages). The adventure continues!` });
            // Also restore into server memory and get recap
            try {
              const restoreRes = await fetch('/api/dnd/sessions/' + date + '/restore', { method: 'POST' });
              const restoreData = await restoreRes.json();
              if (restoreData.recap) {
                this.messages.push({ role: 'assistant', text: `*Previously on your adventure...*\n\n${restoreData.recap}`, isRecap: true });
              }
              // Refresh player list after restore
              this.fetchPlayers();
            } catch {}
          }
        } catch {
          this.messages.push({ role: 'assistant', text: `No session found for ${date}.` });
        }
        this.scrollChat();
        return;
      }

      // /roll — dice roll result for D&D
      const rollMatch = lower.match(/^\/roll\s+(\d+)\s+(.+)$/);
      if (rollMatch) {
        const roll = parseInt(rollMatch[1]);
        const rest = rollMatch[2].trim();
        let diceMsg = '';

        // Parse: /roll <num> <skill> <character>  OR  /roll <num> <character>
        const parts = rest.split(/\s+/);
        if (parts.length >= 2) {
          // /roll 15 stealth Patrick  or  /roll 15 attack Draco
          const skillOrType = parts.slice(0, parts.length - 1).join(' ');
          const character = parts[parts.length - 1];
          const skillLower = skillOrType.toLowerCase();

          // Saving throws
          const savingThrows = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
          if (savingThrows.includes(skillLower)) {
            const capSkill = skillLower.charAt(0).toUpperCase() + skillLower.slice(1);
            diceMsg = `[DICE] ${character} rolled a ${roll} on a ${capSkill} saving throw.`;
          } else if (skillLower === 'attack') {
            diceMsg = `[DICE] ${character} rolled a ${roll} on their attack roll.`;
          } else if (skillLower === 'initiative') {
            diceMsg = `[DICE] ${character} rolled a ${roll} for initiative.`;
          } else if (skillLower === 'death' || skillLower === 'death save') {
            diceMsg = `[DICE] ${character} rolled a ${roll} on a death saving throw.`;
          } else {
            // Generic skill check
            const capSkill = skillLower.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            diceMsg = `[DICE] ${character} rolled a ${roll} on ${capSkill}.`;
          }
        } else if (parts.length === 1) {
          // /roll 15 Patrick — generic d20 roll
          const character = parts[0];
          diceMsg = `[DICE] ${character} rolled a ${roll} on a d20.`;
        }

        if (diceMsg) {
          this.messages.push({ role: 'user', text: cmd });
          this.scrollChat();
          this.status = 'thinking';
          this.socket.emit('chat_message', { message: diceMsg, speaker: 'gavin' });
          return;
        }
      }

      // /roll with no valid args — show help
      if (lower.startsWith('/roll')) {
        this.messages.push({ role: 'assistant', text: `Usage: /roll <number> <skill> <character>\n\nExamples:\n  /roll 15 stealth Patrick\n  /roll 8 perception Draco\n  /roll 12 attack Patrick\n  /roll 14 wisdom Draco\n  /roll 10 initiative Patrick\n  /roll 18 Patrick  (generic d20 roll)` });
        this.scrollChat();
        return;
      }

      // /player <name> — switch active player
      const playerMatch = lower.match(/^\/player\s+(.+)$/);
      if (playerMatch) {
        const name = playerMatch[1].trim();
        // Try to match case-insensitively against known players
        const match = this.players.find(p => p.toLowerCase() === name.toLowerCase());
        if (match) {
          this.activePlayer = match;
          this.messages.push({ role: 'assistant', text: `Now speaking as ${match}.` });
        } else if (this.players.length > 0) {
          this.messages.push({ role: 'assistant', text: `Unknown player "${name}". Available: ${this.players.join(', ')}` });
        } else {
          // No players loaded — just set it raw
          this.activePlayer = name.charAt(0).toUpperCase() + name.slice(1);
          this.messages.push({ role: 'assistant', text: `Now speaking as ${this.activePlayer}.` });
        }
        this.scrollChat();
        return;
      }

      if (lower === '/player' || lower === '/players') {
        if (this.players.length > 0) {
          const current = this.activePlayer || 'None';
          this.messages.push({ role: 'assistant', text: `Active player: ${current}\nAvailable: ${this.players.join(', ')}\n\nUse /player <name> to switch.` });
        } else {
          this.messages.push({ role: 'assistant', text: 'No D&D session active. Load characters first.' });
        }
        this.scrollChat();
        return;
      }

      // /init — Create a BMO.md in the current or specified directory
      if (lower === '/init' || lower.startsWith('/init ')) {
        const dir = cmd.slice(5).trim() || '.';
        this.messages.push({ role: 'user', text: cmd });
        this.scrollChat();
        try {
          const res = await fetch('/api/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ directory: dir }) });
          const data = await res.json();
          if (data.success) {
            this.messages.push({ role: 'assistant', text: `BMO.md created at ${data.path}! BMO will now auto-load project context from this file.` });
          } else {
            this.messages.push({ role: 'assistant', text: data.error || 'Failed to create BMO.md' });
          }
        } catch (e) {
          this.messages.push({ role: 'assistant', text: 'Failed to create BMO.md: ' + e.message });
        }
        this.scrollChat();
        return;
      }

      // /agents — List all registered agents
      if (lower === '/agents') {
        this.messages.push({ role: 'user', text: cmd });
        this.scrollChat();
        try {
          const res = await fetch('/api/agents');
          const data = await res.json();
          let text = `BMO has ${data.agents.length} agents (mode: ${data.mode}):\n\n`;
          for (const a of data.agents) {
            text += `  ${a.display_name} (${a.name}) — temp ${a.temperature}${a.can_nest ? ' [can nest]' : ''}\n`;
          }
          this.messages.push({ role: 'assistant', text });
        } catch (e) {
          this.messages.push({ role: 'assistant', text: 'Failed to list agents.' });
        }
        this.scrollChat();
        return;
      }

      // /scratchpad — Show scratchpad contents
      if (lower === '/scratchpad' || lower === '/scratch') {
        this.messages.push({ role: 'user', text: cmd });
        this.scrollChat();
        try {
          const res = await fetch('/api/scratchpad');
          const data = await res.json();
          const sections = Object.keys(data);
          if (sections.length === 0) {
            this.messages.push({ role: 'assistant', text: 'Scratchpad is empty.' });
          } else {
            let text = 'Scratchpad sections:\n\n';
            for (const section of sections) {
              text += `## ${section}\n${data[section].substring(0, 200)}${data[section].length > 200 ? '...' : ''}\n\n`;
            }
            this.messages.push({ role: 'assistant', text });
          }
        } catch (e) {
          this.messages.push({ role: 'assistant', text: 'Failed to read scratchpad.' });
        }
        this.scrollChat();
        return;
      }

      // Unknown command
      this.messages.push({ role: 'assistant', text: `Unknown command: ${cmd}\n\nAvailable commands:\n  /clear — Clear chat and start fresh\n  /campaign — List saved D&D sessions\n  /campaign <date> — Load a saved session\n  /roll <number> <skill> <character> — Send a dice roll to BMO\n  /player <name> — Switch active player character\n  /player — Show current player and available characters\n  /agents — List all registered agents\n  /scratchpad — Show scratchpad contents\n  /init [dir] — Create BMO.md in a directory` });
      this.scrollChat();
    },

    scrollChat() {
      this.$nextTick(() => {
        const el = this.$refs.chatScroll;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    async fetchPlayers() {
      try {
        const res = await fetch('/api/dnd/players');
        const data = await res.json();
        if (data.players && data.players.length > 0) {
          this.players = data.players;
          if (!this.activePlayer) {
            this.activePlayer = this.players[0];
          }
        }
      } catch {}
    },

    // ── Music ─────────────────────────────────────────────────

    _searchTimer: null,

    musicSearchFocused: false,

    onMusicSearchFocus() {
      this.musicSearchFocused = true;
      if (!this.musicQuery.trim()) {
        this.fetchMusicHistory();
      }
    },

    searchMusicDebounced() {
      clearTimeout(this._searchTimer);
      if (!this.musicQuery.trim()) {
        this.musicResults = [];
        this.playlistResults = [];
        if (this.musicSearchFocused) this.fetchMusicHistory();
        return;
      }
      this._searchTimer = setTimeout(() => this.searchMusic(), 200);
    },

    setSearchMode(mode) {
      this.searchMode = mode;
      this.musicResults = [];
      this.playlistResults = [];
      if (this.musicQuery.trim()) this.searchMusic();
    },

    async searchMusic() {
      if (!this.musicQuery.trim()) return;
      if (this.searchMode === 'playlists') {
        const res = await fetch(`/api/music/search/playlists?q=${encodeURIComponent(this.musicQuery)}`);
        this.playlistResults = await res.json();
        this.musicResults = [];
      } else {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(this.musicQuery)}`);
        this.musicResults = await res.json();
        this.playlistResults = [];
      }
    },

    async fetchPlaylist(browseId) {
      if (!browseId) return;
      try {
        const res = await fetch(`/api/music/playlist/${browseId}`);
        this.albumView = await res.json();
        this.playlistResults = [];
        this.musicResults = [];
        this.musicSearchFocused = false;
      } catch {
        this.showNotification('Failed to load playlist');
      }
    },

    async playSong(song) {
      await fetch('/api/music/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song }),
      });
      this.musicResults = [];
      this.showHistory = false;
      this.showQueue = false;
      this.fetchMusicState();
      this.fetchMusicHistory();
    },

    async playSongInline(song) {
      fetch('/api/music/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song }),
      }).then(() => { this.fetchMusicState(); this.fetchMusicHistory(); this.fetchMostPlayed(); });
    },

    async musicCmd(cmd) {
      await fetch(`/api/music/${cmd}`, { method: 'POST' });
      this.fetchMusicState();
    },

    setVolume(vol) {
      this.musicState.volume = vol;
      fetch('/api/music/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: vol }),
      });
    },

    async castMusic(device) {
      await fetch('/api/music/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device }),
      });
    },

    seekMusic(event) {
      if (!this.musicState.duration) return;
      const rect = event.target.getBoundingClientRect();
      const pct = (event.clientX - rect.left) / rect.width;
      const pos = pct * this.musicState.duration;
      fetch('/api/music/seek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: pos }),
      });
    },

    async fetchMusicState() {
      try {
        const res = await fetch('/api/music/state');
        this.musicState = await res.json();
      } catch {}
    },

    async fetchMusicDevices() {
      try {
        const res = await fetch('/api/music/devices');
        this.musicDevices = await res.json();
      } catch {}
    },

    async fetchMusicHistory() {
      try {
        const res = await fetch('/api/music/history');
        this.musicHistory = await res.json();
      } catch {}
    },

    async fetchMostPlayed() {
      try {
        const res = await fetch('/api/music/most-played');
        this.musicMostPlayed = await res.json();
      } catch {}
    },

    async addToQueue(song) {
      await fetch('/api/music/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song }),
      });
      this.fetchMusicState();
      this.showNotification(`Added to queue: ${song.title}`);
    },

    async removeFromQueue(index) {
      await fetch('/api/music/queue/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      });
      this.fetchMusicState();
    },

    async playQueueItem(index) {
      // Play a specific item in the queue by stopping and seeking to that index
      const queue = this.musicState.queue || [];
      if (index >= 0 && index < queue.length) {
        const song = queue[index];
        await fetch('/api/music/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song }),
        });
        this.fetchMusicState();
      }
    },

    async fetchAlbum(browseId) {
      if (!browseId) return;
      try {
        const res = await fetch(`/api/music/album/${browseId}`);
        this.albumView = await res.json();
      } catch {
        this.showNotification('Failed to load album');
      }
    },

    async addAlbumToQueue() {
      if (!this.albumView?.tracks) return;
      const tracks = this.albumView.tracks.filter(t => t.videoId);
      if (!tracks.length) return;
      // If nothing is playing, start the first track then queue the rest
      if (!this.musicState.song) {
        await fetch('/api/music/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: tracks[0] }),
        });
        for (const track of tracks.slice(1)) {
          await fetch('/api/music/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: track }),
          });
        }
      } else {
        for (const track of tracks) {
          await fetch('/api/music/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: track }),
          });
        }
      }
      this.fetchMusicState();
      this.fetchMusicHistory();
      this.showNotification(`Added ${tracks.length} tracks to queue`);
    },

    async playSongFromAlbum(song) {
      await fetch('/api/music/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song }),
      });
      this.fetchMusicState();
      this.fetchMusicHistory();
    },

    get musicProgress() {
      if (!this.musicState.duration) return 0;
      return (this.musicState.position / this.musicState.duration) * 100;
    },

    // ── Calendar ──────────────────────────────────────────────

    async fetchCalendar() {
      try {
        const res = await fetch(`/api/calendar/events?days=${this.calDays}`);
        const data = await res.json();
        if (!res.ok) {
          this.calOffline = true;
          return;
        }
        this.calOffline = data.offline || false;
        this.calEvents = data.events || [];
        if (this.calEvents.length > 0) this.nextEvent = this.calEvents[0];
        // Save to localStorage for instant offline access
        try { localStorage.setItem('bmo_cal_events', JSON.stringify(this.calEvents)); } catch {}
      } catch (e) {
        // Server unreachable — load from localStorage, show offline
        this.calOffline = true;
        if (this.calEvents.length === 0) {
          try {
            const cached = localStorage.getItem('bmo_cal_events');
            if (cached) this.calEvents = JSON.parse(cached);
          } catch {}
        }
      }
    },

    toggleDay(eventObj, day) {
      const idx = eventObj.customDays.indexOf(day);
      if (idx >= 0) {
        eventObj.customDays.splice(idx, 1);
      } else {
        eventObj.customDays.push(day);
      }
    },

    buildRRule(eventObj) {
      const mode = eventObj.repeatMode;
      if (mode === 'none') return null;

      // Preset modes
      const presets = {
        daily: 'RRULE:FREQ=DAILY',
        weekly: 'RRULE:FREQ=WEEKLY',
        monthly: 'RRULE:FREQ=MONTHLY',
        yearly: 'RRULE:FREQ=YEARLY',
        weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      };
      if (presets[mode]) return presets[mode];

      // Custom mode
      if (mode === 'custom') {
        let rule = `RRULE:FREQ=${eventObj.customFreq};INTERVAL=${eventObj.customInterval}`;
        if (eventObj.customFreq === 'WEEKLY' && eventObj.customDays.length > 0) {
          rule += `;BYDAY=${eventObj.customDays.join(',')}`;
        }
        if (eventObj.customEnd === 'date' && eventObj.customEndDate) {
          const d = eventObj.customEndDate.replace(/-/g, '');
          rule += `;UNTIL=${d}T235959Z`;
        } else if (eventObj.customEnd === 'count' && eventObj.customCount > 0) {
          rule += `;COUNT=${eventObj.customCount}`;
        }
        return rule;
      }
      return null;
    },

    async createCalEvent() {
      const e = this.newEvent;
      if (!e.summary || !e.date) {
        this.showNotification('Fill in title and date');
        return;
      }
      if (!e.allDay && !e.startTime) {
        this.showNotification('Fill in start time or mark as all day');
        return;
      }

      const body = {
        summary: e.summary,
        description: e.description,
        location: e.location,
        allDay: e.allDay,
      };

      if (e.allDay) {
        body.start = e.date;
        // All-day events use date (not dateTime). End date is exclusive in Google Calendar.
        const endDate = new Date(e.date);
        endDate.setDate(endDate.getDate() + 1);
        body.end = endDate.toISOString().split('T')[0];
      } else {
        const start = new Date(`${e.date}T${e.startTime}:00`);
        const end = new Date(start.getTime() + parseFloat(e.durationHrs) * 3600000);
        body.start = start.toISOString();
        body.end = end.toISOString();
      }

      const rrule = this.buildRRule(e);
      if (rrule) body.recurrence = rrule;

      try {
        await fetch('/api/calendar/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        this.showEventForm = false;
        this.newEvent = {
          summary: '', date: '', startTime: '12:00', durationHrs: '1', location: '', description: '',
          allDay: false, repeatMode: 'none',
          customInterval: 1, customFreq: 'WEEKLY', customDays: [], customEnd: 'never', customEndDate: '', customCount: 10,
        };
        this.fetchCalendar();
        this.showNotification('Event created!');
      } catch {
        this.showNotification('Failed to create event');
      }
    },

    async deleteCalEvent(eventId) {
      if (!eventId) return;
      try {
        await fetch(`/api/calendar/delete/${eventId}`, { method: 'DELETE' });
        this.editingEvent = null;
        this.fetchCalendar();
        this.showNotification('Event deleted');
      } catch {
        this.showNotification('Failed to delete event');
      }
    },

    startEditEvent(event) {
      const isAllDay = !!event.all_day;
      let date = '', startTime = '', endTime = '';

      if (isAllDay) {
        // All-day events have date strings like "2026-02-22"
        date = event.start_iso || '';
      } else if (event.start_iso) {
        try {
          const d = new Date(event.start_iso);
          date = d.toISOString().split('T')[0];
          startTime = d.toTimeString().slice(0, 5);
        } catch {}
      }
      if (!isAllDay && event.end_iso) {
        try {
          const d = new Date(event.end_iso);
          endTime = d.toTimeString().slice(0, 5);
        } catch {}
      }

      // Parse recurrence if present
      let repeatMode = 'none';
      let customInterval = 1, customFreq = 'WEEKLY', customDays = [], customEnd = 'never', customEndDate = '', customCount = 10;
      if (event.recurrence && event.recurrence.length > 0) {
        const rule = event.recurrence[0] || '';
        if (rule === 'RRULE:FREQ=DAILY') repeatMode = 'daily';
        else if (rule === 'RRULE:FREQ=WEEKLY') repeatMode = 'weekly';
        else if (rule === 'RRULE:FREQ=MONTHLY') repeatMode = 'monthly';
        else if (rule === 'RRULE:FREQ=YEARLY') repeatMode = 'yearly';
        else if (rule.includes('BYDAY=MO,TU,WE,TH,FR') && !rule.includes('INTERVAL')) repeatMode = 'weekdays';
        else if (rule.startsWith('RRULE:')) {
          repeatMode = 'custom';
          const parts = rule.replace('RRULE:', '').split(';');
          for (const p of parts) {
            const [k, v] = p.split('=');
            if (k === 'FREQ') customFreq = v;
            else if (k === 'INTERVAL') customInterval = parseInt(v) || 1;
            else if (k === 'BYDAY') customDays = v.split(',');
            else if (k === 'UNTIL') { customEnd = 'date'; customEndDate = v.slice(0,4) + '-' + v.slice(4,6) + '-' + v.slice(6,8); }
            else if (k === 'COUNT') { customEnd = 'count'; customCount = parseInt(v) || 10; }
          }
        }
      }

      this.editEvent = {
        id: event.id,
        summary: event.summary || '',
        date, startTime, endTime,
        location: event.location || '',
        description: event.description || '',
        allDay: isAllDay, repeatMode,
        customInterval, customFreq, customDays, customEnd, customEndDate, customCount,
      };
      this.editingEvent = event.id;
      this.showEventForm = false;
    },

    async updateCalEvent() {
      const e = this.editEvent;
      if (!e.id || !e.summary || !e.date) {
        this.showNotification('Fill in title and date');
        return;
      }
      if (!e.allDay && !e.startTime) {
        this.showNotification('Fill in start time or mark as all day');
        return;
      }

      const body = {
        summary: e.summary,
        description: e.description,
        location: e.location,
        allDay: e.allDay,
      };

      if (e.allDay) {
        body.start = e.date;
        const endDate = new Date(e.date);
        endDate.setDate(endDate.getDate() + 1);
        body.end = endDate.toISOString().split('T')[0];
      } else {
        const start = new Date(`${e.date}T${e.startTime}:00`);
        const endTimeStr = e.endTime || e.startTime;
        let end = new Date(`${e.date}T${endTimeStr}:00`);
        if (end <= start) end = new Date(start.getTime() + 3600000);
        body.start = start.toISOString();
        body.end = end.toISOString();
      }

      const rrule = this.buildRRule(e);
      if (rrule) body.recurrence = [rrule];
      else body.recurrence = [];  // Clear recurrence if set to "none"

      try {
        await fetch(`/api/calendar/update/${e.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        this.editingEvent = null;
        this.fetchCalendar();
        this.showNotification('Event updated!');
      } catch {
        this.showNotification('Failed to update event');
      }
    },

    // ── Camera ────────────────────────────────────────────────

    async cameraSnapshot() {
      await fetch('/api/camera/snapshot', { method: 'POST' });
      this.showNotification('Snapshot saved!');
    },

    async cameraDescribe() {
      this.visionResult = 'Looking...';
      try {
        const res = await fetch('/api/camera/describe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'What do you see? Describe briefly.' }),
        });
        const data = await res.json();
        this.visionResult = data.description;
      } catch {
        this.visionResult = 'Could not describe scene';
      }
    },

    async toggleMotion() {
      this.motionEnabled = !this.motionEnabled;
      await fetch('/api/camera/motion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: this.motionEnabled }),
      });
    },

    // ── Timers ────────────────────────────────────────────────

    async fetchTimers() {
      try {
        const res = await fetch('/api/timers');
        const items = await res.json();
        // Check if any timer just hit 0
        for (const item of items) {
          if (item.remaining <= 0) {
            const old = this.timerItems.find(t => t.id === item.id);
            if (old && old.remaining > 0) {
              this.playAlertSound({ id: item.id, label: item.label, type: item.type });
            }
          }
        }
        this.timerItems = items;
      } catch {}
    },

    async createTimer() {
      const totalSec = (this.newTimerMin || 0) * 60 + (this.newTimerSec || 0);
      if (totalSec <= 0) return;
      const label = this.newTimerLabel || (this.newTimerMin ? `${this.newTimerMin}m${this.newTimerSec ? ' ' + this.newTimerSec + 's' : ''} timer` : `${this.newTimerSec}s timer`);
      await fetch('/api/timers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: totalSec, label }),
      });
      this.newTimerLabel = '';
      this.fetchTimers();
    },

    async createTimerRaw() {
      const sec = this.newTimerSec || 0;
      if (sec <= 0) return;
      const label = sec >= 60 ? `${Math.floor(sec/60)}m timer` : `${sec}s timer`;
      await fetch('/api/timers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: sec, label }),
      });
      this.fetchTimers();
    },

    async createAlarmFromTime() {
      let h24 = this.alarmHour % 12;
      if (this.alarmAmPm === 'PM') h24 += 12;
      if (this.alarmAmPm === 'AM' && this.alarmHour === 12) h24 = 0;
      const label = this.alarmLabel || `Alarm (${this.alarmHour}:${String(this.alarmMin).padStart(2,'0')} ${this.alarmAmPm})`;
      await fetch('/api/alarms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: h24, minute: this.alarmMin, label }),
      });
      this.alarmHour = 0;
      this.alarmMin = 0;
      this.alarmAmPm = 'AM';
      this.alarmLabel = '';
      this.fetchTimers();
    },

    async createScheduledAlarm() {
      if (!this.schedHour && this.schedHour !== 0) return;
      let h24 = this.schedHour % 12;
      if (this.schedAmPm === 'PM') h24 += 12;
      if (this.schedAmPm === 'AM' && this.schedHour === 12) h24 = 0;
      const label = this.schedLabel || `Alarm (${this.schedHour}:${String(this.schedMin || 0).padStart(2,'0')} ${this.schedAmPm})`;
      const body = { hour: h24, minute: this.schedMin || 0, label };
      if (this.schedDate) body.date = this.schedDate;
      if (this.schedRepeat !== 'none') body.repeat = this.schedRepeat;
      if (this.schedRepeat === 'custom' && this.schedRepeatDays.length > 0) body.repeat_days = this.schedRepeatDays;
      await fetch('/api/alarms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      this.schedHour = null;
      this.schedMin = null;
      this.schedAmPm = 'AM';
      this.schedLabel = '';
      this.schedDate = '';
      this.schedRepeat = 'none';
      this.schedRepeatDays = [];
      this.fetchTimers();
    },

    toggleAlarmDay(day) {
      const idx = this.schedRepeatDays.indexOf(day);
      if (idx >= 0) {
        this.schedRepeatDays.splice(idx, 1);
      } else {
        this.schedRepeatDays.push(day);
      }
    },

    // ── Alarm Calendar ───────────────────────────────────────

    initAlarmCal() {
      const now = new Date();
      if (this.schedDate) {
        const d = new Date(this.schedDate + 'T00:00:00');
        this.alarmCalMonth = d.getMonth();
        this.alarmCalYear = d.getFullYear();
      } else {
        this.alarmCalMonth = now.getMonth();
        this.alarmCalYear = now.getFullYear();
      }
    },

    alarmCalTitle() {
      return new Date(this.alarmCalYear, this.alarmCalMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },

    alarmCalPrev() {
      this.alarmCalMonth--;
      if (this.alarmCalMonth < 0) { this.alarmCalMonth = 11; this.alarmCalYear--; }
    },

    alarmCalNext() {
      this.alarmCalMonth++;
      if (this.alarmCalMonth > 11) { this.alarmCalMonth = 0; this.alarmCalYear++; }
    },

    alarmCalCells() {
      const first = new Date(this.alarmCalYear, this.alarmCalMonth, 1);
      const daysInMonth = new Date(this.alarmCalYear, this.alarmCalMonth + 1, 0).getDate();
      const startDow = first.getDay(); // 0=Sun
      const today = new Date();
      const todayStr = this.todayISO();
      const cells = [];

      for (let i = 0; i < startDow; i++) {
        cells.push({ key: 'e' + i, day: 0, iso: '', today: false, past: false });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${this.alarmCalYear}-${String(this.alarmCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({
          key: iso,
          day: d,
          iso,
          today: iso === todayStr,
          past: new Date(iso + 'T23:59:59') < new Date(todayStr + 'T00:00:00'),
        });
      }
      return cells;
    },

    pickAlarmDate(iso) {
      this.schedDate = iso;
    },

    todayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    tomorrowISO() {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    alarmRepeatLabel(item) {
      if (!item.repeat || item.repeat === 'none') return '';
      if (item.repeat === 'daily') return 'Daily';
      if (item.repeat === 'weekdays') return 'M-F';
      if (item.repeat === 'weekends') return 'Sa Su';
      if (item.repeat === 'custom' && item.repeat_days && item.repeat_days.length > 0) {
        const map = { SU: 'Su', MO: 'M', TU: 'T', WE: 'W', TH: 'Th', FR: 'F', SA: 'Sa' };
        const order = ['SU','MO','TU','WE','TH','FR','SA'];
        return item.repeat_days
          .slice()
          .sort((a, b) => order.indexOf(a) - order.indexOf(b))
          .map(d => map[d] || d)
          .join(' ');
      }
      return item.repeat;
    },

    alarmScheduleSummary() {
      return 'Schedule';
    },

    alarmScheduleDescription() {
      const h = this.schedHour; const m = this.schedMin;
      const time = (h !== null && h !== undefined) ? `${h}:${String(m || 0).padStart(2, '0')} ${this.schedAmPm}` : '--:--';
      if (this.schedRepeat === 'daily') return `Every day at ${time}`;
      if (this.schedRepeat === 'weekdays') return `Weekdays (Mon\u2013Fri) at ${time}`;
      if (this.schedRepeat === 'weekends') return `Weekends (Sat\u2013Sun) at ${time}`;
      if (this.schedRepeat === 'custom' && this.schedRepeatDays.length > 0) {
        const names = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
        const order = ['SU','MO','TU','WE','TH','FR','SA'];
        const days = this.schedRepeatDays.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(d => names[d]).join(', ');
        return `Every ${days} at ${time}`;
      }
      if (this.schedDate) {
        const d = new Date(this.schedDate + 'T00:00:00');
        return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${time}`;
      }
      return `Set time and date above`;
    },

    async pauseTimer(id) {
      await fetch(`/api/timers/${id}/pause`, { method: 'POST' });
      this.fetchTimers();
    },

    async snoozeAlarm(id) {
      await fetch(`/api/alarms/${id}/snooze`, { method: 'POST' });
      this.stopAlertLoop();
      this.fetchTimers();
    },

    async cancelTimer(item) {
      const endpoint = item.type === 'timer' ? 'timers' : 'alarms';
      await fetch(`/api/${endpoint}/${item.id}/cancel`, { method: 'POST' });
      this.stopAlertLoop();
      this.fetchTimers();
    },

    // ── Weather ───────────────────────────────────────────────

    async fetchWeather() {
      try {
        const res = await fetch('/api/weather');
        this.weather = await res.json();
      } catch {}
    },

    weatherIcon(code) {
      const icons = { clear: '\u2600', cloudy: '\u2601', rain: '\u{1F327}', snow: '\u2744', storm: '\u26A1', fog: '\u{1F32B}' };
      return icons[code] || '\u2600';
    },

    // ── Notifications ─────────────────────────────────────────

    showNotification(msg) {
      this.notification = msg;
      this.notificationHistory.unshift({ text: msg, time: new Date().toLocaleTimeString() });
      if (this.notificationHistory.length > 20) this.notificationHistory.pop();
      this.unreadNotifications++;
      setTimeout(() => { this.notification = null; }, 5000);
    },

    _alertInterval: null,

    startAlertLoop() {
      if (this._alertInterval) return;
      this.playAlertBeep();
      this._alertInterval = setInterval(() => this.playAlertBeep(), 2000);
    },

    stopAlertLoop() {
      if (this._alertInterval) {
        clearInterval(this._alertInterval);
        this._alertInterval = null;
      }
    },

    playAlertBeep() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [660, 880, 660, 880, 660];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.2);
          osc.stop(ctx.currentTime + i * 0.2 + 0.18);
        });
        setTimeout(() => ctx.close(), 2000);
      } catch {}
    },

    playAlertSound(item) {
      this.alertFired = item || { id: null, label: 'Timer', type: 'timer' };
      this.startAlertLoop();
    },

    dismissAlert() {
      if (this.alertFired) {
        // Only cancel non-repeating alarms — repeating ones already advanced to next occurrence
        if (!this.alertFired.repeat || this.alertFired.repeat === 'none') {
          this.cancelTimer(this.alertFired);
        }
      }
      this.alertFired = null;
      this.stopAlertLoop();
      this.fetchTimers();
    },

    async snoozeAlert(seconds) {
      const secs = seconds || 300;
      const label = this.alertFired?.label || 'Snoozed';
      // Cancel the fired one
      if (this.alertFired) {
        const endpoint = this.alertFired.type === 'timer' ? 'timers' : 'alarms';
        await fetch(`/api/${endpoint}/${this.alertFired.id}/cancel`, { method: 'POST' });
      }
      // Create a new timer for the snooze duration
      await fetch('/api/timers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: secs, label: `${label} (snoozed)` }),
      });
      this.alertFired = null;
      this.stopAlertLoop();
      this.fetchTimers();
    },

    // ── Weather Suggestion ──────────────────────────────────────

    get weatherSuggestion() {
      const t = this.weather.temperature;
      const icon = this.weather.icon;
      if (icon === 'snow') return 'Watch for ice!';
      if (icon === 'rain' || icon === 'storm') return 'Grab an umbrella';
      if (t !== null && t < 32) return 'Bundle up! Below freezing';
      if (t !== null && t < 50) return 'Bring a jacket';
      if (t !== null && t > 95) return 'Stay hydrated!';
      if (t !== null && t > 85) return "It's hot out there";
      return '';
    },

    get activeTimerCount() {
      return this.timerItems.filter(t => !t.fired).length;
    },

    // ── Notes ────────────────────────────────────────────────

    async fetchNotes() {
      try {
        const res = await fetch('/api/notes');
        this.notes = await res.json();
      } catch {}
    },

    async addNote() {
      const text = this.newNoteText.trim();
      if (!text) return;
      try {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        this.newNoteText = '';
        this.fetchNotes();
      } catch {}
    },

    async toggleNote(note) {
      try {
        await fetch(`/api/notes/${note.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: !note.done }),
        });
        this.fetchNotes();
      } catch {}
    },

    async deleteNote(noteId) {
      try {
        await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
        this.fetchNotes();
      } catch {}
    },

    // ── Lyrics ───────────────────────────────────────────────

    async fetchLyrics() {
      const vid = this.musicState.song?.videoId;
      if (!vid) return;
      if (this._lyricsCache[vid]) {
        this.currentLyrics = this._lyricsCache[vid];
        this.showLyrics = true;
        return;
      }
      this.lyricsLoading = true;
      this.showLyrics = true;
      try {
        const res = await fetch(`/api/music/lyrics/${vid}`);
        const data = await res.json();
        this.currentLyrics = data.lyrics || 'No lyrics available';
        this.lyricsSource = data.source || '';
        this._lyricsCache[vid] = this.currentLyrics;
      } catch {
        this.currentLyrics = 'Failed to load lyrics';
      }
      this.lyricsLoading = false;
    },

    // ── TV Remote ────────────────────────────────────────────

    tvNeedsPairing: false,

    async fetchTvStatus() {
      try {
        const res = await fetch('/api/tv/status');
        const data = await res.json();
        this.tvConnected = data.connected;
        this.tvNeedsPairing = data.needs_pairing || false;
      } catch {}
    },

    async tvStartPairing() {
      this.tvPairing = true;
      this.tvPairPin = '';
      try {
        const res = await fetch('/api/tv/pair/start', { method: 'POST' });
        const data = await res.json();
        if (data.error) {
          this.showNotification('Pairing failed: ' + data.error);
          this.tvPairing = false;
        } else {
          this.showNotification('Check your TV for a PIN code!');
        }
      } catch {
        this.showNotification('Failed to start pairing');
        this.tvPairing = false;
      }
    },

    async tvFinishPairing() {
      if (!this.tvPairPin) return;
      try {
        const res = await fetch('/api/tv/pair/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: this.tvPairPin }),
        });
        const data = await res.json();
        if (data.error) {
          this.showNotification('Pairing failed: ' + data.error);
        } else {
          this.showNotification('TV paired and connected!');
          this.tvConnected = true;
          this.tvNeedsPairing = false;
        }
      } catch {
        this.showNotification('Failed to finish pairing');
      }
      this.tvPairing = false;
      this.tvPairPin = '';
    },

    async tvKey(key) {
      try {
        await fetch('/api/tv/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
      } catch {}
    },

    async tvLaunch(app) {
      try {
        await fetch('/api/tv/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app }),
        });
      } catch {}
    },

    async tvVolume(direction) {
      try {
        await fetch('/api/tv/volume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction }),
        });
      } catch {}
    },

    async tvPower() {
      try {
        await fetch('/api/tv/power', { method: 'POST' });
      } catch {}
    },

    // ── Camera Snap (download) ───────────────────────────────

    cameraSnap() {
      window.open('/api/camera/snapshot?download=1', '_blank');
    },

    // ── Formatters ────────────────────────────────────────────

    formatTime(sec) {
      if (!sec || sec < 0) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    },

    formatCountdown(sec) {
      if (sec <= 0) return '0:00';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },

    // ── Status Indicators ─────────────────────────────────────

    get statusColor() {
      return {
        idle: 'bg-green-500',
        listening: 'bg-blue-500 animate-pulse',
        thinking: 'bg-amber-500 animate-pulse',
        yapping: 'bg-orange-500 animate-pulse',
        speaking: 'bg-purple-500 animate-pulse',
      }[this.status] || 'bg-gray-500';
    },

    get statusText() {
      return {
        idle: 'What can BMO do for you?',
        listening: 'BMO is listening...',
        thinking: 'BMO is thinking!',
        yapping: 'BMO is yapping!',
        speaking: 'BMO is talking!',
      }[this.status] || 'BMO';
    },

    get statusTextColor() {
      return {
        idle: 'text-green-400',
        listening: 'text-blue-400',
        thinking: 'text-amber-400',
        yapping: 'text-orange-400',
        speaking: 'text-purple-400',
      }[this.status] || 'text-text-muted';
    },
  };
}
