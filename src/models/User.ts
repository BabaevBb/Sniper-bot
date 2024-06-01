import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  user: {
    type: Number,
    required: true,
    unique: true,
  },
  wallet: {
    type: String,
    required: true,
  },
  autobuy: {
    actived: { type: Boolean, default: false },
    amount: { type: Number, default: 1 },
    slippage: { type: Number, default: 0.1 },
  },
  autosell: {
    actived: Boolean,
    token: String,
    amount: Number,
    category: String,
    height: Number,
    time: Number,
    startPrice: String,
    startAt: Date,
    timerId: Number,
  },
  minpulled: {
    actived: { type: Boolean, default: false },
    minAmount: { type: Number, default: 1 },
    buyAmount: { type: Number, default: 1 },
    token: String,
    timerId: Number,
  },
});

const User = mongoose.model("user", UserSchema);
export default User;
