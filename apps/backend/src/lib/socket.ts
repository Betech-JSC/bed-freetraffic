import { Server as SocketIoServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIoServer | null = null;

export function initSocket(server: HttpServer): SocketIoServer {
  io = new SocketIoServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] New client connected: socket.id = ${socket.id}`);

    // Join room for a specific chat session (used by chatbot widgets)
    socket.on('join_session', (sessionId: string) => {
      if (sessionId) {
        socket.join(`session:${sessionId}`);
        console.log(`[Socket.io] Socket ${socket.id} joined room session:${sessionId}`);
      }
    });

    // Join room for a specific workspace (used by CRM dashboard agents)
    socket.on('join_workspace', (workspaceIdStr: string | number) => {
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

export function getIo(): SocketIoServer | null {
  return io;
}
