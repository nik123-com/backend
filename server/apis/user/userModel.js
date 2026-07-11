const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {type: String, default: ""},
    email: {type: String, default: ""},
    password: {type: String, default: ""},
    usertype: {type: String, default: ""},
    isBlocked: {type: Boolean, default: false},
    resetPasswordToken: {type: String},
    resetPasswordExpires: {type: Date},
    createdAt: {type: Date, default: Date.now()}
})

module.exports = mongoose.model('user', userSchema )