const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const ANSWER_TIME = 30; // seconds
const VOTE_TIME = 30;   // seconds

const MAX_ROUNDS = 5;
const rooms = {};

// --------------------
// QUESTIONS (Fibbage-style)
// --------------------
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

  { q: "Bananas are berries, but strawberries are not. True or false?", a: "True" },
  { q: "The longest wedding veil ever made was longer than the…", a: "Eiffel Tower" },
  { q: "The inventor of the Pringles can was buried in one, but what flavor?", a: "Original" },
  { q: "The technical term for brain freeze is…", a: "Sphenopalatine ganglioneuralgia" },
  { q: "It's weird work but Jackie Samuel charges $60 an hour to...", a: "Snuggle" },
  { q: "The original London Bridge is now located in…", a: "Arizona" },
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
  { q: "The official term for hiccups is…", a: "Singultus" },
  { q: "The longest place name in the world is in…", a: "New Zealand" },
  { q: "The first alarm clock could only ring at…", a: "4 a.m." },

  { q: "When Paul Nelson and Andrew Hunter climbed Britain's highest mountain in 2006, they made an unusual discovery hidden behind a pile of stones. It was a What?", a: "Piano" },
  { q: "The most expensive pizza in the world costs over how many dollars?", a: "12,000" },
  { q: "A 2013 Pakistani game show caused a controversy when their grand prize was a...", a: "Baby" },
  { q: "According to a Chinese myth, if a vampire comes across a sack of rice, he must What?", a: "Count each grain of rice" },
  { q: "For a story he was reporting on in 1955, Dan Rather tried (Blank) for the first time.", a: "Heroin" },
  { q: "The first country to give women the right to vote was…", a: "New Zealand" },
  { q: "In 2012, a teenager from Weslaco, Texas claimed the reason he stabbed his friend was because a (Blank) made him do it.", a: "Ouija board" },
  { q: "The average cloud weighs over how many tons?", a: "1 million" },
  { q: "The human skeleton renews itself about every…", a: "10 years" },
  { q: "According to a 2010 study, one child in the U.S. was injured every 46 minutes by a What?", a: "Bounce house" }
];

// --------------------
// HELPERS
// --------------------
function makeCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getRoom(socket) {
  return Object.values(rooms).find(r => r.players[socket.id]);
}

// --------------------
// SOCKET LOGIC
// --------------------
io.on("connection", socket => {
  // ADD CUSTOM QUESTION
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

 // DELETE CUSTOM QUESTION
 socket.on("deleteQuestion", ({ code, index }) => {
  const room = rooms[code];
  if (!room) return;
  if (socket.id !== room.host) return;

  room.customQuestions.splice(index, 1);
  io.to(room.host).emit("updateCustomQuestions", room.customQuestions);
 });



  // CREATE ROOM (HOST)
  socket.on("createRoom", name => {
    const code = makeCode();

    rooms[code] = {
      code,
      host: socket.id,
      players: {},
      round: 0,
      started: false,
      answers: {},
      votes: {},
      questionPool: [...QUESTIONS],
      customQuestions: [],
      currentQuestion: null
    };

    rooms[code].players[socket.id] = {
     name,
     score: 0,
     fooled: 0,
     correct: 0,
     timeouts: 0
    };

    socket.join(code);
    socket.emit("roomCreated", code);
    io.to(code).emit("players", rooms[code].players);
  });

  // JOIN ROOM
  socket.on("joinRoom", ({ code, name }) => {
    const room = rooms[code];
    if (!room) return;

    if (!room.players[socket.id]) {
      room.players[socket.id] = { name, score: 0 };
    }

    socket.join(code);
    io.to(code).emit("players", room.players);

    // late join sync
    if (room.started && room.currentQuestion) {
      socket.emit("question", room.currentQuestion.q);
    }
  });

  // START GAME (HOST ONLY)
  socket.on("startGame", code => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.host) return;
    if (room.started) return;

    room.started = true;
    room.round = 0;

    io.to(code).emit("goToGame");
    startRound(code);
  });

  // SUBMIT FAKE ANSWER
  socket.on("submitAnswer", ({ code, answer }) => {
    const room = rooms[code];
    if (!room || !room.started) return;

    room.answers[socket.id] = answer;

    if (Object.keys(room.answers).length === Object.keys(room.players).length) {
      sendChoices(code);
    }
  });

  // VOTE
  socket.on("vote", ({ code, choice }) => {
    const room = rooms[code];
    if (!room) return;

    room.votes[socket.id] = choice;

    if (Object.keys(room.votes).length === Object.keys(room.players).length) {
      scoreRound(code);
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(code).emit("players", room.players);
      }
    }
  });
});

// --------------------
// GAME FUNCTIONS
// --------------------

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

  // CLEAR PREVIOUS TIMER
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

  // 🔹 Fill missing answers (players who didn't answer)
  for (const playerId in room.players) {
    if (!room.answers[playerId]) {
     room.answers[playerId] = null;
     room.players[playerId].timeouts++;
    }
  }

  const choices = Object.values(room.answers).filter(a => a);

  // Add correct answer
  choices.push(room.currentQuestion.a);

  // Shuffle
  choices.sort(() => Math.random() - 0.5);

  io.to(code).emit("choices", choices);

  // Start vote timer
  startTimer(code, "vote", VOTE_TIME);
}

function scoreRound(code) {
  const room = rooms[code];
  const reveal = [];

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
        reveal.push(`${voterName} was fooled by ${room.players[liarId].name}`);
      }
    }
  }

  io.to(code).emit("reveal", reveal);

  room.round++;

  if (room.round >= MAX_ROUNDS || room.questionPool.length === 0) {
   const stats = generateStats(room);
   io.to(code).emit("finalResults", {
     players: room.players,
     stats
   });
  } else {
    setTimeout(() => startRound(code), 4000);
  }
}

server.listen(3000, () => {
  console.log("Educate server running on http://10.17.29.159:3000");
});