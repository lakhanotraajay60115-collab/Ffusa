// A. જરૂરી મોડ્યુલ્સ ઇમ્પોર્ટ કરો
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server); 

// B. જરૂરી ચલ (Variables)
let currentAlphabet = ''; 
let players = {}; 
let roundActive = false;
let answers = []; 
let currentLanguage = 'gu'; // Default to Gujarati
let hostId = null; // Host ના Socket ID ને સંગ્રહ કરવા માટે

// ગુજરાતી, હિન્દી અને અંગ્રેજી મૂળાક્ષરો (ભાષા પ્રમાણે)
const languageAlphabets = {
    gu: ["ક", "ખ", "ગ", "ચ", "ટ", "ત", "પ", "મ", "ર", "વ", "સ"], 
    hi: ["अ", "इ", "उ", "ए", "ओ", "श", "भ", "झ", "य", "ર", "લ", "વ"], 
    en: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
}; 

// C. સ્ટેટિક ફાઇલોને સર્વ કરો (HTML, CSS, Client JS)
app.use(express.static('public')); 

// D. Socket.IO કનેક્શન લોજિક
io.on('connection', (socket) => {
    console.log('નવો ખેલાડી જોડાયો:', socket.id);
    
    // ખેલાડીને ID આપો અને તેને ગ્લોબલ લિસ્ટમાં ઉમેરો
    players[socket.id] = { id: socket.id, name: 'અજાણ્યો', score: 0 };

    // --- ૧. લૉગિન / નામ સેટ કરવું ---
    socket.on('registerName', (playerName) => {
        players[socket.id].name = playerName;
        
        // નવું: પ્રથમ જોડાયેલા ખેલાડીને Host બનાવો
        if (hostId === null) {
            hostId = socket.id;
            socket.emit('setHost', true);
        } else if (socket.id === hostId) {
            socket.emit('setHost', true); // Host ફરી જોડાય તો તેની સ્થિતિ અપડેટ કરો
        } else {
             socket.emit('setHost', false);
        }
        
        // બધાને ખેલાડીઓની અપડેટ કરેલી યાદી મોકલો
        io.emit('playerListUpdate', players); 
        
        // Host ને વર્તમાન ભાષા મોકલો
        socket.emit('languageChanged', currentLanguage);
        
        // જો 2 કે તેથી વધુ ખેલાડીઓ હોય તો ગેમ શરૂ કરો
        if (Object.keys(players).length >= 2 && !roundActive) {
            startNewRound();
        }
    });

    // --- ૨. ખેલાડી ડિસ્કનેક્ટ થાય ત્યારે ---
    socket.on('disconnect', () => {
        console.log('ખેલાડી છોડી ગયો:', socket.id);
        delete players[socket.id];
        
        // નવું: જો Host ડિસ્કનેક્ટ થાય, તો નવો Host સેટ કરો
        if (socket.id === hostId) {
            hostId = Object.keys(players).length > 0 ? Object.keys(players)[0] : null;
            if (hostId) {
                io.to(hostId).emit('setHost', true); // નવા Host ને જણાવો
            }
        }
        
        io.emit('playerListUpdate', players);
    });

    // --- ૩. ખેલાડી જવાબ સબમિટ કરે ત્યારે ---
    socket.on('submitAnswer', (data) => {
        if (!roundActive) return;
        answers.push({ playerId: socket.id, player: players[socket.id].name, data });
        console.log(`${players[socket.id].name} એ જવાબ સબમિટ કર્યો.`);

        if (answers.length === Object.keys(players).length) {
            endRoundAndCalculateScore();
        }
    });
    
    // --- ૪. Host દ્વારા ભાષા બદલવી (નવું Event) ---
    socket.on('setLanguage', (langCode) => {
        // ખાતરી કરો કે બદલનાર વ્યક્તિ Host છે અને કોડ માન્ય છે
        if (socket.id === hostId && languageAlphabets[langCode]) {
            currentLanguage = langCode;
            // બધાને જણાવો કે ભાષા બદલાઈ ગઈ છે
            io.emit('languageChanged', currentLanguage);
            console.log(`Host એ ભાષા બદલી: ${currentLanguage}`);
            
            // જો રાઉન્ડ શરૂ ન હોય અને પૂરતા ખેલાડીઓ હોય, તો તરત નવો રાઉન્ડ શરૂ કરો
            if (Object.keys(players).length >= 2 && !roundActive) {
                startNewRound(); 
            }
        }
    });
});

// E. ગેમ મેનેજમેન્ટ કાર્યો
function startNewRound() {
    roundActive = true;
    answers = [];
    
    // વર્તમાન ભાષાના મૂળાક્ષરોમાંથી પસંદ કરો
    const alphabets = languageAlphabets[currentLanguage];
    const randomIndex = Math.floor(Math.random() * alphabets.length);
    currentAlphabet = alphabets[randomIndex];

    // બધા ખેલાડીઓને નવો અક્ષર અને વર્તમાન ભાષા મોકલો
    io.emit('newRound', { alphabet: currentAlphabet, roundNumber: 1, lang: currentLanguage }); 
    console.log(`નવો રાઉન્ડ શરૂ થયો. ભાષા: ${currentLanguage}, અક્ષર: ${currentAlphabet}`);

    // ટાઈમર સેટ કરો (દા.ત., 60 સેકન્ડ)
    setTimeout(endRoundAndCalculateScore, 60000); 
}

function endRoundAndCalculateScore() {
    if (!roundActive) return;
    roundActive = false;
    
    const currentAlphabetToMatch = currentAlphabet.trim(); 
    const categories = ['boy', 'girl', 'village', 'item'];
    
    // 1. દરેક કેટેગરીમાં જવાબોની ગણતરી કરો
    const answerCounts = {};
    
    categories.forEach(category => {
        answerCounts[category] = {};
        answers.forEach(answer => {
            const answerValue = answer.data[category].trim();
            if (answerValue) {
                // નાના અક્ષરોમાં રૂપાંતરિત કરીને ગણતરી કરો
                const normalizedAnswer = answerValue.toLowerCase();
                answerCounts[category][normalizedAnswer] = (answerCounts[category][normalizedAnswer] || 0) + 1;
            }
        });
    });

    // 2. દરેક ખેલાડી માટે સ્કોરની ગણતરી કરો
    answers.forEach(submission => {
        let roundScore = 0;
        const playerId = submission.playerId;
        
        categories.forEach(category => {
            const answerValue = submission.data[category].trim();
            
            if (!answerValue) {
                return; 
            }

            // પ્રથમ અક્ષરની ચકાસણી (Validation)
            const firstChar = answerValue.charAt(0).trim();
            
            let isMatch = false;

            if (currentLanguage === 'en') {
                // અંગ્રેજી માટે: કેસ-ઇન્સેન્સિટિવ મેચ (A=a)
                if (firstChar.toLowerCase() === currentAlphabetToMatch.toLowerCase()) {
                    isMatch = true;
                }
            } else {
                // ગુજરાતી/હિન્દી માટે: સીધી મેચ
                if (firstChar === currentAlphabetToMatch) {
                    isMatch = true;
                }
            }

            if (!isMatch) {
                 return;
            }

            // યુનિકનેસ (Uniqueness) ચકાસણી
            const normalizedAnswer = answerValue.toLowerCase();
            const count = answerCounts[category][normalizedAnswer];

            if (count === 1) {
                roundScore += 10; // અનોખો જવાબ: 10 પોઈન્ટ
            } else if (count > 1) {
                roundScore += 5; // મેચ થયેલો જવાબ: 5 પોઈન્ટ
            }
        });

        // ખેલાડીના કુલ સ્કોરમાં ઉમેરો
        players[playerId].score += roundScore;
        console.log(`${players[playerId].name} ને આ રાઉન્ડમાં ${roundScore} પોઈન્ટ મળ્યા.`);
    });
    
    console.log('રાઉન્ડ સમાપ્ત થયો. સ્કોર અપડેટ થઈ ગયો.', players);
    
    io.emit('scoreUpdate', players); 
    setTimeout(startNewRound, 10000); 
}

// F. સર્વરને પોર્ટ 3000 પર શરૂ કરો
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`સર્વર પોર્ટ ${PORT} પર ચાલુ છે. (http://localhost:${PORT})`);
});
