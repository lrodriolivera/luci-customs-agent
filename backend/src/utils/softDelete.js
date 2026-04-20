/**
 * Soft-delete helpers.
 *
 * Adds deletedAt/deletedBy to a Mongoose schema and auto-filters soft-deleted
 * documents from find/findOne/count queries (unless {withDeleted: true} passed).
 *
 * Usage:
 *   const softDelete = require('../utils/softDelete');
 *   softDelete(MySchema);
 *
 * Instance API:
 *   doc.softDelete(userId)    -> sets deletedAt + deletedBy, saves
 *   doc.restore()             -> unsets deletedAt + deletedBy, saves
 *
 * Query API:
 *   Model.find()                       -> excludes deleted (default)
 *   Model.find().setOptions({withDeleted: true})  -> includes deleted
 */

module.exports = function softDeletePlugin(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null }
  });

  schema.methods.softDelete = async function(userId) {
    this.deletedAt = new Date();
    this.deletedBy = userId ? String(userId) : null;
    return this.save();
  };

  schema.methods.restore = async function() {
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  const filter = function(next) {
    const withDeleted = this.getOptions()?.withDeleted;
    if (withDeleted) return next();
    const q = this.getQuery();
    if (q.deletedAt === undefined) {
      this.where({ deletedAt: null });
    }
    next();
  };

  // Read operations get the filter applied automatically
  schema.pre('find', filter);
  schema.pre('findOne', filter);
  schema.pre('findOneAndUpdate', filter);
  schema.pre('countDocuments', filter);
  schema.pre('count', filter);

  return schema;
};
