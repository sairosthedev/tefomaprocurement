import mongoose, { Schema, type Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout' | 'login_failed' | 'approve' | 'reject' | 'submit' | 'upload' | 'download' | 'status_change';
  entity: string;
  entityId?: mongoose.Types.ObjectId | any;
  user?: mongoose.Types.ObjectId | any;
  userEmail?: string;
  userRole?: string;
  description: string;
  previousData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
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
  ipAddress: String,
  userAgent: String,
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

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
