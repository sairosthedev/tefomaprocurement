import mongoose, { Schema, type Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout' | 'login_failed' | 'approve' | 'reject' | 'submit' | 'upload' | 'download' | 'status_change';
  entity: string;
  entityId?: mongoose.Types.ObjectId | any;
  /** Human-readable reference for the record, e.g. "PR-2026-014" or an email. */
  entityLabel?: string;
  user?: mongoose.Types.ObjectId | any;
  userEmail?: string;
  userRole?: string;
  description: string;
  previousData?: any;
  newData?: any;
  /** Field-level diff derived from previousData/newData at write time. */
  changes?: { field: string; from: any; to: any }[];
  /** Resulting status of the record, when the action moved it through a workflow. */
  status?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: {
    type: String,
    required: true,
    enum: [
      'create', 'update', 'delete', 'view',
      'login', 'logout', 'login_failed',
      'approve', 'reject', 'submit',
      'upload', 'download',
      'status_change'
    ]
  },
  entity: {
    type: String,
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  entityLabel: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userEmail: String,
  userRole: String,
  description: {
    type: String,
    required: true
  },
  previousData: {
    type: mongoose.Schema.Types.Mixed
  },
  newData: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: [{
    _id: false,
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed
  }],
  status: String,
  ipAddress: String,
  userAgent: String,
  method: String,
  path: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityLabel: 1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
