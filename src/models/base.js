const mongoose = require('mongoose');

// Swagger'da barcha id'lar integer, shuning uchun _id avto-increment Number.
const Counter = mongoose.models.Counter
  || mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false }));

async function nextId(name) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return c.seq;
}

exports.createModel = (name, definition, { indexes = [], timestamps = true } = {}) => {
  const schema = new mongoose.Schema(
    { _id: Number, ...definition },
    { versionKey: false, timestamps: timestamps ? { createdAt: 'created_at', updatedAt: 'updated_at' } : false },
  );
  schema.pre('validate', async function assignId() {
    if (this.isNew && this._id == null) this._id = await nextId(name);
  });
  indexes.forEach(([fields, opts]) => schema.index(fields, opts));
  return mongoose.model(name, schema);
};

exports.Counter = Counter;
exports.ref =(to, extra = {}) => ({ type: Number, ref: to, ...extra });
