const express = require('express')
const app = express()

const http = require('http')
const server = http.createServer(app)

const { Server } = require('socket.io')
const io = new Server(server)

const msgs = []
const connectedUsers = []

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
})

io.on('connection', socket => {
    console.log('a user connected')

    socket.on('join-chat', nickname => {
        socket.nickname = nickname
        socket.isNew = true

        connectedUsers.push(nickname)

        socket.broadcast.emit('chat-msg', {
            by: 'System',
            txt: `${nickname} joined the conversation (${connectedUsers.length})`,
        })
    })

    socket.on('join-topic', topic => {
        if (socket.topic !== topic) socket.leave(socket.topic)

        socket.topic = topic
        socket.join(topic)

        socket.emit(
            'history',
            msgs.filter(msg => 
                !msg.to && msg.topic === socket.topic || 
                msg.to && msg.to === socket.nickname || msg.by === socket.nickname)
        )
    })

    socket.on('chat-msg', async msg => {
        msgs.push(msg)
        if(msg.to){
            const toSocket = await _getUserSocket(msg.to)
            toSocket.emit('chat-msg', msg)
            socket.emit('chat-msg', msg)
        } else {
            io.to(socket.topic).emit('chat-msg', msg)
        }

        if (socket.isNew) {
            const msg = { by: 'System', txt: 'Thanks for sharing' }
            setTimeout( () => socket.emit('chat-msg', msg), 1500)
        }
    })

    socket.on('disconnect', () => {
        const idx = connectedUsers.findIndex(
            nickname => nickname === socket.nickname
        )
        connectedUsers.splice(idx, 1)

        socket.broadcast.emit('chat-msg', {
            by: 'System',
            txt: `${socket.nickname} left the chat (${connectedUsers.length})`,
        })
    })
})
async function _getUserSocket(nickname) {
    const sockets = await _getAllSockets()
    const socket = sockets.find(s => s.nickname === nickname)
    return socket
}

async function _getAllSockets() {
    const sockets = await io.fetchSockets()
    return sockets
}

server.listen(3000, () => {
    console.log('listening on *:3000')
})
