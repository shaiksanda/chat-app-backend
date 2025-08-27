const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }], // exactly two users
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }                  // optional, for chat preview
}, { timestamps: true });

module.exports = mongoose.model("Chat", chatSchema);
