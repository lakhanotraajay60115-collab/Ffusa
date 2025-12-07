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
let currentLanguage = 'gu'; 
let hostId = null; 

// ભાષા પ્રમાણે મૂળાક્ષરો
const languageAlphabets = {
    gu: ["ક", "ખ", "ગ", "ચ", "ટ", "ત", "પ", "મ", "ર", "વ", "સ"], 
    hi: ["अ", "इ", "उ", "ए", "ओ", "श", "भ", "झ", "य", "र", "ल", "व"], 
    en: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
}; 

// નવું: શબ્દકોશ (Dictionary) - અહીં માત્ર item કેટેગરીના ઉદાહરણો છે.
// **સૂચના:** વાસ્તવિક એપ્લિકેશન માટે, તમારે આ સૂચિને ખૂબ મોટી બનાવવાની જરૂર પડશે.
const languageDictionary = {
    gu: {
        "ક": ["કેરી", "કમળ", "કોબીજ"],
        "ખ": ["ખજૂર", "ખમણ", "ખાખરા"],
        "A": ["આસન", "આંબલી"], // ગુજરાતીમાં A થી શરૂ થતા ઉદાહરણો
        // બાકીના મૂળાક્ષરો અહીં ઉમેરો...
    },
    hi: {
        "अ": ["अंगूर", "अनार", "अमरुद"],
        "श": ["शलगम", "शरीफा"],
        // બાકીના મૂળાક્ષરો અહીં ઉમેરો...
    },
    en: {
        "A": ["Apple", "Apricot", "Almond"],
        "B": ["Banana", "Berry", "Broccoli"],
        // બાકીના મૂળાક્ષરો અહીં ઉમેરો...
    }
};

// F. સર્વરને પોર્ટ 3000 પર શરૂ કરો
// ... (rest of the server setup remains the same)

// D. Socket.IO કનેક્શન લોજિક
io.on('connection', (socket) => {
    console.log('નવો ખેલાડી જોડાયો:', socket.id);
    
    // ... (registerName, disconnect, submitAnswer, setLanguage logic remains the same)
});

// E. ગેમ મેનેજમેન્ટ કાર્યો
function startNewRound() {
    roundActive = true;
    answers = [];
    
    // ... (alphabet selection logic remains the same)
    
    const alphabets = languageAlphabets[currentLanguage];
    const randomIndex = Math.floor(Math.random() * alphabets.length);
    currentAlphabet = alphabets[randomIndex];

    io.emit('newRound', { alphabet: currentAlphabet, roundNumber: 1, lang: currentLanguage }); 
    console.log(`નવો રાઉન્ડ શરૂ થયો. ભાષા: ${currentLanguage}, અક્ષર: ${currentAlphabet}`);

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

            const firstChar = answerValue.charAt(0).trim();
            
            let isMatch = false;
            let isReal = true; // નવું ચલ: શબ્દકોશમાં ઉપલબ્ધ છે કે નહીં

            // 2a. પ્રથમ અક્ષરની ચકાસણી
            if (currentLanguage === 'en') {
                if (firstChar.toLowerCase() === currentAlphabetToMatch.toLowerCase()) {
                    isMatch = true;
                }
            } else {
                if (firstChar === currentAlphabetToMatch) {
                    isMatch = true;
                }
            }

            if (!isMatch) {
                 return; // અક્ષર મેચ ન થયો, 0 પોઈન્ટ
            }
            
            // 2b. વાસ્તવિકતાની ચકાસણી (માત્ર 'item' કેટેગરી માટે)
            if (category === 'item') {
                const requiredList = languageDictionary[currentLanguage] && languageDictionary[currentLanguage][currentAlphabetToMatch];
                
                // જો 'item' કેટેગરી હોય, તો શબ્દકોશમાં તપાસો
                if (requiredList) {
                    // જવાબને નાના અક્ષરોમાં રૂપાંતરિત કરીને તપાસો (અંગ્રેજી માટે)
                    const lowerCaseAnswer = answerValue.toLowerCase();
                    
                    isReal = requiredList.some(dictWord => dictWord.toLowerCase() === lowerCaseAnswer);
                    
                    if (!isReal) {
                        console.log(`${answerValue} (${currentLanguage}) શબ્દકોશમાં ઉપલબ્ધ નથી.`);
                        return; // વાસ્તવિક શબ્દ નથી, 0 પોઈન્ટ
                    }
                } else {
                    // જો તે અક્ષર માટે શબ્દકોશમાં કોઈ સૂચિ ન હોય તો પણ પોઈન્ટ આપો, જેથી ગેમ અટકે નહીં.
                    // વાસ્તવિક એપ્લિકેશનમાં અહીં API કોલ આવવો જોઈએ.
                }
            }
            
            // જો isMatch=True અને isReal=True હોય, તો જ સ્કોર આપો
            
            // 2c. યુનિકનેસ (Uniqueness) ચકાસણી
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
    
    // ... (rest of endRoundAndCalculateScore logic remains the same)
    
    io.emit('scoreUpdate', players); 
    setTimeout(startNewRound, 10000); 
}

// F. સર્વરને પોર્ટ 3000 પર શરૂ કરો
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`સર્વર પોર્ટ ${PORT} પર ચાલુ છે. (http://localhost:${PORT})`);
});
