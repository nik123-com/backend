require('dotenv').config()    // It help to keep keys in .env file
const express = require('express');
const compression = require('compression');
const app = express();
app.use(compression());
const port = process.env.PORT || 3000;

// default route
app.get('/', (req, res) => {
    res.send("Welcome to server")
})
//Use of Cors for linking Backend with Frontend
var cors = require('cors')
app.use(cors())

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

// const VendorRoutes = require('./server/routes/VendorRoutes')
// app.use("/vendor", VendorRoutes)


// for app listening
app.listen(port, () => {
    console.log(`listening  port ${port} `);
})

