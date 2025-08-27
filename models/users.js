const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // unique for search/friend requests
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp:{type:String,default:""},
  isVerified: { type: Boolean, default: false },           // email verification
  avatar: { type: String, default: "https://res.cloudinary.com/dq4yjeejc/image/upload/v1755768087/Screenshot_2025-08-21_145047_zqcfpw.png" }, 
  status: { type: String, enum: ["online", "offline", "away"], default: "offline" },
  lastSeen: { type: Date, default: Date.now },             // last online time
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],       // accepted friends
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] // pending friend requests
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
