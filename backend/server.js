const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const workoutRoutes = require('./routes/workouts');
const userRoutes = require('./routes/user')

const server = express();

//middlewares 
server.use(express.json());    //pases request body 
server.use((req, res, next) => {
    console.log(req.path, req.method);
    next();
});

//Route to workouts routes
server.use('/api/workouts', workoutRoutes);

//Router to user routes
server.use('/api/user', userRoutes)

//Connect to DB then listens for requests
mongoose.connect(process.env.DBURL)
    .then((result) => server.listen(process.env.PORT, () => {
        console.log('Connected to DB and listening on', process.env.PORT)
    }))
    .catch((err) => console.log(err));




