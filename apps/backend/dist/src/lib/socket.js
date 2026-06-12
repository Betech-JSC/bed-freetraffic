"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getIo = getIo;
const socket_io_1 = require("socket.io");
let io = null;
function initSocket(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        console.log(`[Socket.io] New client connected: socket.id = ${socket.id}`);
        // Join room for a specific chat session (used by chatbot widgets)
        socket.on('join_session', (sessionId) => {
            if (sessionId) {
                socket.join(`session:${sessionId}`);
                console.log(`[Socket.io] Socket ${socket.id} joined room session:${sessionId}`);
            }
        });
        // Join room for a specific workspace (used by CRM dashboard agents)
        socket.on('join_workspace', (workspaceIdStr) => {
            const workspaceId = parseInt(String(workspaceIdStr), 10);
            if (!isNaN(workspaceId)) {
                socket.join(`workspace:${workspaceId}`);
                console.log(`[Socket.io] Socket ${socket.id} joined room workspace:${workspaceId}`);
            }
        });
        socket.on('disconnect', () => {
            console.log(`[Socket.io] Client disconnected: socket.id = ${socket.id}`);
        });
    });
    return io;
}
function getIo() {
    return io;
}
