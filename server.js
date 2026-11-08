
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.get("/", (req,res)=>res.send("Minecraft 2D Online Multiplayer Server is running"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = new Map();

function makeCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code="";
  do {
    code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  } while(rooms.has(code));
  return code;
}
function publicRooms(){
  return [...rooms.values()]
    .filter(r=>r.public && r.players.size<2)
    .map(r=>({code:r.code,players:r.players.size}));
}
function broadcastRooms(){ io.emit("public-rooms",publicRooms()); }

io.on("connection", socket=>{
  socket.on("list-public-rooms",()=>socket.emit("public-rooms",publicRooms()));

  socket.on("create-room", data=>{
    if(socket.data.room) leaveRoom(socket);
    const code=makeCode();
    const room={code,public:!!data?.public,players:new Set()};
    rooms.set(code,room);
    joinRoom(socket,room);
    socket.emit("room-created",{code});
    broadcastRooms();
  });

  socket.on("join-room", data=>{
    const code=String(data?.code||"").toUpperCase();
    const room=rooms.get(code);
    if(!room) return socket.emit("room-error","Room not found");
    if(room.players.size>=2) return socket.emit("room-error","Room is full");
    if(socket.data.room) leaveRoom(socket);
    joinRoom(socket,room);
    socket.emit("joined-room",{code});
    broadcastRooms();
  });

  socket.on("game-state", state=>{
    if(socket.data.room) socket.to(socket.data.room).emit("game-state",state);
  });

  socket.on("disconnect",()=>{ leaveRoom(socket); broadcastRooms(); });
});

function joinRoom(socket,room){
  room.players.add(socket.id);
  socket.data.room=room.code;
  socket.join(room.code);
}
function leaveRoom(socket){
  const code=socket.data.room;
  if(!code) return;
  const room=rooms.get(code);
  if(room){
    room.players.delete(socket.id);
    if(room.players.size===0) rooms.delete(code);
  }
  socket.leave(code);
  socket.data.room=null;
}

const port=process.env.PORT || 3000;
server.listen(port,()=>console.log("Server running on port "+port));
