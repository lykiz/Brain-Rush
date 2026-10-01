import { getStore } from "@netlify/blobs";

const store = getStore("brain-rush-rooms", { consistency: "strong" });
const MAX_PLAYERS = 8;
const QUESTION_TIME = 15_000;
const ROOM_TTL = 1000 * 60 * 60 * 6;
const QUESTIONS = [
  { category: "🧠 Trivia", prompt: "Which planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { category: "🔢 Logic", prompt: "What number comes next: 2, 6, 12, 20, 30, ?", choices: ["36", "40", "42", "44"], answer: 2 },
  { category: "🌎 World", prompt: "Which ocean is the largest?", choices: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { category: "🔬 Science", prompt: "What gas do plants mainly take in during photosynthesis?", choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { category: "💻 Tech", prompt: "What does CPU stand for?", choices: ["Central Processing Unit", "Computer Power Utility", "Core Program User", "Central Program Upload"], answer: 0 },
  { category: "🏎️ Engineering", prompt: "If a car's speed doubles, aerodynamic drag generally becomes about…", choices: ["2×", "3×", "4×", "8×"], answer: 2 },
  { category: "🚀 Space", prompt: "How long does light from the Sun take to reach Earth, approximately?", choices: ["8 seconds", "8 minutes", "8 hours", "8 days"], answer: 1 },
  { category: "🎮 Gaming", prompt: "In chess, which piece can move in an L shape?", choices: ["Bishop", "Rook", "Knight", "Queen"], answer: 2 },
  { category: "🎵 Music", prompt: "How many strings does a standard guitar have?", choices: ["4", "5", "6", "8"], answer: 2 },
  { category: "🏀 Sports", prompt: "How many points is a free throw worth in basketball?", choices: ["1", "2", "3", "4"], answer: 0 },
  { category: "🧪 Chemistry", prompt: "What is the chemical symbol for gold?", choices: ["Ag", "Au", "Gd", "Go"], answer: 1 },
  { category: "🧩 Brain Teaser", prompt: "A farmer has 17 sheep. All but 9 run away. How many are left?", choices: ["8", "9", "17", "0"], answer: 1 },
];

type Player = { id: string; name: string; score: number; connectedAt: number };
type Room = { code:string; hostId:string; players:Player[]; phase:"lobby"|"question"|"results"|"finished"; round:number; questionIndex:number; questionStartedAt:number; answers:Record<string,number>; answerTimes:Record<string,number>; roundScores:Record<string,number>; createdAt:number; updatedAt:number };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const cleanName=(name:unknown)=>String(name??"").trim().replace(/[^a-zA-Z0-9 _-]/g,"").slice(0,18);
const roomKey=(code:string)=>`room:${code}`;
const makeCode=()=>Math.random().toString(36).slice(2,7).toUpperCase();

async function readRoom(code:string){
  const result=await store.getWithMetadata(roomKey(code),{consistency:"strong",type:"json"});
  if(!result)return null;
  const room=result.data as Room;
  if(Date.now()-room.updatedAt>ROOM_TTL){await store.delete(roomKey(code));return null;}
  if(room.phase==="question" && Date.now()-room.questionStartedAt>=QUESTION_TIME){
    scoreRound(room); room.phase="results"; room.updatedAt=Date.now();
    await store.setJSON(roomKey(code),room,{onlyIfMatch:result.etag});
  }
  return {room,etag:result.etag};
}
async function writeRoom(room:Room,etag?:string){return store.setJSON(roomKey(room.code),room,etag?{onlyIfMatch:etag}:{onlyIfNew:true});}
async function mutateRoom(code:string,fn:(room:Room)=>Room|Response){
  for(let attempt=0;attempt<6;attempt++){
    const current=await readRoom(code); if(!current)return json({error:"Room not found."},404);
    const result=fn(structuredClone(current.room)); if(result instanceof Response)return result;
    result.updatedAt=Date.now(); const write=await writeRoom(result,current.etag); if(write.modified)return json(publicRoom(result));
  }
  return json({error:"Someone else changed the room. Please try again."},409);
}
function publicRoom(room:Room){return {code:room.code,hostId:room.hostId,phase:room.phase,round:room.round,totalRounds:3,questionIndex:room.questionIndex,question:room.phase==="question"||room.phase==="results"?QUESTIONS[room.questionIndex]:null,questionStartedAt:room.questionStartedAt,players:room.players.map(p=>({id:p.id,name:p.name,score:p.score})),answered:Object.keys(room.answers),roundScores:room.phase==="results"||room.phase==="finished"?room.roundScores:{},winner:room.phase==="finished"?[...room.players].sort((a,b)=>b.score-a.score)[0]:null};}
async function createRoom(name:string,playerId:string){for(let i=0;i<10;i++){const code=makeCode(),now=Date.now();const room:Room={code,hostId:playerId,players:[{id:playerId,name,score:0,connectedAt:now}],phase:"lobby",round:0,questionIndex:0,questionStartedAt:0,answers:{},answerTimes:{},roundScores:{},createdAt:now,updatedAt:now};const result=await writeRoom(room);if(result.modified)return json(publicRoom(room));}return json({error:"Could not create a room."},500);}
export default async(req:Request)=>{try{const url=new URL(req.url),body=req.method==="POST"?await req.json().catch(()=>({})):{};const action=String(body.action??url.searchParams.get("action")??"");const code=String(body.code??url.searchParams.get("code")??"").trim().toUpperCase();const playerId=String(body.playerId??"").trim();
 if(req.method==="GET"&&action==="state"){const current=await readRoom(code);return current?json(publicRoom(current.room)):json({error:"Room not found."},404);}
 if(req.method!=="POST")return json({error:"Invalid method."},405);
 if(action==="create"){const name=cleanName(body.name);if(!name||!playerId)return json({error:"Enter a player name."},400);return createRoom(name,playerId);}
 if(!code||!playerId)return json({error:"Missing room code or player ID."},400);
 if(action==="join"){const name=cleanName(body.name);if(!name)return json({error:"Enter a player name."},400);return mutateRoom(code,room=>{if(room.phase!=="lobby")return json({error:"This game has already started."},409);if(room.players.some(p=>p.id===playerId))return room;if(room.players.length>=MAX_PLAYERS)return json({error:"Room is full."},409);if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return json({error:"That name is already taken."},409);room.players.push({id:playerId,name,score:0,connectedAt:Date.now()});return room;});}
 if(action==="start")return mutateRoom(code,room=>{if(room.hostId!==playerId)return json({error:"Only the host can start."},403);if(room.players.length<2)return json({error:"At least 2 players are required."},400);room.phase="question";room.round=1;room.questionIndex=Math.floor(Math.random()*QUESTIONS.length);room.questionStartedAt=Date.now();room.answers={};room.answerTimes={};room.roundScores={};return room;});
 if(action==="answer"){const choice=Number(body.choice);return mutateRoom(code,room=>{if(room.phase!=="question")return json({error:"This question is closed."},409);if(!room.players.some(p=>p.id===playerId))return json({error:"You are not in this room."},403);if(!Number.isInteger(choice)||choice<0||choice>3)return json({error:"Invalid answer."},400);if(room.answers[playerId]!==undefined)return room;if(Date.now()-room.questionStartedAt>=QUESTION_TIME){scoreRound(room);room.phase="results";return room;}room.answers[playerId]=choice;room.answerTimes[playerId]=Date.now();if(Object.keys(room.answers).length===room.players.length){scoreRound(room);room.phase="results";}return room;});}
 if(action==="next")return mutateRoom(code,room=>{if(room.hostId!==playerId)return json({error:"Only the host can continue."},403);if(room.phase!=="results")return json({error:"The round is not ready."},409);if(room.round>=3){room.phase="finished";return room;}room.round++;room.questionIndex=Math.floor(Math.random()*QUESTIONS.length);room.questionStartedAt=Date.now();room.answers={};room.answerTimes={};room.roundScores={};room.phase="question";return room;});
 return json({error:"Unknown action."},400);
 }catch(e){console.error(e);return json({error:"Server error. Please try again."},500);}};
function scoreRound(room:Room){const correct=QUESTIONS[room.questionIndex].answer;const answerers=room.players.filter(p=>room.answers[p.id]!==undefined).sort((a,b)=>(room.answerTimes[a.id]??Infinity)-(room.answerTimes[b.id]??Infinity));for(const [index,p] of answerers.entries()){const points=room.answers[p.id]===correct?Math.max(100,600-index*100):0;p.score+=points;room.roundScores[p.id]=points;}for(const p of room.players)if(room.roundScores[p.id]===undefined)room.roundScores[p.id]=0;}
