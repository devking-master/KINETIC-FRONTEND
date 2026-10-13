import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  targetType: 'video' | 'track' | 'comment';
  targetId: mongoose.Types.ObjectId;
  reporterId: mongoose.Types.ObjectId;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'removed';
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>({
  targetType: { type: String, enum: ['video', 'track', 'comment'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  details: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed', 'removed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

ReportSchema.index({ targetType: 1, targetId: 1 });
ReportSchema.index({ reporterId: 1 });
ReportSchema.index({ status: 1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
