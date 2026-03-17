const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const ANSWER_TIME = 30; 
const VOTE_TIME = 30;   

const rooms = {};

const QUESTIONS = [
  { q: "The dot over the lowercase letter “i” is called a what?", a: "Tittle" },
  { q: "Before it was Google, the search engine was originally named…", a: "Backrub" },
  { q: "The country scotland has a national animal, what is it?", a: "Unicorn" },
  { q: "The inventor of the microwave realized it worked when what melted?", a: "A chocolate bar" },
  { q: "A study published in the journal Anthrozoo reported that cows produce 5% more milk when they are given...", a: "A name" },
  { q: "The plastic tip at the end of a shoelace is called…", a: "Aglet" },
  { q: "In ancient Rome, urine was taxed because it was used to…", a: "Wash clothes" },
  { q: "The original name for Bluetooth technology was…", a: "Short-Link" },
  { q: "As a young student in Buenos Aires, Pope Francis worked as a...", a: "Bouncer" },
  { q: "The only mammal capable of true flight is the…", a: "Bat" },
  { q: "The hashtag symbol is technically called an…", a: "Octothorpe" },
  { q: "The first product ever sold on eBay was a…", a: "Broken laser pointer" },
  { q: "The official term for a group of crows is a…", a: "Murder" },
  { q: "The shortest war in history lasted only…", a: "38 minutes" },
  { q: "The human body glows faintly due to a process called…", a: "Bioluminescence" },
  { q: "The smell after rain is called…", a: "Petrichor" },
  { q: "The most commonly forgotten item at airport security is…", a: "Shoes" },
  { q: "The word “nerd” was first used in a book by…", a: "Dr. Seuss" },
  { q: "In October of 2013, eight sixth-graders from a New York college prep school were hospitalized after someone released (Blank) in a classroom.", a: "Axe body spray" },
  { q: "The longest wedding veil ever made was longer than the…", a: "Eiffel Tower" },
  { q: "The inventor of the Pringles can was buried in one, but what flavor?", a: "Original" },
  { q: "Walter Arnold received the world's first speeding ticket in 1896 for going how many miles per hour?", a: "8" },
  { q: "It's weird work but Jackie Samuel charges $60 an hour to...", a: "Snuggle" },
  { q: "Frank Hayes is the first jockey to win a race while (Blank).", a: "Dead" },
  { q: "The Twitter bird has an official name. It is…", a: "Larry" },
  { q: "A spectator in an Illinois courtroom was sentenced to six months in jail for (Blank) during a trial.", a: "Yawning" },
  { q: "The first toy ever advertised on television was…", a: "Mr. Potato Head" },
  { q: "In Japan, letting a sumo wrestler make a baby cry is considered…", a: "Good luck" },
  { q: "In 2012, a 26-year-old man from London went on a mission to lick every (Blank) in the United Kingdom.", a: "Cathedral" },
  { q: "The national animal of Wales is the…", a: "Red kite" },
  { q: "The human nose can remember over how many scents?", a: "50,000" },
  { q: "The original purpose of bubble wrap was…", a: "Wallpaper" },
  { q: "The moon smells like (Blank) according to astronauts.", a: "Gunpowder" },
  { q: "The longest time between two twins being born is…", a: "87 days" },
  { q: "In 2007, to make a point, Nebraskain State Sen. Ernie Chambers filed a frivolous lawsuit against who?", a: "God" },
  { q: "A man in western Pennsylvania got a DUI for having an open can of beer while riding a what?", a: "Lawn mower" },
  { q: "Alexander the Great made his men (Blank) before a battle.", a: "Shave" },
  { q: "Anatidaephobia is the fear that somewhere in the world a (Blank) is watching you.", a: "Duck" },
  { q: "When Paul Nelson and Andrew Hunter climbed Britain's highest mountain in 2006, they made an unusual discovery hidden behind a pile of stones. It was a What?", a: "Piano" },
  { q: "The most expensive pizza in the world costs over how many dollars?", a: "12,000" },
  { q: "A 2013 Pakistani game show caused a controversy when their grand prize was a (Blank)", a: "Baby" },
  { q: "According to a Chinese myth, if a vampire comes across a sack of rice, he must What?", a: "Count each grain of rice" },
  { q: "For a story he was reporting on in 1955, Dan Rather tried (Blank) for the first time.", a: "Heroin" },
  { q: "Freddie Mercury backed out of a duet with Michael Jackson because Jackson brought a (Blank) to the recording studio", a: "Llama" },
  { q: "In 2012, a teenager from Weslaco, Texas claimed the reason he stabbed his friend was because a (Blank) made him do it.", a: "Ouija board" },
  { q: "The average cloud weighs over how many tons?", a: "1 million" },
  { q: "The human skeleton renews itself about every…", a: "10 years" },
  { q: "According to a 2010 study, one child in the U.S. was injured every 46 minutes by a What?", a: "Bounce house" }
];

function makeCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getRoom(socket) {
  return Object.values(rooms).find(r => r.players[socket.id]);
}

io.on("connection", socket => {

  socket.on("sendMessage", ({ code, name, text }) => {
    io.to(code).emit("receiveMessage", { name, text });
  });

  socket.on("returnToLobby", ({ code }) => {
  const room = rooms[code];
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  room.started = false;
  room.round = 0;
  room.answers = {};
  room.votes = {};
  room.currentQuestion = null;
  room.questionPool = [...QUESTIONS];
  room.customQuestions = [];
  room.favoriteChoice = null;

  for (const id in room.players) {
    room.players[id].score = 0;
    room.players[id].fooled = 0;
    room.players[id].correct = 0;
    room.players[id].timeouts = 0;
  }

  io.to(code).emit("backToTitle");
 });

 socket.on("addQuestion", ({ code, question, answer }) => {
  const room = rooms[code];
  if (!room) return;
  
  if (socket.id !== room.host) return; 

  room.customQuestions.push({
    q: question.trim(),
    a: answer.trim()
  });

  io.to(room.host).emit("updateCustomQuestions", room.customQuestions);
 });

 socket.on("deleteQuestion", ({ code, index }) => {
  const room = rooms[code];
  if (!room) return;
  if (socket.id !== room.host) return;

  room.customQuestions.splice(index, 1);
  io.to(room.host).emit("updateCustomQuestions", room.customQuestions);
 });

  socket.on("createRoom", ({ name, rounds }) => {
    const code = makeCode();

    rooms[code] = {
      code,
      host: null, 
      players: {},
      round: 0,
      maxRounds: rounds || 5,
      started: false,
      answers: {},
      votes: {},
      questionPool: [...QUESTIONS],
      customQuestions: [],
      currentQuestion: null,
      favoriteChoice: null
    };

    socket.emit("roomCreated", code);
  });


  socket.on("joinRoom", ({ code, name, isHost }) => {
  const room = rooms[code];
  if (!room) {
    socket.emit("invalidRoom");
    return;
  }

 
  if (isHost) {
    room.host = socket.id;
  } else {
 
    if (!room.players[socket.id]) {
      room.players[socket.id] = { 
        name, 
        score: 0,
        fooled: 0,
        correct: 0,
        timeouts: 0
      };
    }
  }

  socket.join(code);
  io.to(code).emit("players", room.players);

  if (room.started && room.currentQuestion) {
    socket.emit("question", room.currentQuestion.q);
  }
 });

 
  socket.on("startGame", code => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.host) return;
    if (room.started) return;

    room.started = true;
    room.round = 0;

    room.players = {};

    io.to(code).emit("goToGame");

    setTimeout(() => {
      startRound(code);
    }, 3000);
  });


  socket.on("submitAnswer", ({ code, answer }) => {
    const room = rooms[code];
    if (!room || !room.started) return;

    room.answers[socket.id] = answer;

    if (Object.keys(room.answers).length === Object.keys(room.players).length) {
      sendChoices(code);
    }
  });

  socket.on("vote", ({ code, choice }) => {
    const room = rooms[code];
    if (!room) return;

    room.votes[socket.id] = choice;

    if (Object.keys(room.votes).length === Object.keys(room.players).length) {
      scoreRound(code);
    }
  });

  socket.on("nextRound", code => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.host) return;

    if (room.round >= room.maxRounds || room.questionPool.length === 0) {
      const stats = generateStats(room);
      io.to(code).emit("finalResults", {
        players: room.players,
        stats
      });
    } else {
      startRound(code);
    }
  });

  socket.on("hostFavorite", ({ code, choice }) => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.host) return;

    room.favoriteChoice = choice;
    
    io.to(room.host).emit("favoriteSelected", choice);
  });
  
  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];
      if (room.host === socket.id) {
        room.host = null; 
      }
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(code).emit("players", room.players);
      }
    }
  });

});
function generateStats(room) {
  const players = Object.values(room.players);

  const bestFake = players.reduce((a,b) => 
    (a.fooled > b.fooled ? a : b)
  );

  const smartest = players.reduce((a,b) =>
    (a.correct > b.correct ? a : b)
  );

  const slowest = players.reduce((a,b) =>
    (a.timeouts > b.timeouts ? a : b)
  );

  const highestScore = players.reduce((a,b) =>
    (a.score > b.score ? a : b)
  );

  return {
    bestFake: bestFake.name,
    smartest: smartest.name,
    slowest: slowest.name,
    champion: highestScore.name
  };
}

function startTimer(code, phase, duration) {
  const room = rooms[code];
  if (!room) return;

  
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  let timeLeft = duration;

  io.to(code).emit("timerStart", {
    phase,
    duration
  });

  room.timerInterval = setInterval(() => {
    timeLeft--;

    io.to(code).emit("timerTick", {
      phase,
      timeLeft
    });

    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;

      if (phase === "answer") {
        sendChoices(code);
      }

      if (phase === "vote") {
        scoreRound(code);
      }
    }
  }, 1000);
}


function startRound(code) {
  const room = rooms[code];

  room.answers = {};
  room.votes = {};
  room.favoriteChoice = null;

 if (room.customQuestions.length > 0) {
  room.currentQuestion = room.customQuestions.shift();
 } else {
  const index = Math.floor(Math.random() * room.questionPool.length);
  room.currentQuestion = room.questionPool.splice(index, 1)[0];
 }


  io.to(code).emit("question", room.currentQuestion.q);
  startTimer(code, "answer", ANSWER_TIME);
}

function sendChoices(code) {
  const room = rooms[code];
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  const activeAnswerers = []; 

 
  for (const playerId in room.players) {
    if (!room.answers[playerId]) {
      room.answers[playerId] = null;
      room.players[playerId].timeouts++;
    } else {
     
      activeAnswerers.push(playerId);
    }
  }

  const choices = Object.values(room.answers).filter(a => a);


  choices.push(room.currentQuestion.a);


  choices.sort(() => Math.random() - 0.5);

 
  io.to(code).emit("choices", { 
    list: choices, 
    eligibleVoters: activeAnswerers 
  });


  startTimer(code, "vote", VOTE_TIME);
}

function scoreRound(code) {
  const room = rooms[code];
  const reveal = [];

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  for (const voterId in room.votes) {
    const pick = room.votes[voterId];
    const voterName = room.players[voterId].name;

    if (pick === room.currentQuestion.a) {
      room.players[voterId].score += 100;
      room.players[voterId].correct++;
      reveal.push(`${voterName} got it RIGHT!`);
    } else {
      const liarId = Object.keys(room.answers)
        .find(id => room.answers[id] === pick);

      if (liarId) {
        room.players[liarId].score += 50;
        room.players[liarId].fooled++;
        reveal.push(`${voterName} fell for "${pick}" (Faked by ${room.players[liarId].name})`);
      }
    }
  }

  if (room.favoriteChoice && room.favoriteChoice !== room.currentQuestion.a) {
    const favoriteId = Object.keys(room.answers).find(id => room.answers[id] === room.favoriteChoice);
    if (favoriteId) {
      room.players[favoriteId].score += 50;
      reveal.push(`WHAT! ${room.players[favoriteId].name} got +50 points for being the Host's Favorite Answer!`);
    }
  }

  io.to(code).emit("correctAnswer", {
    answer: room.currentQuestion.a,
    answers: room.answers
  });

  setTimeout(() => {
    io.to(code).emit("reveal", reveal);
    room.round++;

    const isGameOver = (room.round >= room.maxRounds || room.questionPool.length === 0);
    if (room.host) {
      io.to(room.host).emit("hostRevealControls", isGameOver);
    }

  }, 3000);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});