// ============ ESTADO GLOBAL ============
const APP_STATE = {
    phrase: [],
    events: [],
    customCards: [],
    favorites: []
};

// ============ CARTÕES ============
const QUICK_CARDS = [
    { icon: '😊', label: 'Estou bem', speech: 'Estou bem' },
    { icon: '😣', label: 'Estou com dor', speech: 'Estou com dor' },
    { icon: '😢', label: 'Estou triste', speech: 'Estou triste' },
    { icon: '😡', label: 'Estou bravo', speech: 'Estou bravo' },
    { icon: '😴', label: 'Estou cansado', speech: 'Estou cansado' },
    { icon: '🌸', label: 'Quero calma', speech: 'Quero calma' },
    { icon: '💧', label: 'Quero água', speech: 'Quero água' },
    { icon: '🍎', label: 'Quero comer', speech: 'Quero comer' }
];

const WORD_CARDS = [
    { word: 'eu', display: 'Eu', icon: '👤' },
    { word: 'quero', display: 'quero', icon: '💗' },
    { word: 'não', display: 'não', icon: '🚫' },
    { word: 'preciso', display: 'preciso', icon: '🆘' },
    { word: 'água', display: 'água', icon: '💧' },
    { word: 'comer', display: 'comer', icon: '🍎' },
    { word: 'banheiro', display: 'banheiro', icon: '🚽' },
    { word: 'ajuda', display: 'ajuda', icon: '🆘' },
    { word: 'carinho', display: 'carinho', icon: '❤️' },
    { word: 'brincar', display: 'brincar', icon: '🎮' },
    { word: 'desenhar', display: 'desenhar', icon: '🎨' },
    { word: 'calma', display: 'calma', icon: '🌸' }
];

// ============ GOOGLE GEMINI IA ============
class GeminiAI {
    constructor() {
        this.apiKey = null;
        this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
        this.isConfigured = false;
    }
    
    init(key) {
        this.apiKey = key;
        this.isConfigured = true;
        localStorage.setItem('bia_gemini_key', key);
    }
    
    loadKey() {
        const stored = localStorage.getItem('bia_gemini_key');
        if (stored) {
            this.apiKey = stored;
            this.isConfigured = true;
            return true;
        }
        return false;
    }
    
    async generate(prompt) {
        if (!this.apiKey) {
            console.warn('API Key não configurada');
            return null;
        }
        
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-goog-api-key': this.apiKey 
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 200
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || null;
        } catch (error) {
            console.error('Erro Gemini:', error);
            return null;
        }
    }
    
    async chat(message) {
        const prompt = `Você é um assistente amigável para uma criança.
        Responda de forma simples, carinhosa e encorajadora.
        Use frases curtas.
        
        Mensagem: "${message}"`;
        
        return await this.generate(prompt);
    }
    
    async getRecommendations(history) {
        const prompt = `Baseado neste histórico de comunicação:
        ${JSON.stringify(history.slice(-10))}
        
        Sugira 3 cartões de comunicação que a criança pode precisar agora.
        Responda APENAS com JSON no formato:
        {"suggestions": [{"icon": "😊", "label": "Exemplo"}]}`;
        
        const result = await this.generate(prompt);
        if (!result) return null;
        
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (error) {
            console.error('Erro ao parsear recomendações:', error);
            return null;
        }
    }
    
    async generateReport(events) {
        const prompt = `Gere um relatório sobre estas interações de uma criança:
        ${JSON.stringify(events)}
        
        Inclua:
        1. Resumo geral
        2. Emoções predominantes
        3. Padrões identificados
        4. Sugestões para responsáveis
        
        Responda em português, de forma clara e acolhedora.`;
        
        return await this.generate(prompt);
    }
}

const geminiAI = new GeminiAI();

// ============ NAVEGAÇÃO ============
function showTab(tabName, btn) {
    const tabs = ['comunicacao', 'perfil', 'medica', 'responsavel', 'cartoes', 'ia', 'seguranca'];
    tabs.forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if (el) el.style.display = 'none';
    });
    
    const selected = document.getElementById('tab-' + tabName);
    if (selected) selected.style.display = 'block';
    
    document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Atualizar URL hash
    if (tabName !== 'comunicacao') {
        history.pushState(null, '', '#' + tabName);
    } else {
        history.pushState(null, '', '#');
    }
}

// ============ AÇÕES RÁPIDAS ============
function handleHereAction(event) {
    if (event) event.preventDefault();
    speak('Eu estou aqui');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    showModal('❤️', 'Presença registrada!', 'Você mostrou que está presente.');
    logEvent('Eu estou aqui', 'communication');
}

function handleUnknownAction(event) {
    if (event) event.preventDefault();
    speak('Eu não sei');
    showModal('❓', 'Tudo bem!', 'Escolha outro cartão ou peça ajuda.');
    logEvent('Não sei', 'communication');
}

function handleShowAction(event) {
    if (event) event.preventDefault();
    speak('Quero mostrar ao responsável');
    const responsible = getResponsible();
    if (responsible.phone) {
        openWhatsApp(responsible.phone, 'Quero mostrar algo importante.');
    } else {
        showModal('⚠️', 'Responsável não cadastrado', 'Cadastre na aba Responsável.');
    }
}

// ============ MODAL ============
function showModal(emoji, title, message) {
    document.getElementById('modalEmoji').textContent = emoji;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// ============ VOZ ============
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        
        const rate = parseFloat(document.getElementById('voiceRate')?.value || 0.9);
        const pitch = parseFloat(document.getElementById('voicePitch')?.value || 1.1);
        utterance.rate = rate;
        utterance.pitch = pitch;
        
        // Tentar encontrar uma voz em português
        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang.startsWith('pt'));
        if (ptVoice) utterance.voice = ptVoice;
        
        window.speechSynthesis.speak(utterance);
    }
}

function speakPhrase() {
    if (APP_STATE.phrase.length === 0) {
        showModal('⚠️', 'Frase vazia', 'Selecione cartões primeiro');
        return;
    }
    speak(APP_STATE.phrase.join(' '));
}

function testVoice() {
    speak('Olá! Eu sou a Bia!');
}

function updateRateLabel() {
    document.getElementById('rateValue').textContent = 
        parseFloat(document.getElementById('voiceRate').value).toFixed(1);
}

function updatePitchLabel() {
    document.getElementById('pitchValue').textContent = 
        parseFloat(document.getElementById('voicePitch').value).toFixed(1);
}

// ============ CARTÕES ============
function renderQuickCards() {
    const container = document.getElementById('quickCards');
    const allCards = [...QUICK_CARDS];
    
    APP_STATE.customCards.forEach(card => {
        allCards.push({ icon: card.emoji, label: card.name, speech: card.name });
    });
    
    container.innerHTML = allCards.map((card, i) => `
        <button class="card" onclick="useQuickCard(${i})" aria-label="${card.label}">
            <span class="emoji" aria-hidden="true">${card.icon}</span>
            <strong>${card.label}</strong>
        </button>
    `).join('');
}

function renderWordCards() {
    const container = document.getElementById('wordCards');
    container.innerHTML = WORD_CARDS.map((card, i) => `
        <button class="card" onclick="addWord(${i})" aria-label="Adicionar ${card.display}">
            <span class="emoji" aria-hidden="true">${card.icon}</span>
            <strong>${card.display}</strong>
        </button>
    `).join('');
}

function useQuickCard(index) {
    const allCards = [...QUICK_CARDS];
    APP_STATE.customCards.forEach(card => {
        allCards.push({ icon: card.emoji, label: card.name, speech: card.name });
    });
    
    const card = allCards[index];
    if (card) {
        speak(card.speech);
        logEvent(card.label, 'communication');
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

function addWord(index) {
    const word = WORD_CARDS[index];
    APP_STATE.phrase.push(word.word);
    renderPhrase();
    if (navigator.vibrate) navigator.vibrate(10);
}

function renderPhrase() {
    const display = document.getElementById('currentPhrase');
    display.textContent = APP_STATE.phrase.length === 0 ? 
        'Nenhum cartão selecionado' : APP_STATE.phrase.join(' ');
}

function undoLast() { 
    if (APP_STATE.phrase.length > 0) {
        APP_STATE.phrase.pop(); 
        renderPhrase();
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

function clearPhrase() { 
    APP_STATE.phrase = []; 
    renderPhrase();
    if (navigator.vibrate) navigator.vibrate(10);
}

function savePhrase() {
    if (APP_STATE.phrase.length === 0) {
        showModal('⚠️', 'Frase vazia', 'Monte uma frase primeiro');
        return;
    }
    APP_STATE.favorites.push(APP_STATE.phrase.join(' '));
    saveState();
    showModal('⭐', 'Frase salva!', 'Adicionada aos favoritos.');
}

// ============ CARTÕES PERSONALIZADOS ============
function addCustomCard() {
    const name = document.getElementById('newCardName').value.trim();
    const emoji = document.getElementById('newCardEmoji').value.trim() || '📝';
    
    if (!name) { 
        showModal('⚠️', 'Nome obrigatório', 'Digite um nome para o cartão');
        return; 
    }
    
    APP_STATE.customCards.push({ id: Date.now(), name, emoji });
    saveState();
    renderCustomCards();
    renderQuickCards();
    showModal('✅', 'Cartão criado!', `"${name}" foi adicionado.`);
    
    document.getElementById('newCardName').value = '';
    document.getElementById('newCardEmoji').value = '';
}

function renderCustomCards() {
    const container = document.getElementById('customCardsList');
    container.innerHTML = APP_STATE.customCards.length === 0 ?
        '<p class="status">Nenhum cartão personalizado.</p>' :
        APP_STATE.customCards.map(card => `
            <div class="card">
                <span class="emoji" aria-hidden="true">${card.emoji}</span>
                <strong>${card.name}</strong>
            </div>
        `).join('');
}

// ============ IA GEMINI ============
function saveGeminiKey() {
    const key = document.getElementById('geminiApiKey').value.trim();
    if (!key) { 
        showModal('⚠️', 'Chave obrigatória', 'Cole sua API Key do Gemini');
        return; 
    }
    
    geminiAI.init(key);
    document.getElementById('geminiStatus').textContent = '✅ Chave salva!';
    document.getElementById('geminiApiKey').value = '';
    showModal('🤖', 'Gemini configurado!', 'IA ativada com sucesso.');
    
    // Mostrar seção de recomendações
    document.getElementById('aiRecommendationsSection').style.display = 'block';
    loadAIRecommendations();
}

async function testGemini() {
    const status = document.getElementById('geminiStatus');
    status.textContent = '🔄 Testando...';
    
    const result = await geminiAI.chat('Olá! Me diga uma mensagem de boas-vindas.');
    
    if (result) {
        status.textContent = '✅ Funcionando!';
        showModal('🤖', 'IA Online!', result);
    } else {
        status.textContent = '❌ Erro na conexão. Verifique sua API Key.';
    }
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    const history = document.getElementById('chatHistory');
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-message user';
    userBubble.textContent = '👤 ' + message;
    history.appendChild(userBubble);
    input.value = '';
    history.scrollTop = history.scrollHeight;
    
    const response = await geminiAI.chat(message);
    if (response) {
        const aiBubble = document.createElement('div');
        aiBubble.className = 'chat-message ai';
        aiBubble.textContent = '🤖 ' + response;
        history.appendChild(aiBubble);
        history.scrollTop = history.scrollHeight;
        speak(response);
    } else {
        const errorBubble = document.createElement('div');
        errorBubble.className = 'chat-message ai';
        errorBubble.textContent = '🤖 Desculpe, não consegui responder agora.';
        history.appendChild(errorBubble);
        history.scrollTop = history.scrollHeight;
    }
}

async function generateSmartReport() {
    if (!geminiAI.isConfigured) {
        showModal('⚠️', 'IA não configurada', 'Configure a API Key primeiro');
        return;
    }
    
    if (APP_STATE.events.length === 0) {
        showModal('📊', 'Sem dados', 'Ainda não há interações registradas.');
        return;
    }
    
    const result = await geminiAI.generateReport(APP_STATE.events);
    if (result) {
        document.getElementById('reportResult').textContent = result;
        showModal('📊', 'Relatório Gerado', result.substring(0, 200) + '...');
    } else {
        showModal('❌', 'Erro', 'Não foi possível gerar o relatório.');
    }
}

async function loadAIRecommendations() {
    if (!geminiAI.isConfigured) return;
    
    const result = await geminiAI.getRecommendations(APP_STATE.events);
    if (result && result.suggestions) {
        const container = document.getElementById('aiSuggestions');
        container.innerHTML = '';
        result.suggestions.slice(0, 6).forEach(s => {
            if (!s || !s.label) return;
            const button = document.createElement('button');
            button.className = 'card';
            button.type = 'button';
            button.setAttribute('aria-label', s.label);
            button.addEventListener('click', () => {
                speak(String(s.label));
                if (navigator.vibrate) navigator.vibrate(10);
            });
            const icon = document.createElement('span');
            icon.className = 'emoji';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = s.icon || '💬';
            const label = document.createElement('strong');
            label.textContent = String(s.label);
            button.append(icon, label);
            container.appendChild(button);
        });
    }
}

// ============ PERFIL ============
function saveChildProfile() {
    const profile = {
        name: document.getElementById('childName').value,
        nickname: document.getElementById('childNickname').value,
        birth: document.getElementById('childBirth').value,
        communication: document.getElementById('childCommunication').value,
        favorites: document.getElementById('childFavorites').value,
        avoids: document.getElementById('childAvoids').value,
        calm: document.getElementById('childCalm').value
    };
    localStorage.setItem('bia_profile', JSON.stringify(profile));
    document.getElementById('profileStatus').textContent = '✅ Perfil salvo!';
    showModal('✅', 'Perfil salvo!', 'Informações atualizadas.');
}

// ============ MÉDICO ============
function saveMedicalInfo() {
    const medical = {
        healthPlan: document.getElementById('healthPlan').value,
        bloodType: document.getElementById('bloodType').value,
        allergies: document.getElementById('allergies').value,
        notes: document.getElementById('medicalNotes').value
    };
    localStorage.setItem('bia_medical', JSON.stringify(medical));
    document.getElementById('medicalStatus').textContent = '✅ Informações salvas!';
    showModal('✅', 'Salvo!', 'Informações médicas protegidas.');
}

// ============ RESPONSÁVEL ============
function saveResponsible() {
    const data = {
        name: document.getElementById('responsibleName').value,
        phone: document.getElementById('responsiblePhone').value.replace(/[^\d]/g, '')
    };
    localStorage.setItem('bia_responsible', JSON.stringify(data));
    document.getElementById('responsibleStatus').textContent = '✅ Dados salvos!';
    showModal('✅', 'Salvo!', 'Dados atualizados.');
}

function getResponsible() {
    try { return JSON.parse(localStorage.getItem('bia_responsible') || '{}'); }
    catch { return {}; }
}

function openWhatsApp(phone, message) {
    const clean = phone.replace(/\D/g, '');
    const full = clean.length <= 11 ? '55' + clean : clean;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendEmergency(type) {
    const responsible = getResponsible();
    if (!responsible.phone) { 
        showModal('⚠️', 'Responsável não cadastrado', 'Cadastre na aba Responsável.');
        return; 
    }
    
    const messages = {
        help: '🆘 Preciso de ajuda!',
        alert: '⚠️ Alerta!',
        notice: '🔔 Aviso!'
    };
    
    openWhatsApp(responsible.phone, messages[type]);
    logEvent('Contato: ' + type, 'help');
}

// ============ PIN ============
async function hashPIN(pin) {
    const data = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function setupPIN() {
    const pin = document.getElementById('setupPin').value;
    const confirm = document.getElementById('confirmPin').value;
    
    if (!/^[0-9]{4,6}$/.test(pin)) { 
        showModal('⚠️', 'PIN inválido', 'Use um PIN de 4 a 6 dígitos.');
        return; 
    }
    if (pin !== confirm) { 
        showModal('⚠️', 'PINs não coincidem', 'Digite o mesmo PIN nos dois campos.');
        return; 
    }
    
    try {
        const hash = await hashPIN(pin);
        localStorage.setItem('bia_pin_hash', hash);
        localStorage.removeItem('bia_pin');
        document.getElementById('pinStatus').textContent = '✅ PIN configurado.';
        showModal('🔒', 'PIN configurado!', 'O PIN não é armazenado em texto simples.');
    } catch (error) {
        console.error('Erro ao proteger PIN:', error);
        showModal('❌', 'Erro', 'Não foi possível configurar o PIN neste navegador.');
    } finally {
        document.getElementById('setupPin').value = '';
        document.getElementById('confirmPin').value = '';
    }
}

// ============ TEMA ============
function toggleTheme() {
    const isBlue = document.body.classList.contains('theme-blue');
    document.body.classList.toggle('theme-blue', !isBlue);
    localStorage.setItem('bia_theme', isBlue ? 'pink' : 'blue');
    document.getElementById('themeBtn').textContent = isBlue ? '🔵 Tema azul' : '🌸 Tema rosa';
}

// ============ EVENTOS ============
function logEvent(label, type) {
    APP_STATE.events.push({ label, type, timestamp: new Date().toISOString() });
    saveState();
    updateMetrics();
}

function updateMetrics() {
    document.getElementById('metricInteractions').textContent = APP_STATE.events.length;
    document.getElementById('metricHelp').textContent = 
        APP_STATE.events.filter(e => e.type === 'help').length;
}

// ============ PERSISTÊNCIA ============
function saveState() {
    localStorage.setItem('bia_state', JSON.stringify({
        events: APP_STATE.events,
        customCards: APP_STATE.customCards,
        favorites: APP_STATE.favorites
    }));
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem('bia_state') || '{}');
        APP_STATE.events = saved.events || [];
        APP_STATE.customCards = saved.customCards || [];
        APP_STATE.favorites = saved.favorites || [];
    } catch (error) {
        console.error('Erro ao carregar estado:', error);
    }
}

// ============ INICIALIZAÇÃO ============
function init() {
    loadState();
    renderQuickCards();
    renderWordCards();
    renderPhrase();
    renderCustomCards();
    updateMetrics();
    
    // Carregar chave Gemini
    if (geminiAI.loadKey()) {
        document.getElementById('aiRecommendationsSection').style.display = 'block';
        loadAIRecommendations();
    }
    
    // Carregar tema
    const theme = localStorage.getItem('bia_theme');
    if (theme === 'blue') {
        document.body.classList.add('theme-blue');
        document.getElementById('themeBtn').textContent = '🌸 Tema rosa';
    }
    
    // Carregar dados salvos
    loadSavedData();
    
    // Event listeners
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    
    // Carregar vozes disponíveis
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            const voices = window.speechSynthesis.getVoices();
            const ptVoice = voices.find(v => v.lang.startsWith('pt'));
            if (ptVoice) {
                document.getElementById('currentVoiceName').textContent = ptVoice.name;
            }
        };
    }
    
    handleShortcutHash();
}

function loadSavedData() {
    // Carregar perfil
    try {
        const profile = JSON.parse(localStorage.getItem('bia_profile') || '{}');
        if (profile.name) document.getElementById('childName').value = profile.name;
        if (profile.nickname) document.getElementById('childNickname').value = profile.nickname;
        if (profile.birth) document.getElementById('childBirth').value = profile.birth;
        if (profile.communication) document.getElementById('childCommunication').value = profile.communication;
        if (profile.favorites) document.getElementById('childFavorites').value = profile.favorites;
        if (profile.avoids) document.getElementById('childAvoids').value = profile.avoids;
        if (profile.calm) document.getElementById('childCalm').value = profile.calm;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
    
    // Carregar médico
    try {
        const medical = JSON.parse(localStorage.getItem('bia_medical') || '{}');
        if (medical.healthPlan) document.getElementById('healthPlan').value = medical.healthPlan;
        if (medical.bloodType) document.getElementById('bloodType').value = medical.bloodType;
        if (medical.allergies) document.getElementById('allergies').value = medical.allergies;
        if (medical.notes) document.getElementById('medicalNotes').value = medical.notes;
    } catch (error) {
        console.error('Erro ao carregar dados médicos:', error);
    }
    
    // Carregar responsável
    try {
        const responsible = JSON.parse(localStorage.getItem('bia_responsible') || '{}');
        if (responsible.name) document.getElementById('responsibleName').value = responsible.name;
        if (responsible.phone) document.getElementById('responsiblePhone').value = responsible.phone;
    } catch (error) {
        console.error('Erro ao carregar responsável:', error);
    }
}

function handleShortcutHash() {
    const hash = location.hash.replace('#', '');
    const allowed = { 
        comunicacao: 'comunicacao', 
        perfil: 'perfil', 
        medica: 'medica', 
        responsavel: 'responsavel', 
        cartoes: 'cartoes', 
        ia: 'ia', 
        seguranca: 'seguranca' 
    };
    if (!allowed[hash]) return;
    const buttons = document.querySelectorAll('.nav-tabs button');
    const index = ['comunicacao', 'perfil', 'medica', 'responsavel', 'cartoes', 'ia', 'seguranca'].indexOf(hash);
    if (index >= 0 && buttons[index]) {
        showTab(hash, buttons[index]);
    }
}

// ============ INICIALIZAR ============
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

// Atualizar handle de hash
window.addEventListener('hashchange', handleShortcutHash);