const express = require('express');
const app = express();
require('dotenv').config()
const cors = require("cors");
app.use(cors());
const bodyParser = require('body-parser');
app.use(bodyParser.json({limit:"50mb"}));
app.use(bodyParser.urlencoded({ extended: true }));
//socket.io
const socket = require("socket.io");
const server = require("http").createServer(app);
const io = new socket.Server(server,{
    cors:{
        origin:"https://groupchat-api-4img.onrender.com",
        methods:["GET", "POST"]
    }
})
var groups = [];
server.listen(process.env.PORT,()=>{
    console.log("http://localhost:"+process.env.PORT);
})

io.on("connection",socket=>{
    socket.join(socket.id);
    socket.on("disconnect",()=>{
        groups = groups.filter(group=>group.members.length!==0);
        const location = groups.find(group=>group.members.find(members=>members.socketId===socket.id));
        if(location){
            location.members = location.members?.filter(members=>members.socketId!==socket.id);
            if(!location.members.length)
                groups = groups.filter(group=>group.id!==location.id);
        }
    })

    socket.on("createRoom",async({groupName,groupID,password,name})=>{
        !groups.some(groups=>groups.id===groupID) && 
        groups.push({groupName,id:groupID,password,owner:socket.id,message:[],members:[{socketId:socket.id,username:name}]});
        socket.join(groupID);
        const groupLacations = await groups.find(group=>group.id===groupID);
        socket.to(groupID).emit("send-group-info",groupLacations);
    });
    socket.on("joinRoom",({groupID,password,name,joinDate})=>{
        const groupLacations = groups.find(groups=>groups.id===groupID);
        if(groupLacations){
            if(groupLacations.password===password){
                !groupLacations.members.some(socketId=>socketId===socket.id) &&
                groupLacations.members.push({socketId:socket.id,username:name,joinDate});
                socket.join(groupID);
                socket.to(groupID).emit("send-group-info",groupLacations);
                socket.emit("response",{message:"join group successfully",success:true,groupID});
            }
            else 
                socket.emit("response",{message:"Incorrect password",success:false,groupID});
        }
        else 
            socket.emit("response",{message:"This group not created yet!",success:false,groupID});
        
    });

    socket.on("sendMessage",({ms,sendDate,sender,groupID})=>{
        const location  = groups.find(group=>group.id===groupID);
        const author = location?.members.find(member=>member.socketId===sender);
        socket.to(groupID).emit("backMessage",{ms,sendDate,sender,groupID,author:author?.username,owner:location?.owner});
    })

    socket.on('refresh',({groupId})=>{
        const data = groups.find(group=>group.id===groupId);
        socket.to(socket.id).emit("send-group-info",data);
    })
    socket.on("removerUser",({userId,groupId})=>{
        const location = groups.find(group=>group.id===groupId);
        if(location){
            const admin = location.members?.find(member=>member.socketId===location.owner);
            const remover = location.members?.find(member=>member.socketId===userId);
            location.members = location.members?.filter(member=>member.socketId!==userId);
            socket.to(groupId).emit("response-remove",{remover,admin});
            socket.to(groupId).emit("send-group-info",location);
        }
    })
})