// A. જરૂરી મોડ્યુલ્સ ઇમ્પોર્ટ કરો
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
// Socket.IO ને HTTP સર્વર સાથે જોડો
const io = socketIo(server); 

// B. જરૂરી ચલ (Variables)
let currentAlphabet = ''; 
let players = {}; // બધા ખેલાડીઓનો ડેટા (Socket ID, Name, Score) સ્ટોર કરવા
let roundActive = false;
let answers = []; // વર્તમાન રાઉન્ડના જવાબો

// ગુજરાતી, હિન્દી અને અંગ્રેજી મૂળાક્ષરોનું મિશ્રણ (હવે મલ્ટિપલ ભાષા માટે તૈયાર)
const alphabets = [
    // ગુજરાતી (Gujarati)
    "ક", "ખ", "ગ", "ચ", "ટ", "ત", "પ", "મ", "ર", "વ", "સ",
    // હિન્દી (Hindi) - જે ગુજરાતીથી અલગ છે
    "अ", "इ", "उ", "ए", "ओ", "श", "भ", "झ", 
    // અંગ્રેજી (English)
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
]; 

// C. સ્ટેટિક ફાઇલોને સર્વ કરો (HTML, CSS, Client JS)
app.use(express.static('public')); // માની લો કે તમારી index.html 'public' ફોલ્ડરમાં છે

// D. Socket.IO કનેક્શન લોજિક
io.on('connection', (socket) => {
    console.log('નવો ખેલાડી જોડાયો:', socket.id);
    
    // ખેલાડીને ID આપો અને તેને ગ્લોબલ લિસ્ટમાં ઉમેરો
    players[socket.id] = { id: socket.id, name: 'અજાણ્યો', score: 0 };

    // --- ૧. લૉગિન / નામ સેટ કરવું ---
    socket.on('registerName', (playerName) => {
        players[socket.id].name = playerName;
        console.log(`${playerName} ગેમમાં જોડાયો.`);
        // બધાને ખેલાડીઓની અપડેટ કરેલી યાદી મોકલો
        io.emit('playerListUpdate', players); 
        
        // જો 2 કે તેથી વધુ ખેલાડીઓ હોય તો ગેમ શરૂ કરો
        if (Object.keys(players).length >= 2 && !roundActive) {
            startNewRound();
        }
    });

    // --- ૨. ખેલાડી ડિસ્કનેક્ટ થાય ત્યારે ---
    socket.on('disconnect', () => {
        console.log('ખેલાડી છોડી ગયો:', socket.id);
        delete players[socket.id];
        io.emit('playerListUpdate', players);
    });

    // --- ૩. ખેલાડી જવાબ સબમિટ કરે ત્યારે ---
    socket.on('submitAnswer', (data) => {
        if (!roundActive) return;

        // જવાબ ડેટાબેઝ/સર્વર પર સ્ટોર કરો
        answers.push({ playerId: socket.id, player: players[socket.id].name, data });
        console.log(`${players[socket.id].name} એ જવાબ સબમિટ કર્યો.`);

        // જો બધા ખેલાડીઓએ જવાબ આપી દીધો હોય, તો રાઉન્ડ સમાપ્ત કરો
        if (answers.length === Object.keys(players).length) {
            endRoundAndCalculateScore();
        }
    });
});

// E. ગેમ મેનેજમેન્ટ કાર્યો
function startNewRound() {
    roundActive = true;
    answers = [];
    const randomIndex = Math.floor(Math.random() * alphabets.length);
    currentAlphabet = alphabets[randomIndex];

    // બધા ખેલાડીઓને નવો અક્ષર મોકલો
    io.emit('newRound', { alphabet: currentAlphabet, roundNumber: 1 }); // રાઉન્ડ નંબર પણ મોકલો
    console.log(`નવો રાઉન્ડ શરૂ થયો. અક્ષર: ${currentAlphabet}`);

    // ટાઈમર સેટ કરો (દા.ત., 60 સેકન્ડ)
    setTimeout(endRoundAndCalculateScore, 60000); 
}

function endRoundAndCalculateScore() {
    if (!roundActive) return;
    roundActive = false;
    
    const currentAlphabetToMatch = currentAlphabet.trim().toLowerCase(); // કેસ-ઇન્સેન્સિટિવ મેચિંગ માટે
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
            
            // જો જવાબ ખાલી હોય તો 0 પોઈન્ટ
            if (!answerValue) {
                return; 
            }

            // પ્રથમ અક્ષરની ચકાસણી (Validation)
            const firstChar = answerValue.charAt(0).toLowerCase();
            
            // જો જવાબ વર્તમાન અક્ષરથી શરૂ થતો ન હોય તો 0 પોઈન્ટ
            if (firstChar !== currentAlphabetToMatch.toLowerCase()) {
                return;
            }

            // યુનિકનેસ (Uniqueness) ચકાસણી
            const normalizedAnswer = answerValue.toLowerCase();
            const count = answerCounts[category][normalizedAnswer];

            if (count === 1) {
                // અનોખો જવાબ: 10 પોઈન્ટ
                roundScore += 10;
            } else if (count > 1) {
                // મેચ થયેલો જવાબ: 5 પોઈન્ટ
                roundScore += 5;
            }
            // જો અક્ષર મેચ ન થાય તો 0
        });

        // ખેલાડીના કુલ સ્કોરમાં ઉમેરો
        players[playerId].score += roundScore;
        console.log(`${players[playerId].name} ને આ રાઉન્ડમાં ${roundScore} પોઈન્ટ મળ્યા.`);
    });
    
    console.log('રાઉન્ડ સમાપ્ત થયો. સ્કોર અપડેટ થઈ ગયો.', players);
    
    // સ્કોર ગણતરી પછી, બધાને સ્કોર મોકલો
    io.emit('scoreUpdate', players); 

    // થોડા સમય પછી નવો રાઉન્ડ શરૂ કરો
    setTimeout(startNewRound, 10000); 
}

// F. સર્વરને પોર્ટ 3000 પર શરૂ કરો
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`સર્વર પોર્ટ ${PORT} પર ચાલુ છે. (http://localhost:${PORT})`);
});
