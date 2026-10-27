const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false }, // never returned by default
    role: { type: String, enum: ['student', 'teacher'], default: 'student', required: true },
    // Phase 1 per-user gamification state (was in localStorage userdata)
    stats: {
      xp: { type: Number, default: 0 },
      subscribed: { type: Boolean, default: false }, // no real payments in this build
      streak: {
        current: { type: Number, default: 0 },
        best: { type: Number, default: 0 },
        lastActivityDate: { type: String, default: null },
      },
      achievements: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return { id: String(this._id), name: this.name, email: this.email, role: this.role, createdAt: this.createdAt, updatedAt: this.updatedAt };
};

module.exports = mongoose.model('User', userSchema);
