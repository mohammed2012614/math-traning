let gameMode = 'local'; // bot, local, online
let botDiff = 'impossible';
let botDelay = 1000;
let currentLevel = 1;
let p1Score = 0;
let p2Score = 0;
let currentAnswer = 0;
let isPlaying = false;
let botTimer = null;
let socket = null;
let roomId = '';
let playerName = 'اللاعب 1';
let isRoomAdmin = false;

let p1InputStr = "";
let p2InputStr = "";

function setGameMode(mode) {
    gameMode = mode;
    ['bot', 'local', 'online'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        if (m === mode) {
            btn.className = "bg-indigo-600 font-bold py-2.5 rounded-xl border border-indigo-500 text-xs transition shadow";
        } else {
            btn.className = "bg-slate-800 font-bold py-2.5 rounded-xl border border-slate-700 text-xs transition text-slate-400";
        }
    });

    document.getElementById('bot-options').classList.toggle('hidden', mode !== 'bot');
    document.getElementById('online-options').classList.toggle('hidden', mode !== 'online');
    document.getElementById('start-btn').classList.toggle('hidden', mode === 'online'); // الأونلاين يُدار عبر لوحة الغرفة
}

function setBotDiff(diff) {
    botDiff = diff;
    if (diff === 'easy') botDelay = 8000;
    else botDelay = 1000;
}

// ================= إدارة المجموعات وأزرار الرئيس (الإضافة المطلوبة) =================
function showCreateRoomPanel() {
    document.getElementById('create-room-panel').classList.remove('hidden');
    document.getElementById('join-room-panel').classList.add('hidden');
}

function showJoinRoomPanel() {
    document.getElementById('join-room-panel').classList.remove('hidden');
    document.getElementById('create-room-panel').classList.add('hidden');
}

function submitCreateRoom() {
    playerName = document.getElementById('player-name').value.trim() || "اللاعب 1";
    roomId = 'ROOM_' + Math.floor(Math.random() * 90000 + 10000);
    isRoomAdmin = true;

    const privacy = document.getElementById('room-privacy').value;
    const maxPlayers = document.getElementById('room-max-players').value;
    const winnersCount = document.getElementById('room-winners-count').value;

    if (typeof io !== 'undefined') {
        socket = io();
        socket.emit('createRoom', { roomId, playerName, privacy, maxPlayers, winnersCount });

        document.getElementById('create-room-panel').classList.add('hidden');
        document.getElementById('waiting-room-panel').classList.remove('hidden');
        document.getElementById('display-room-code').innerText = roomId;
        document.getElementById('admin-badge').classList.remove('hidden');
        document.getElementById('admin-controls').classList.remove('hidden');

        setupSocketListeners();
    } else {
        alert("السيرفر غير متصل بـ Socket.io محلياً.");
    }
}

function submitJoinRoom() {
    playerName = document.getElementById('player-name').value.trim() || "اللاعب 1";
    roomId = document.getElementById('room-id-input').value.trim().toUpperCase();

    if (!roomId) {
        alert("الرجاء إدخال كود الغرفة!");
        return;
    }

    isRoomAdmin = false;

    if (typeof io !== 'undefined') {
        socket = io();
        socket.emit('joinRoom', { roomId, playerName });

        document.getElementById('join-room-panel').classList.add('hidden');
        document.getElementById('waiting-room-panel').classList.remove('hidden');
        document.getElementById('display-room-code').innerText = roomId;
        document.getElementById('admin-badge').classList.add('hidden');
        document.getElementById('admin-controls').classList.add('hidden');

        setupSocketListeners();
    } else {
        alert("السيرفر غير متصل بـ Socket.io محلياً.");
    }
}

function setupSocketListeners() {
    socket.on('updateRoomPlayers', (data) => {
        const listDiv = document.getElementById('room-players-list');
        listDiv.innerHTML = "";
        data.players.forEach(p => {
            let row = document.createElement('div');
            row.className = "flex justify-between items-center py-1 border-b border-slate-800";

            let nameSpan = document.createElement('span');
            nameSpan.innerText = p.name + (p.isAdmin ? " 👑" : "");
            row.appendChild(nameSpan);

            // إذا كان المستخدم الحالي هو الرئيس ويوجد لاعبون آخرون، يمكنه قبولهم أو طردهم
            if (isRoomAdmin && !p.isAdmin) {
                let actionsDiv = document.createElement('div');
                actionsDiv.className = "space-x-1 space-x-reverse";

                if (!p.approved) {
                    let acceptBtn = document.createElement('button');
                    acceptBtn.className = "bg-emerald-600 px-2 py-0.5 rounded text-[10px] text-slate-950 font-bold";
                    acceptBtn.innerText = "قبول";
                    acceptBtn.onclick = () => socket.emit('approvePlayer', { roomId, targetSocketId: p.id });
                    actionsDiv.appendChild(acceptBtn);
                }

                let kickBtn = document.createElement('button');
                kickBtn.className = "bg-rose-600 px-2 py-0.5 rounded text-[10px] text-white font-bold";
                kickBtn.innerText = "طرد";
                kickBtn.onclick = () => socket.emit('kickPlayer', { roomId, targetSocketId: p.id });
                actionsDiv.appendChild(kickBtn);

                row.appendChild(actionsDiv);
            } else if (!p.approved && !isRoomAdmin) {
                let waitSpan = document.createElement('span');
                waitSpan.className = "text-amber-400 text-[10px]";
                waitSpan.innerText = "في انتظار موافقة الرئيس...";
                row.appendChild(waitSpan);
            }

            listDiv.appendChild(row);
        });
    });

    socket.on('kicked', () => {
        alert("تم طردك من الغرفة بواسطة رئيس المجموعة!");
        quitGame();
    });

    socket.on('startGame', (data) => {
        const opponentName = data.players.find(p => p !== playerName) || "الخصم";
        document.getElementById('p2-title').innerText = `شاشة الخصم (${opponentName})`;
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        isPlaying = true;
        generateQuestion();
    });

    socket.on('liveTyping', (data) => {
        const oppDisplay = document.getElementById('p2-display');
        const oppBox = document.getElementById('opponent-screen-box');
        oppDisplay.innerText = data.text === "" ? "يفكر..." : data.text;
        oppBox.classList.add('opponent-active');
        setTimeout(() => oppBox.classList.remove('opponent-active'), 300);
    });

    socket.on('scoreUpdate', (scores) => {
        p1Score = scores[playerName] || p1Score;
        for (let p in scores) {
            if (p !== playerName) {
                p2Score = scores[p];
                document.getElementById('p2-score').innerText = p2Score;
            }
        }
        document.getElementById('p1-score').innerText = p1Score;
    });

    socket.on('nextQuestion', () => {
        generateQuestion();
    });
}

function adminStartGame() {
    socket.emit('adminStartGame', { roomId });
}

// تشغيل البوت أو نفس الجهاز المحلّي
function startApp() {
    if (gameMode === 'online') return; // الإدارة تتم عبر إنشاء أو انضمام مجموعة

    playerName = document.getElementById('player-name').value.trim() || "اللاعب 1";
    document.getElementById('p1-title').innerText = `شاشتك (${playerName})`;

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    if (gameMode === 'bot') {
        document.getElementById('p2-title').innerText = `🤖 البوت الذكي`;
        document.getElementById('p2-keypad-container').style.opacity = "0.4";
    } else {
        document.getElementById('p2-title').innerText = "👥 اللاعب الثاني (الكيبورد الثاني)";
        document.getElementById('p2-keypad-container').style.opacity = "1";
    }

    currentLevel = 1;
    p1Score = 0;
    p2Score = 0;
    updateUI();
    isPlaying = true;
    generateQuestion();
}

function updateUI() {
    document.getElementById('current-level').innerText = currentLevel;
    document.getElementById('p1-score').innerText = p1Score;
    document.getElementById('p2-score').innerText = p2Score;
}

// ================= كيبورد اللاعب الأول (P1) =================
function p1Append(num) {
    if (!isPlaying) return;
    p1InputStr += num;
    document.getElementById('p1-display').innerText = p1InputStr;

    if (gameMode === 'online' && socket) {
        socket.emit('typing', { roomId, text: p1InputStr });
    }
}

function p1Clear() {
    p1InputStr = "";
    document.getElementById('p1-display').innerHTML = `<span class="text-slate-600 text-xs">اكتب هنا...</span>`;
    if (gameMode === 'online' && socket) {
        socket.emit('typing', { roomId, text: "" });
    }
}

function p1Backspace() {
    p1InputStr = p1InputStr.slice(0, -1);
    if (p1InputStr === "") p1Clear();
    else document.getElementById('p1-display').innerText = p1InputStr;

    if (gameMode === 'online' && socket) {
        socket.emit('typing', { roomId, text: p1InputStr });
    }
}

function p1Submit() {
    if (!isPlaying || p1InputStr === "") return;
    const val = parseFloat(p1InputStr);
    const feedback = document.getElementById('feedback-msg');

    if (val === currentAnswer) {
        if (gameMode === 'bot') {
            if (botTimer) clearTimeout(botTimer);
            p1Score += 10;
            feedback.innerText = `✨ ${playerName} سجل نقطة!`;
            feedback.className = "text-center h-4 text-xs font-bold text-cyan-400";
            updateUI();
            checkGameEnd();
        } else if (gameMode === 'local') {
            p1Score += 10;
            feedback.innerText = `✨ ${playerName} أجاب صح!`;
            feedback.className = "text-center h-4 text-xs font-bold text-cyan-400";
            updateUI();
            checkGameEnd();
        } else if (gameMode === 'online' && socket) {
            socket.emit('submitCorrectAnswer', { roomId, playerName });
        }
    } else {
        feedback.innerText = `❌ ${playerName} أخطأ!`;
        feedback.className = "text-center h-4 text-xs font-bold text-rose-400";
        p1Clear();
    }
}

// ================= كيبورد اللاعب الثاني (P2) =================
function p2Append(num) {
    if (!isPlaying || gameMode === 'bot') return;
    p2InputStr += num;
    document.getElementById('p2-display').innerText = p2InputStr;
}

function p2Clear() {
    if (gameMode === 'bot') return;
    p2InputStr = "";
    document.getElementById('p2-display').innerHTML = `<span class="text-slate-600 text-xs">كيبورد الخصم...</span>`;
}

function p2Backspace() {
    if (gameMode === 'bot') return;
    p2InputStr = p2InputStr.slice(0, -1);
    if (p2InputStr === "") p2Clear();
    else document.getElementById('p2-display').innerText = p2InputStr;
}

function p2Submit() {
    if (!isPlaying || gameMode === 'bot' || p2InputStr === "") return;
    const val = parseFloat(p2InputStr);
    const feedback = document.getElementById('feedback-msg');

    if (val === currentAnswer) {
        p2Score += 10;
        feedback.innerText = "✨ اللاعب الثاني سجل نقطة!";
        feedback.className = "text-center h-4 text-xs font-bold text-rose-400";
        updateUI();
        checkGameEnd();
    } else {
        feedback.innerText = "❌ اللاعب الثاني أخطأ!";
        feedback.className = "text-center h-4 text-xs font-bold text-rose-400";
        p2Clear();
    }
}

// ================= توليد الأسئلة =================
function generateQuestion() {
    if (!isPlaying) return;
    if (botTimer) clearTimeout(botTimer);

    p1InputStr = "";
    p2InputStr = "";
    document.getElementById('p1-display').innerHTML = `<span class="text-slate-600 text-xs">اكتب هنا...</span>`;
    if (gameMode !== 'bot') {
        document.getElementById('p2-display').innerHTML = `<span class="text-slate-600 text-xs">كيبورد الخصم...</span>`;
    }

    let qText = "";
    let ans = 0;

    if (currentLevel === 1) {
        let n1 = Math.floor(Math.random() * 10) + 1;
        let n2 = Math.floor(Math.random() * 10) + 1;
        qText = `${n1} + ${n2}`; ans = n1 + n2;
    } else if (currentLevel === 2) {
        let n1 = Math.floor(Math.random() * 15) + 5;
        let n2 = Math.floor(Math.random() * 10) + 1;
        qText = `${n1} - ${n2}`; ans = n1 - n2;
    } else if (currentLevel === 3) {
        let n1 = Math.floor(Math.random() * 10) + 2;
        let n2 = Math.floor(Math.random() * 10) + 2;
        qText = `${n1} × ${n2}`; ans = n1 * n2;
    } else if (currentLevel === 4) {
        let ansTemp = Math.floor(Math.random() * 10) + 2;
        let n2 = Math.floor(Math.random() * 10) + 2;
        let n1 = ansTemp * n2;
        qText = `${n1} ÷ ${n2}`; ans = ansTemp;
    } else {
        let n1 = Math.floor(Math.random() * 5) + 2;
        qText = `${n1} ² (مربع العدد)`; ans = n1 * n1;
    }

    currentAnswer = ans;
    document.getElementById('question-box').innerText = qText;
    document.getElementById('feedback-msg').innerText = "";

    if (gameMode === 'bot') {
        document.getElementById('p2-display').innerText = "يفكر...";
        botTimer = setTimeout(() => {
            if (isPlaying) {
                p2Score += 10;
                document.getElementById('p2-display').innerText = currentAnswer;
                document.getElementById('feedback-msg').innerText = `🤖 سبقك البوت في هذا السؤال!`;
                document.getElementById('feedback-msg').className = "text-center h-4 text-xs font-bold text-rose-400";
                updateUI();
                checkGameEnd();
            }
        }, botDelay);
    }
}

function checkGameEnd() {
    setTimeout(() => {
        if (p1Score >= 50 || p2Score >= 50) {
            alert(p1Score >= 50 ? `🏆 مبروك فاز ${playerName}!` : "🤖 انتهت اللعبة.. فاز المنافس!");
            quitGame();
            return;
        }
        if ((p1Score + p2Score) % 20 === 0 && currentLevel < 10) {
            currentLevel++;
        }
        generateQuestion();
    }, 1000);
}

function quitGame() {
    if (botTimer) clearTimeout(botTimer);
    isPlaying = false;
    if (socket) socket.disconnect();
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('waiting-room-panel').classList.add('hidden');
}