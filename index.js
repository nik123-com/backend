require('dotenv').config()    // It help to keep keys in .env file
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
const cors = require('cors');

const app = express();
app.use(compression());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Attach io to app so controllers can emit real-time events
app.set("io", io);

io.on("connection", (socket) => {
  console.log("⚡ New Socket client connected:", socket.id);

  socket.on("join_room", (room) => {
    if (room) {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    }
  });

  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  socket.on("query_updated", (data) => {
    io.emit("query_updated", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const port = process.env.PORT || 3000;

// default route
app.get('/', (req, res) => {
    res.send("Welcome to server")
})

// body - parser for req.body
app.use(express.urlencoded({extended: true}));
app.use(express.json());

// AdminSeeder 
const db = require("./server/config/db")
const adminseed = require("./server/config/seeder")

adminseed()

// connection to DB
const connectDb = require('./server/config/db')
connectDb()

// routes import
const apiRoutes = require('./server/routes/apiRoutes')
// if we use /api then move to apiRoutes 
app.use('/api', apiRoutes);

//if we use /user
const CustomerRoutes = require('./server/routes/CustomerRoutes')
app.use("/customer", CustomerRoutes)

const VendorRoutes = require('./server/routes/VendorRoutes')
app.use("/vendor", VendorRoutes)


// for app listening
server.listen(port, () => {
    console.log(`listening port ${port} with Socket.IO enabled`);
})


